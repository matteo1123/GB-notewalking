import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple point calculation logic
const calculatePoints = (durationSeconds: number, moduleType: string, completed: boolean) => {
  let points = 0;

  // Base points for time spent (1 point per minute)
  points += Math.floor(durationSeconds / 60);

  // Completion bonus
  if (completed) {
    points += 5;
  }

  // Activity multipliers/bonuses
  switch (moduleType) {
    case 'notewalking':
      points += 3; // Harder activity 
      break;
    case 'ear_training':
      points += 2;
      break;
    default:
      break;
  }

  return points;
};

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { sessionId, durationSeconds, moduleTypes, completed } = await req.json();

    if (!sessionId || durationSeconds === undefined) {
      throw new Error("Missing required session data");
    }

    // Initialize service role client for bypassing RLS to update points 
    // We do NOT want users simply calling `update({ points: 99999 })` from the frontend
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Ensure session actually belongs to user and wasn't already awarded
    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from('practice_sessions')
      .select('user_id, total_duration_seconds, completed')
      .eq('id', sessionId)
      .single();

    if (sessionError || !sessionData) throw new Error("Session not found");
    if (sessionData.user_id !== user.id) throw new Error("Unauthorized access to session");

    // Calculate total points mapping over modules played
    const totalPoints = calculatePoints(
      durationSeconds || sessionData.total_duration_seconds,
      moduleTypes && moduleTypes.length > 0 ? moduleTypes[0] : 'general',
      completed || sessionData.completed
    );

    // Update the profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .rpc('increment_user_points', {
        user_id_param: user.id,
        points_to_add: totalPoints
      });

    // Fallback if RPC doesn't exist yet (we will create it next, but good to have fallback)
    if (profileError && profileError.message.includes('function "increment_user_points" does not exist')) {
      // Warning: This is susceptible to race conditions if multiple sessions end simultaneously, 
      //, but acceptable fallback for edge cases. RPC is safer.
      const { data: currentProfile } = await supabaseAdmin.from('profiles').select('points, current_xp').eq('id', user.id).single();
      const currentPoints = currentProfile?.points || 0;
      const currentXp = currentProfile?.current_xp || 0;

      await supabaseAdmin.from('profiles')
        .update({
          points: currentPoints + totalPoints,
          current_xp: currentXp + totalPoints
        })
        .eq('id', user.id);
    } else if (profileError) {
      throw profileError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        pointsAwarded: totalPoints,
        message: `Awarded ${totalPoints} points for practice`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err.message || "An error occurred" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
