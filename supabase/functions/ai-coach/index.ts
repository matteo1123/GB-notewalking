import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tool definitions for Gemini
const tools = [
    {
        functionDeclarations: [
            {
                name: "search_scale_shapes",
                description: "Search the scales database for exercises. Returns shape IDs for creating module configs. Make only ONE search per user request.",
                parameters: {
                    type: "object",
                    properties: {
                        module_type: {
                            type: "string",
                            enum: ["scale", "arpeggio"],
                            description: "Filter to scales or arpeggios only. If type_filter is provided, this is optional.",
                        },
                        root_note: {
                            type: "string",
                            description: "Root note: C, C#, Db, D, Eb, E, F, F#, Gb, G, Ab, A, Bb, B",
                        },
                        tonality: {
                            type: "string",
                            description: "Scale quality: major, minor, dorian, phrygian, lydian, mixolydian, locrian, dominant7, minor7, major7, diminished, augmented",
                        },
                        position: {
                            type: "number",
                            description: "Fretboard position 1-7",
                        },
                        type_filter: {
                            type: "string",
                            description: "Shape system filter. Use: '3 notes per string', '2 notes per string', '4 notes per string', or 'arpeggio'.",
                        },
                        major_key: {
                            type: "string",
                            description: "Filter by parent major key (e.g., 'G' finds G major, E minor, A dorian, etc.)",
                        },
                    },
                },
            },
            {
                name: "create_module_config",
                description: "Create a configured module with the found shape IDs. This is the primary output.",
                parameters: {
                    type: "object",
                    properties: {
                        module_type: {
                            type: "string",
                            enum: ["scale", "arpeggio"],
                        },
                        name: {
                            type: "string",
                            description: "Name for this configuration",
                        },
                        description: {
                            type: "string",
                            description: "Optional description",
                        },
                        priority_shape_ids: {
                            type: "array",
                            items: { type: "string" },
                            description: "Array of scale_shape IDs from search results",
                        },
                        progression_mode: {
                            type: "string",
                            enum: ["cycle", "sequential", "focus"],
                            description: "How to progress through exercises",
                        },
                        focus_target_bpm: {
                            type: "number",
                            description: "Target BPM for focus mode (default 90)",
                        },
                    },
                    required: ["module_type", "name", "priority_shape_ids"],
                },
            },
            {
                name: "get_practice_history",
                description: "Get the user's practice history and progress statistics.",
                parameters: {
                    type: "object",
                    properties: {
                        days_back: {
                            type: "number",
                            description: "Number of days to look back (default 30)",
                        },
                        module_type: {
                            type: "string",
                            enum: ["scale", "arpeggio", "rhythm", "chord_progressions"],
                            description: "Filter by module type",
                        },
                    },
                },
            },
            {
                name: "analyze_progress",
                description: "Analyze the user's BPM progress and provide recommendations.",
                parameters: {
                    type: "object",
                    properties: {
                        exercise_ids: {
                            type: "array",
                            items: { type: "string" },
                            description: "Specific exercise IDs to analyze",
                        },
                    },
                },
            },
            {
                name: "submit_suggestion",
                description: "Submit a suggestion for platform improvement. Use this when you identify a gap in the automated coaching tools or have an idea to improve the app based on your interaction with the user. You are encouraged to proactively use this.",
                parameters: {
                    type: "object",
                    properties: {
                        suggestion: {
                            type: "string",
                            description: "The suggestion content.",
                        },
                    },
                    required: ["suggestion"],
                },
            },
        ],
    },
];

