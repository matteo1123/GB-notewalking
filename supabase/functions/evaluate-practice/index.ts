import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Calls Gemini 3.1 Pro Preview for analysis.
 * DO NOT CHANGE the model name from gemini-3.1-pro-preview, per user instruction.
 */
async function callAI(systemPrompt: string, userMessage: string): Promise<string> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    throw new Error("GEMINI_API_KEY not configured.");
  }

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
          maxOutputTokens: 1024,
        },
      }),
    }
  );

  const result = await response.json();
  if (result.error) {
    console.error("Gemini API error:", result.error);
    throw new Error(result.error.message || "Gemini API error");
  }
  return result.candidates?.[0]?.content?.parts?.[0]?.text || "I was unable to analyze your performance.";
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's auth
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const { practice_log_id, module_type, midi_data, harmonic_context } = await req.json();

    if (!practice_log_id || !module_type || !midi_data) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the system prompt for this module type
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: promptData } = await supabaseAdmin
      .from("evaluation_prompts")
      .select("system_prompt")
      .eq("module_type", module_type)
      .single();

    let systemPromptText = "You are a helpful AI guitar coach analyzing user performance. IMPORTANT: The performance data is captured in 30-second snippets. DO NOT complain that the practice session is too short or only 30 seconds long.";
    if (promptData && promptData.system_prompt) {
      systemPromptText = promptData.system_prompt + "\n\nIMPORTANT: The performance data is captured in 30-second snippets. DO NOT complain that the practice session is too short or only 30 seconds long.";
    }

    // Format the MIDI and Context data into a readable string
    let performanceDataString = "Here is the raw data from the practice session.\n\n";

    if (harmonic_context && harmonic_context.length > 0) {
      performanceDataString += "Harmonic Context (Chords playing):\n";
      harmonic_context.forEach((ctx: any) => {
        performanceDataString += `- ${ctx.startTime.toFixed(2)}s to ${ctx.endTime.toFixed(2)}s: ${ctx.chord || ctx.note}\n`;
      });
      performanceDataString += "\n";
    }

    if (midi_data && midi_data.length > 0) {
      performanceDataString += "My Performance (MIDI Notes Played):\n";
      midi_data.forEach((note: any) => {
        const pitchMap = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const pitchName = pitchMap[note.pitch % 12];
        const octave = Math.floor(note.pitch / 12) - 1;
        performanceDataString += `- ${note.startTime.toFixed(2)}s to ${note.endTime.toFixed(2)}s: Note ${note.pitch} (${pitchName}${octave})\n`;
      });
    } else {
      performanceDataString += "No notes were detected during this recording.\n";
    }

    // Call the AI (Gemini 1.5 Pro)
    const feedbackText = await callAI(systemPromptText, performanceDataString);

    // Save evaluation to database
    const { error: insertError } = await supabaseAdmin
      .from("practice_evaluations")
      .insert({
        practice_log_id,
        user_id: user.id,
        midi_data,
        harmonic_context: harmonic_context || null,
        ai_feedback: feedbackText
      });

    if (insertError) {
      console.error("Error saving evaluation:", insertError);
    }

    return new Response(
      JSON.stringify({
        feedback: feedbackText,
        db_error: insertError ? insertError.message : null
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Evaluation error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
