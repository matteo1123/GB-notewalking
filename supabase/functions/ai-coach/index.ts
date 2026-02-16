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
                description: "Search for scale or arpeggio shapes by criteria. Returns shape IDs that can be added to priority_scale_shape_ids.",
                parameters: {
                    type: "object",
                    properties: {
                        module_type: {
                            type: "string",
                            enum: ["scale", "arpeggio"],
                            description: "Type of exercise to search for",
                        },
                        root_note: {
                            type: "string",
                            description: "Root note like C, C#, D, etc.",
                        },
                        tonality: {
                            type: "string",
                            description: "Tonality like major, minor, dominant7, etc.",
                        },
                        position: {
                            type: "number",
                            description: "Fretboard position 1-7",
                        },
                        type_filter: {
                            type: "string",
                            description: "Type filter like '3 Notes Per String', 'CAGED', etc.",
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
        ],
    },
];

const SYSTEM_PROMPT = `You are Guitar Brain Coach, an AI assistant helping guitarists configure their practice.

## Your Primary Job
Help users configure **individual practice modules** by searching for the right exercises and creating module configs.

## Workflow
1. User describes what they want to practice
2. You search for matching scale_shapes using search_scale_shapes
3. You create a module config with those shape IDs using create_module_config
4. Present the result to the user

## Progression Modes
- "cycle": Rotate through all exercises each session (DEFAULT)
- "sequential": Complete in order, stop at end
- "focus": Auto-switch to lowest BPM exercise until it hits target (great for mastery)

## Guidelines
- Always search first before creating configs
- Ask clarifying questions if needed: "Which positions?" "What's your target BPM?"
- When user says "all positions", search for shapes in positions 1-7
- Default progression_mode to "cycle" unless user wants to master something (then "focus")
- Be concise - guitar players want to practice, not read essays
- Show what you found before creating the config`;

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

        default:
            return { error: `Unknown tool: ${toolName}` };
    }
}

async function searchScaleShapes(supabase: any, input: any) {
    try {
        // First get scales matching criteria
        let scalesQuery = supabase.from("scales").select("id, name, root_note, tonality, Position, Type, scale_shape");

        if (input.module_type === "arpeggio") {
            scalesQuery = scalesQuery.ilike("Type", "%arpeggio%");
        } else if (input.module_type === "scale") {
            scalesQuery = scalesQuery.not("Type", "ilike", "%arpeggio%");
        }

        if (input.root_note) {
            scalesQuery = scalesQuery.ilike("root_note", input.root_note);
        }

        if (input.tonality) {
            scalesQuery = scalesQuery.ilike("tonality", `%${input.tonality}%`);
        }

        if (input.position) {
            scalesQuery = scalesQuery.eq("Position", input.position);
        }

        if (input.type_filter) {
            scalesQuery = scalesQuery.ilike("Type", `%${input.type_filter}%`);
        }

        const { data: scales, error } = await scalesQuery.limit(50);

        if (error) return { error: error.message };
        if (!scales || scales.length === 0) {
            return { found: 0, message: "No exercises found matching criteria" };
        }

        // Get unique shape IDs
        const shapeIds = [...new Set(scales.map((s: any) => s.scale_shape).filter(Boolean))];

        // Get shape details
        const { data: shapes } = await supabase
            .from("scale_shapes")
            .select("id, name, intervals")
            .in("id", shapeIds);

        return {
            found: shapeIds.length,
            shapes: (shapes || []).map((s: any) => ({
                shape_id: s.id,
                name: s.name,
                intervals: s.intervals,
            })),
            sample_exercises: scales.slice(0, 5).map((s: any) => ({
                name: s.name,
                position: s.Position,
                type: s.Type,
            })),
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

        if (error) return { error: error.message };
        if (!data || data.length === 0) {
            return { message: "No practice history found for this period." };
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
