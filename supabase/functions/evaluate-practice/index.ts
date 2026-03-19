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
  console.log("[evaluate-practice] callAI started");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  console.log("[evaluate-practice] GEMINI_API_KEY present:", !!geminiKey);
  if (!geminiKey) {
    throw new Error("GEMINI_API_KEY not configured.");
  }

  console.log("[evaluate-practice] Calling Gemini API...");
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

  console.log("[evaluate-practice] Gemini API response status:", response.status);
  const result = await response.json();
  if (result.error) {
    console.error("[evaluate-practice] Gemini API error:", result.error);
    throw new Error(result.error.message || "Gemini API error");
  }
  console.log("[evaluate-practice] Gemini API success, candidates:", result.candidates?.length);
  return result.candidates?.[0]?.content?.parts?.[0]?.text || "I was unable to analyze your performance.";
}

serve(async (req) => {
  console.log("[evaluate-practice] Request received, method:", req.method);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("[evaluate-practice] Handling CORS preflight");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    console.log("[evaluate-practice] Auth header present:", !!authHeader);
    if (!authHeader) {
      console.error("[evaluate-practice] Missing authorization header");
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
    console.log("[evaluate-practice] Verifying user...");
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[evaluate-practice] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("[evaluate-practice] User verified:", user.id);

    // Parse request
    const body = await req.json();
    console.log("[evaluate-practice] Request body keys:", Object.keys(body));
    const { practice_log_id, module_type, midi_data, harmonic_context, coach_advice } = body;
    console.log("[evaluate-practice] practice_log_id:", practice_log_id, "module_type:", module_type, "midi_data length:", midi_data?.length);

    if (!practice_log_id || !module_type || !midi_data) {
      console.error("[evaluate-practice] Missing required fields:", { practice_log_id, module_type, hasMidiData: !!midi_data });
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("[evaluate-practice] All required fields present");

    // Fetch the system prompt for this module type
    console.log("[evaluate-practice] Creating admin client...");
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    console.log("[evaluate-practice] Admin client created");

    console.log("[evaluate-practice] Fetching system prompt for module_type:", module_type);
    const { data: promptData, error: promptError } = await supabaseAdmin
      .from("evaluation_prompts")
      .select("system_prompt")
      .eq("module_type", module_type)
      .single();
    
    if (promptError) {
      console.error("[evaluate-practice] Error fetching prompt:", promptError);
    } else {
      console.log("[evaluate-practice] Prompt fetched successfully, has prompt:", !!promptData?.system_prompt);
    }

    let systemPromptText = `You are a concise, direct guitar coach. Analyze the student's performance data and give specific, actionable feedback. Keep responses to 3-5 sentences maximum. Be encouraging but specific — mention actual notes, timing, or patterns from the data. Do not use emojis. Do not use exclamation marks excessively. The performance data is a 30-second snapshot — do not comment on session length.`;

    if (module_type === 'notewalking') {
      systemPromptText += `\n\nMODULE CONTEXT (Notewalking): The student improvises over a two-chord backing track. One measure before each chord change, the upcoming chord tones are highlighted on their fretboard. Analyze: (1) which notes they played and whether those notes are chord tones or tensions over each chord, (2) whether they adjusted their note choices when the chord changed, (3) how long they held each note. Be specific about which notes worked well and which created tension. If they played very few notes, encourage them to experiment more freely.`;
    }

    if (module_type === 'scale') {
      systemPromptText += `\n\nMODULE CONTEXT (Scale Practice): The student is practicing a scale pattern with a metronome. Analyze the notes they played and comment on: (1) whether the notes form a recognizable scale pattern, (2) consistency and evenness of their playing, (3) any specific observations about note choices. If harmonic context is provided, note how their scale notes relate to that key. Keep it practical and brief.`;
    }

    if (module_type === 'arpeggio') {
      systemPromptText += `\n\nMODULE CONTEXT (Arpeggio Practice): The student is practicing arpeggio patterns with a metronome. Analyze: (1) whether the notes form chord-tone patterns (1-3-5-7 type intervals), (2) consistency and direction of the patterns, (3) any specific timing or accuracy observations. Keep it brief and actionable.`;
    }

    if (module_type === 'rhythm') {
      systemPromptText += `\n\nMODULE CONTEXT (Rhythm Practice): The student is practicing rhythm guitar with a metronome backing track. Note pitch data may not be available since this is rhythm-focused. If no notes are detected, the student was likely practicing muted strumming or wasn't playing. Encourage them to keep working on their rhythmic feel and groove.`;
    }

    if (promptData && promptData.system_prompt) {
      systemPromptText = systemPromptText + "\n\nAdditional Instructions:\n" + promptData.system_prompt;
    }

    // Format the MIDI and Context data into a readable string
    console.log("[evaluate-practice] Formatting performance data...");
    let performanceDataString = "Here is the raw data from the practice session.\n\n";

    if (coach_advice) {
      performanceDataString += `Coach Advice provided at the start of this session (did the student follow or depart from this?):\n"${coach_advice}"\n\n`;
      console.log("[evaluate-practice] Included coach advice in prompt");
    }

    if (harmonic_context && harmonic_context.length > 0) {
      performanceDataString += "Harmonic Context (Chords playing):\n";
      harmonic_context.forEach((ctx: any) => {
        performanceDataString += `- ${ctx.startTime.toFixed(2)}s to ${ctx.endTime.toFixed(2)}s: ${ctx.chord || ctx.note}\n`;
      });
      performanceDataString += "\n";
      console.log("[evaluate-practice] Harmonic context entries:", harmonic_context.length);
    } else {
      console.log("[evaluate-practice] No harmonic context provided");
    }

    if (midi_data && midi_data.length > 0) {
      performanceDataString += "My Performance (Notes Played):\n";
      
      const totalDuration = midi_data.reduce((sum: number, n: any) => sum + (n.duration || 0), 0);
      
      if (midi_data.length === 1 && totalDuration > 10) {
        performanceDataString += `[SYSTEM NOTE] Anomalous Input Detected: The student held a single note (${midi_data[0].pitch}) for over ${totalDuration.toFixed(1)} seconds. This is almost certainly an error, the mic picking up background noise, or them just testing the mic. DO NOT analyze this as a deliberate creative choice. Playfully acknowledge they held one note the whole time but keep it short.\n`;
      } else {
        midi_data.forEach((note: any) => {
          // Handle both raw string pitches like "E4" or MIDI numbers
          let noteString = note.pitch;
          if (typeof note.pitch === 'number') {
            const pitchMap = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
            const pitchName = pitchMap[note.pitch % 12];
            const octave = Math.floor(note.pitch / 12) - 1;
            noteString = `${pitchName}${octave} (MIDI: ${note.pitch})`;
          }
          const endTime = note.endTime || (note.startTime + (note.duration || 0));
          performanceDataString += `- ${note.startTime.toFixed(2)}s to ${endTime.toFixed(2)}s: Note ${noteString}\n`;
        });
      }
      console.log("[evaluate-practice] MIDI notes formatted:", midi_data.length);
    } else {
      performanceDataString += "No notes were detected during this recording.\n";
      performanceDataString += "[SYSTEM NOTE] The student didn't play anything. Playfully encourage them to play next time.\n";
      console.log("[evaluate-practice] No MIDI data to format");
    }

    // Call the AI (Gemini 1.5 Pro)
    console.log("[evaluate-practice] Calling AI with prompt length:", systemPromptText.length, "performance data length:", performanceDataString.length);
    const feedbackText = await callAI(systemPromptText, performanceDataString);
    console.log("[evaluate-practice] AI response received, length:", feedbackText.length);

    // Save evaluation to database
    console.log("[evaluate-practice] Saving evaluation to database...");
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
      console.error("[evaluate-practice] Error saving evaluation:", insertError);
    } else {
      console.log("[evaluate-practice] Evaluation saved successfully");
    }

    console.log("[evaluate-practice] Returning success response");
    return new Response(
      JSON.stringify({
        feedback: feedbackText,
        db_error: insertError ? insertError.message : null
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[evaluate-practice] Evaluation error:", error);
    console.error("[evaluate-practice] Error stack:", error.stack);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