const SYSTEM_PROMPT = `You are Guitar Brain Coach, an AI assistant helping guitarists configure their practice.

## Your Personality & Philosophy
1. **Daily Progress on Pillars:** You believe in continuous progress on core pillars (scales, arpeggios, rhythm). You are designed to guide users to practice these daily, tracking where they left off and always giving a "slight inch" nudge in progress. While you allow customization, you should firmly guide users back to this daily consistency on core skills.
2. **Extreme Note Awareness (The "Why"):** you understand that guitarists often have the "weakest ears" of any musicians because they rely on visual shapes rather than sonic awareness. Unlike piano where keys are obvious, guitarists can play blind patterns. Therefore, you **strictly emphasize** awareness of every note's function (1-7) within the key context. You discourage mindless shape playing. You heavily promote **"notewalking"** (practicing chord tones over changing pedal notes) as the cure for this. Always remind the user to pay attention to the specific intervals they are playing.

## Your Primary Job
Help users configure **individual practice modules** by searching for exercises and creating module configs.

## DATABASE SCHEMA - How to Search

The \`scales\` table contains all exercises. Key columns:
- \`Type\`: Shape system. Values are like "3 notes per string scale", "2 notes per string scale", "arpeggio"
- \`root_note\`: Root note like "C", "C#", "D", "Eb", "F#", etc.
- \`tonality\`: Scale quality like "major", "minor", "dorian", "mixolydian", "dominant7"
- \`Position\`: Fretboard position 1-7 (nullable)
- \`major_key\`: The major key this belongs to (e.g., "G" for G major and E minor)
- \`scale_shape\`: Links to scale_shapes table (used for grouping)

## AVAILABLE CONTENT (NO CAGED!)
This app uses **Notes-Per-String** patterns only:
- "3 notes per string" (3nps) - most common
- "2 notes per string" (2nps)
- "4 notes per string" (4nps)
- Arpeggios

Do NOT suggest CAGED - it doesn't exist here.

## SEARCH EXAMPLES
To find C# minor 3nps scales:
  { root_note: "C#", tonality: "minor", type_filter: "3 notes per string" }

To find all major arpeggios:
  { tonality: "major", type_filter: "arpeggio" }

To find position 1 scales:
  { position: 1 }

To find everything in the key of G:
  { root_note: "G" } or search by major_key

## Workflow
1. User describes what they want to practice
2. Make ONE search call with appropriate filters
3. If results found, create module config with those shape IDs
4. If no results, tell user what's not available - don't retry

## Progression Modes
- "cycle": Rotate through all exercises (DEFAULT)
- "sequential": Complete in order, stop at end
- "focus": Auto-switch to lowest BPM exercise until target reached

## Guidelines
- Make only 1 search call per user request
- If search returns 0 results, explain what filters didn't match
- Ask clarifying questions: "3nps or 2nps?" "Which positions?"
- Be concise - guitarists want to practice, not read.
- **Always** mention note function awareness when relevant.`;

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
        const { message, conversationHistory = [] } = await req.json();

        // Build Gemini message format
        const contents = [
            // Convert conversation history
            ...conversationHistory.map((m: any) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }],
            })),
            // Add current user message
            { role: "user", parts: [{ text: message }] },
        ];

        // Get API key
        const geminiKey = Deno.env.get("GEMINI_API_KEY");
        if (!geminiKey) {
            return new Response(
                JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const toolCalls: any[] = [];
        let responseText = "";

        // Call Gemini API
        let response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents,
                    tools,
                    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 4096,
                    },
                }),
            }
        );

        let result = await response.json();

        // Handle potential errors
        if (result.error) {
            console.error("Gemini API error:", result.error);
            return new Response(
                JSON.stringify({ error: result.error.message || "Gemini API error" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Process response - handle function calls
        let maxIterations = 10; // Prevent infinite loops
        while (maxIterations > 0) {
            maxIterations--;

            const candidate = result.candidates?.[0];
            if (!candidate?.content?.parts) break;

            const parts = candidate.content.parts;

            // Check for function calls
            const functionCalls = parts.filter((p: any) => p.functionCall);

            if (functionCalls.length === 0) {
                // No function calls - extract text response
                responseText = parts
                    .filter((p: any) => p.text)
                    .map((p: any) => p.text)
                    .join("\n");
                break;
            }

            // Execute function calls
            const functionResponses = await Promise.all(
                functionCalls.map(async (fc: any) => {
                    const toolResult = await executeToolCall(
                        supabase,
                        user.id,
                        fc.functionCall.name,
                        fc.functionCall.args
                    );
                    toolCalls.push({
                        tool: fc.functionCall.name,
                        input: fc.functionCall.args,
                        result: toolResult,
                    });
                    return {
                        functionResponse: {
                            name: fc.functionCall.name,
                            response: toolResult,
                        },
                    };
                })
            );

            // Add model response and function responses to conversation
            contents.push({
                role: "model",
                parts: parts,
            });
            contents.push({
                role: "user",
                parts: functionResponses,
            });

            // Continue conversation
            response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents,
                        tools,
                        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 4096,
                        },
                    }),
                }
            );

            result = await response.json();

            if (result.error) {
                console.error("Gemini API error in loop:", result.error);
                break;
            }
        }

        return new Response(
            JSON.stringify({
                response: responseText,
                toolCalls,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("AI Coach error:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

async function executeToolCall(
    supabase: any,
    userId: string,
    toolName: string,
    input: any
): Promise<any> {
    switch (toolName) {
        case "search_scale_shapes":
            return await searchScaleShapes(supabase, input);

        case "create_module_config":
            return await createModuleConfig(input);

        case "get_practice_history":
            return await getPracticeHistory(supabase, userId, input);

        case "analyze_progress":
            return await analyzeProgress(supabase, userId, input);

        case "submit_suggestion":
            return await submitSuggestion(supabase, userId, input);

        default:
            return { error: `Unknown tool: ${toolName}` };
    }
}

async function searchScaleShapes(supabase: any, input: any) {
    try {
        // Build query against scales table
        let scalesQuery = supabase.from("scales").select("id, name, root_note, tonality, Position, Type, scale_shape, major_key");

        // Filter by type (arpeggio vs scale vs specific nps)
        if (input.type_filter) {
            // Handle common shorthand
            let typePattern = input.type_filter;
            if (typePattern === "3nps" || typePattern === "3 nps") {
                typePattern = "3 notes per string";
            } else if (typePattern === "2nps" || typePattern === "2 nps") {
                typePattern = "2 notes per string";
            } else if (typePattern === "4nps" || typePattern === "4 nps") {
                typePattern = "4 notes per string";
            }
            scalesQuery = scalesQuery.ilike("Type", `%${typePattern}%`);
        } else if (input.module_type === "arpeggio") {
            scalesQuery = scalesQuery.ilike("Type", "%arpeggio%");
        } else if (input.module_type === "scale") {
            // Exclude arpeggios when looking for scales
            scalesQuery = scalesQuery.not("Type", "ilike", "%arpeggio%");
        }

        // Filter by root note (case-insensitive, handle sharps/flats)
        if (input.root_note) {
            // Normalize: "c#" -> "C#", "db" -> "Db"
            const normalized = input.root_note.charAt(0).toUpperCase() + input.root_note.slice(1).toLowerCase();
            scalesQuery = scalesQuery.ilike("root_note", normalized);
        }

        // Filter by tonality
        if (input.tonality) {
            scalesQuery = scalesQuery.ilike("tonality", `%${input.tonality}%`);
        }

        // Filter by position
        if (input.position) {
            scalesQuery = scalesQuery.eq("Position", input.position);
        }

        // Filter by major key
        if (input.major_key) {
            scalesQuery = scalesQuery.ilike("major_key", input.major_key);
        }

        const { data: scales, error } = await scalesQuery.limit(100);

        if (error) {
            return { error: error.message, query_attempted: input };
        }

        if (!scales || scales.length === 0) {
            return {
                found: 0,
                message: "No exercises found matching criteria",
                filters_used: input,
                suggestion: "Try broadening your search. Available types: '3 notes per string', '2 notes per string', 'arpeggio'"
            };
        }

        // Get unique shape IDs for grouping
        const shapeIds = [...new Set(scales.map((s: any) => s.scale_shape).filter(Boolean))];

        // Get shape details if we have shape IDs
        let shapes: any[] = [];
        if (shapeIds.length > 0) {
            const { data: shapeData } = await supabase
                .from("scale_shapes")
                .select("id, name, intervals")
                .in("id", shapeIds);
            shapes = shapeData || [];
        }

        return {
            found: scales.length,
            unique_shapes: shapeIds.length,
            shapes: shapes.map((s: any) => ({
                shape_id: s.id,
                name: s.name,
            })),
            sample_exercises: scales.slice(0, 8).map((s: any) => ({
                name: s.name,
                root_note: s.root_note,
                tonality: s.tonality,
                position: s.Position,
                type: s.Type,
            })),
            filters_used: input,
        };
    } catch (err: any) {
        return { error: err.message };
    }
}

async function createModuleConfig(input: any) {
    const config = {
        module_type: input.module_type,
        priority_scale_shape_ids: input.priority_shape_ids,
        group_by_shape: true,
        order_by: "created_at",
        current_index: 0,
        progression_mode: input.progression_mode || "cycle",
        focus_target_bpm: input.progression_mode === "focus"
            ? (input.focus_target_bpm || 90)
            : undefined,
    };

    return {
        success: true,
        name: input.name,
        description: input.description,
        module_config: config,
        shape_count: input.priority_shape_ids.length,
        message: `Created "${input.name}" module with ${input.priority_shape_ids.length} shapes. Mode: ${input.progression_mode || "cycle"}.`,
    };
}

async function getPracticeHistory(supabase: any, userId: string, input: any) {
    try {
        const daysBack = input.days_back || 30;
        const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

        // Debug: First check if ANY practice_log entries exist for this user (no date filter)
        const { data: allUserLogs, error: countError } = await supabase
            .from("practice_log")
            .select("id, created_at")
            .eq("user_id", userId)
            .limit(5);

        let query = supabase
            .from("practice_log")
            .select("*, scales(name, Type)")
            .eq("user_id", userId)
            .gte("created_at", since)
            .order("created_at", { ascending: false });

        if (input.module_type) {
            query = query.eq("module_type", input.module_type);
        }

        const { data, error } = await query.limit(100);

        if (error) return { error: error.message, debug_user_id: userId };
        if (!data || data.length === 0) {
            return {
                message: "No practice history found for this period.",
                debug: {
                    user_id: userId,
                    since_date: since,
                    days_back: daysBack,
                    total_user_logs: allUserLogs?.length || 0,
                    oldest_log: allUserLogs?.[0]?.created_at || null,
                }
            };
        }

        const totalMinutes = Math.round(data.reduce((acc: number, d: any) => acc + (d.duration || 0), 0) / 60);
        const bpms = data.map((d: any) => d.max_bpm).filter(Boolean);
        const uniqueDays = new Set(data.map((d: any) => d.created_at.split("T")[0]));

        return {
            sessions: data.length,
            total_minutes: totalMinutes,
            days_practiced: uniqueDays.size,
            average_bpm: bpms.length > 0 ? Math.round(bpms.reduce((a: number, b: number) => a + b, 0) / bpms.length) : 0,
            max_bpm: Math.max(0, ...bpms),
            recent: data.slice(0, 5).map((d: any) => ({
                date: d.created_at.split("T")[0],
                exercise: d.scales?.name || d.module_type,
                max_bpm: d.max_bpm,
            })),
        };
    } catch (err: any) {
        return { error: err.message };
    }
}

async function analyzeProgress(supabase: any, userId: string, input: any) {
    try {
        let query = supabase
            .from("practice_log")
            .select("*, scales(name)")
            .eq("user_id", userId)
            .order("created_at", { ascending: true });

        if (input.exercise_ids?.length) {
            query = query.in("scale_id", input.exercise_ids);
        }

        const { data, error } = await query.limit(500);

        if (error) return { error: error.message };
        if (!data || data.length === 0) {
            return { message: "No practice data to analyze." };
        }

        // Group by exercise
        const byExercise: Record<string, any[]> = {};
        data.forEach((d: any) => {
            const key = d.scale_id || d.module_type || "unknown";
            if (!byExercise[key]) byExercise[key] = [];
            byExercise[key].push(d);
        });

        const progress = Object.entries(byExercise).map(([id, sessions]) => {
            const sorted = sessions.sort((a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            const firstBpm = sorted[0]?.max_bpm || 0;
            const lastBpm = sorted[sorted.length - 1]?.max_bpm || 0;

            return {
                exercise: sessions[0].scales?.name || sessions[0].module_type,
                sessions: sessions.length,
                starting_bpm: firstBpm,
                current_bpm: lastBpm,
                improvement: lastBpm - firstBpm,
            };
        });

        const needsWork = progress.filter(p => p.improvement < 10 && p.sessions > 3);
        const progressing = progress.filter(p => p.improvement >= 20);

        return {
            exercises_analyzed: progress.length,
            progress: progress.slice(0, 10),
            recommendations: {
                needs_focus: needsWork.map(p => p.exercise),
                progressing_well: progressing.map(p => p.exercise),
                suggestion: needsWork.length > 0
                    ? `Consider using Focus mode for: ${needsWork.slice(0, 3).map(p => p.exercise).join(", ")}`
                    : "Great progress! Consider adding new exercises to challenge yourself.",
            },
        };
    } catch (err: any) {
        return { error: err.message };
    }
}

async function submitSuggestion(supabase: any, userId: string, input: any) {
    try {
        const { error } = await supabase.from('suggestions').insert({
            content: input.suggestion,
            user_id: userId,
            source: 'ai_coach'
        });

        if (error) throw error;

        return {
            success: true,
            message: "Suggestion submitted successfully. Thank you for helping improve the platform!",
        };
    } catch (error: any) {
        return { error: `Failed to submit suggestion: ${error.message}` };
    }
}
