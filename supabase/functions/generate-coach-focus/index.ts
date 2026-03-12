import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Calls Gemini 3.1 Pro Preview to generate session focus advice.
 */
async function callAIFocus(userMessage: string, moduleType: string): Promise<string> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    throw new Error("GEMINI_API_KEY not configured.");
  }

  let moduleContextText = "";
  if (moduleType === 'notewalking') {
    moduleContextText = "\n\nMODULE CONTEXT (Notewalking): The student plays over a slow progression that switches between two chords. One measure before each chord change, the upcoming chord's tones are highlighted on their fretboard to help them prepare. Your advice should be simple and encourage them to use those highlights to land on a solid chord tone when the change happens.";
  }
  
  const moduleContext = { goal: moduleType, text: moduleContextText }; // Overwritten later


  const systemPrompt = `You are a helpful AI guitar coach. Your job is to give a short (1-2 sentences), encouraging piece of advice for the student's upcoming practice session based on their recent feedback history. Use simple, friendly words. 
  
  If they have no history, default to encouraging them to hit chord tones. If they have history, see what they succeeded at last time and gently nudge them to try something new (e.g. if they hit chord tones well, suggest trying some scale notes for tension). Keep it brief, conversational, and motivating. IMPORTANT: Always finish your sentence completely.
  
  The student's overarching musical goal is: "${moduleContext.goal || "general improvement"}". Try to lightly frame your advice in the context of this goal if it makes sense.
  ${moduleContext.text}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: userMessage }] }
        ],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 250,
        },
      }),
    }
  );

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error.message || "Gemini API error");
  }
  return result.candidates?.[0]?.content?.parts?.[0]?.text || "Let's focus on hitting those solid chord tones today. You've got this!";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { module_type } = body;

    if (!module_type) {
      return new Response(
        JSON.stringify({ error: "Missing module_type field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the 3 most recent practice evaluations for this module type
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: recentLogs, error: fetchError } = await supabaseAdmin
      .from('practice_log')
      .select('id')
      .eq('user_id', user.id)
      .eq('module_type', module_type)
      .order('created_at', { ascending: false })
      .limit(5);

    let recentFeedbackText = "No previous feedback history.";

    if (recentLogs && recentLogs.length > 0) {
        const logIds = recentLogs.map((l: any) => l.id);
        const { data: evaluations } = await supabaseAdmin
            .from('practice_evaluations')
            .select('ai_feedback, created_at')
            .in('practice_log_id', logIds)
            .order('created_at', { ascending: false });

        if (evaluations && evaluations.length > 0) {
            recentFeedbackText = "Here are the recent feedback notes you gave this student:\n\n";
            evaluations.forEach((ev: any, index: number) => {
                recentFeedbackText += `Feedback ${index + 1}:\n"${ev.ai_feedback}"\n\n`;
            });
            recentFeedbackText += "Based on this, what should they focus on for this session?";
        } else {
            recentFeedbackText = "The student has practiced this module but has no previous AI feedback. Encourage them to hit chord tones.";
        }
    } else {
        recentFeedbackText = "This is the student's first time practicing this module. Encourage them to hit chord tones and get a feel for the progression.";
    }

    const { data: focusProfile } = await supabaseAdmin
      .from('profiles')
      .select('instrument_goal')
      .eq('id', user.id)
      .single();

    const focusAdvice = await callAIFocus(recentFeedbackText, { goal: focusProfile?.instrument_goal || "general improvement", text: module_type === 'notewalking' ? "\n\nMODULE CONTEXT (Notewalking): The student plays over a slow progression that switches between two chords. One measure before each chord change, the upcoming chord's tones are highlighted on their fretboard to help them prepare. Your advice should be simple and encourage them to use those highlights to land on a solid chord tone when the change happens." : "" } as any);

    return new Response(
      JSON.stringify({ advice: focusAdvice }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[generate-coach-focus] error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
