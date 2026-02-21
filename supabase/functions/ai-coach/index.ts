import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Valid module types for validation
const VALID_MODULE_TYPES = ["scale", "arpeggio", "rhythm", "notewalking", "chord_progressions", "piece_mastery", "riff", "ear_training"];

// Tool definitions for Gemini
const tools = [
    {
        functionDeclarations: [
            {
                name: "search_scale_shapes",
                description: "Search the scales database for exercises. Returns shape IDs for creating module configs. You may call this multiple times to gather different exercises (e.g., once for scales, once for arpeggios).",
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
                description: "Create a configured practice module. For scale/arpeggio modules, use shape IDs from search. For other module types (rhythm, notewalking, chord_progressions), configure directly.",
                parameters: {
                    type: "object",
                    properties: {
                        module_type: {
                            type: "string",
                            enum: ["scale", "arpeggio", "rhythm", "notewalking", "chord_progressions", "ear_training"],
                            description: "The type of practice module to create",
                        },
                        name: {
                            type: "string",
                            description: "Name for this configuration",
                        },
                        description: {
                            type: "string",
                            description: "Optional description",
                        },
                        duration_minutes: {
                            type: "number",
                            description: "Duration in minutes (default 2)",
                        },
                        // Scale/arpeggio specific
                        priority_shape_ids: {
                            type: "array",
                            items: { type: "string" },
                            description: "Array of scale_shape IDs from search results (scale/arpeggio only)",
                        },
                        progression_mode: {
                            type: "string",
                            enum: ["cycle", "sequential", "focus"],
                            description: "How to progress through exercises (scale/arpeggio only)",
                        },
                        focus_target_bpm: {
                            type: "number",
                            description: "Target BPM for focus mode (default 90)",
                        },
                        // Rhythm specific
                        rhythm_level: {
                            type: "number",
                            description: "Rhythm difficulty level 1-10 (rhythm only)",
                        },
                        // Notewalking specific
                        notewalking_key: {
                            type: "string",
                            description: "Key for notewalking (e.g., 'C', 'G') (notewalking only)",
                        },
                        notewalking_chords: {
                            type: "array",
                            items: { type: "string" },
                            description: "Chords for notewalking (e.g., ['I', 'IV', 'V']) (notewalking only)",
                        },
                        measures_per_chord: {
                            type: "number",
                            description: "Measures per chord in notewalking (default 4)",
                        },
                        // Chord progressions specific
                        progression_id: {
                            type: "string",
                            description: "Chord progression ID (chord_progressions only)",
                        },
                        chord_key: {
                            type: "string",
                            description: "Key for chord progressions (chord_progressions only)",
                        },
                        // Ear Training specific
                        root_note: {
                            type: "string",
                            description: "Root note for drone (e.g., 'C', 'G', 'F#') (ear_training only)",
                        },
                    },
                    required: ["module_type", "name"],
                },
            },
            {
                name: "get_user_routines",
                description: "Get a list of the user's saved practice routines. Returns routine names, descriptions, module counts, and IDs. Use this to see what routines the user has before modifying one.",
                parameters: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "get_routine_details",
                description: "Get the full details of a specific practice routine, including its complete session plan with all module configurations. Use this to inspect a routine before making edits.",
                parameters: {
                    type: "object",
                    properties: {
                        routine_id: {
                            type: "string",
                            description: "The UUID of the routine to inspect",
                        },
                    },
                    required: ["routine_id"],
                },
            },
            {
                name: "update_routine",
                description: "Make targeted edits to a practice routine's session plan. Supports adding, removing, or modifying individual blocks. Always call get_routine_details first to see the current state. Each edit targets one block at a time.",
                parameters: {
                    type: "object",
                    properties: {
                        routine_id: {
                            type: "string",
                            description: "The UUID of the routine to modify",
                        },
                        edits: {
                            type: "array",
                            description: "Array of edit operations to apply in order",
                            items: {
                                type: "object",
                                properties: {
                                    action: {
                                        type: "string",
                                        enum: ["add", "remove", "modify"],
                                        description: "The type of edit: add a new block, remove a block, or modify an existing block",
                                    },
                                    index: {
                                        type: "number",
                                        description: "The 0-based index of the block to remove or modify (required for remove/modify)",
                                    },
                                    position: {
                                        type: "number",
                                        description: "The position to insert the new block at (0 = beginning). Defaults to end. (add only)",
                                    },
                                    block: {
                                        type: "object",
                                        description: "The new block to add (add only). Must include module_type, config, and duration_minutes.",
                                        properties: {
                                            module_type: {
                                                type: "string",
                                                enum: ["scale", "arpeggio", "rhythm", "notewalking", "chord_progressions", "piece_mastery", "riff", "ear_training"],
                                            },
                                            config: {
                                                type: "object",
                                                description: "Module configuration. Must include module_type matching the block's module_type.",
                                            },
                                            duration_minutes: {
                                                type: "number",
                                                description: "Duration in minutes",
                                            },
                                        },
                                    },
                                    changes: {
                                        type: "object",
                                        description: "Partial changes to apply to the block (modify only). Can include duration_minutes, module_type, or config fields.",
                                        properties: {
                                            duration_minutes: {
                                                type: "number",
                                            },
                                            module_type: {
                                                type: "string",
                                                enum: ["scale", "arpeggio", "rhythm", "notewalking", "chord_progressions", "piece_mastery", "riff", "ear_training"],
                                            },
                                            config: {
                                                type: "object",
                                                description: "Replacement or partial config. If provided, replaces the entire config.",
                                            },
                                        },
                                    },
                                },
                                required: ["action"],
                            },
                        },
                        name: {
                            type: "string",
                            description: "Optional: update the routine's name",
                        },
                        description: {
                            type: "string",
                            description: "Optional: update the routine's description",
                        },
                    },
                    required: ["routine_id", "edits"],
                },
            },
            {
                name: "create_routine",
                description: "Create a brand new practice routine with multiple session blocks. Use this when the user wants a new routine from scratch or based on your recommendations. Each block needs module_type, config, and duration_minutes.",
                parameters: {
                    type: "object",
                    properties: {
                        name: {
                            type: "string",
                            description: "Name for the routine (e.g., 'Morning Warmup', 'Blues Mastery')",
                        },
                        description: {
                            type: "string",
                            description: "Optional description of the routine's goal",
                        },
                        icon: {
                            type: "string",
                            description: "Emoji icon for the routine (default: 🎸)",
                        },
                        blocks: {
                            type: "array",
                            description: "Array of session blocks that make up the routine",
                            items: {
                                type: "object",
                                properties: {
                                    module_type: {
                                        type: "string",
                                        enum: ["scale", "arpeggio", "rhythm", "notewalking", "chord_progressions", "piece_mastery", "riff", "ear_training"],
                                    },
                                    config: {
                                        type: "object",
                                        description: "Module configuration. Must include module_type matching the block's module_type.",
                                    },
                                    duration_minutes: {
                                        type: "number",
                                        description: "Duration in minutes",
                                    },
                                },
                                required: ["module_type", "duration_minutes"],
                            },
                        },
                    },
                    required: ["name", "blocks"],
                },
            },
            {
                name: "duplicate_routine",
                description: "Duplicate an existing routine with a new name (Save As). Creates a copy of the routine that can then be independently modified. Use this when the user wants to keep their original routine unchanged while creating a modified version.",
                parameters: {
                    type: "object",
                    properties: {
                        routine_id: {
                            type: "string",
                            description: "The UUID of the routine to duplicate",
                        },
                        new_name: {
                            type: "string",
                            description: "Name for the duplicated routine",
                        },
                    },
                    required: ["routine_id", "new_name"],
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
                            enum: ["scale", "arpeggio", "rhythm", "chord_progressions", "notewalking"],
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

const SYSTEM_PROMPT = `You are Guitar Brain Coach, an AI assistant helping guitarists configure and manage their practice routines.

## Your Personality & Philosophy
1. **Daily Progress on Pillars:** You believe in continuous progress on core pillars (scales, arpeggios, rhythm, notewalking, chord changes). You guide users to practice daily, tracking progress and always nudging forward. While you allow customization, you firmly guide users toward daily consistency on core skills.
2. **Extreme Note Awareness (The "Why"):** Guitarists often have the "weakest ears" because they rely on visual shapes. Unlike piano, guitarists can play blind patterns. You **strictly emphasize** awareness of every note's function (1-7) within the key context. You discourage mindless shape playing and heavily promote **"notewalking"** (practicing chord tones over changing pedal notes). Always remind users to pay attention to the intervals they are playing.

## Your Primary Jobs
1. **Search & Create**: Find exercises and create new module configurations
2. **Manage Routines**: Load, inspect, and modify the user's saved practice routines
3. **Build Routines**: Create complete new routines or duplicate existing ones for modification

## AVAILABLE MODULE TYPES
- **scale**: Scale practice (3nps, 2nps, 4nps patterns across the fretboard)
- **arpeggio**: Arpeggio practice (chord tones across fretboard positions)
- **rhythm**: 16th note strumming patterns (has levels 1-10)
- **notewalking**: Ear training with chord tone walking over pedal notes
- **chord_progressions**: Smooth chord transitions & progressions
- **piece_mastery**: Song mastery with looped practice
- **riff**: Riff practice
- **ear_training**: Dedicated ear training to identify scale degrees 1-7 over a drone

## DATABASE SCHEMA - How to Search

The \`scales\` table contains scale/arpeggio exercises. Key columns:
- \`Type\`: Shape system. Values: "3 notes per string scale", "2 notes per string scale", "arpeggio"
- \`root_note\`: Root note like "C", "C#", "D", "Eb", "F#"
- \`tonality\`: Scale quality like "major", "minor", "dorian", "mixolydian", "dominant7"
- \`Position\`: Fretboard position 1-7 (nullable)
- \`major_key\`: The parent major key (e.g., "G" for both G major and E minor)
- \`scale_shape\`: Links to scale_shapes table

## AVAILABLE CONTENT (NO CAGED!)
This app uses **Notes-Per-String** patterns only:
- "3 notes per string" (3nps) - most common
- "2 notes per string" (2nps)
- "4 notes per string" (4nps)
- Arpeggios

Do NOT suggest CAGED - it doesn't exist here.

## ROUTINE EDITING WORKFLOW
When the user wants to modify a practice routine:
1. Call \`get_user_routines\` to see what routines they have
2. Call \`get_routine_details\` to load the specific routine
3. If you need exercises for the edit, search for them (you can search multiple times)
4. Call \`update_routine\` with targeted edits (add/remove/modify individual blocks)
5. Tell the user what you changed in plain language

**IMPORTANT**: Make SMALL, TARGETED edits. Don't replace entire routines — add, remove, or modify one block at a time. This keeps changes reviewable and reversible.

## SEARCH EXAMPLES
To find C# minor 3nps scales:
  { root_note: "C#", tonality: "minor", type_filter: "3 notes per string" }

To find all major arpeggios:
  { tonality: "major", type_filter: "arpeggio" }

To find position 1 scales:
  { position: 1 }

You can make MULTIPLE searches to gather different types of content. For example, search for scales first, then arpeggios, then use both results when building a module.

## Progression Modes (scale/arpeggio only)
- "cycle": Rotate through all exercises (DEFAULT)
- "sequential": Complete in order, stop at end
- "focus": Auto-switch to lowest BPM exercise until target reached

## Guidelines
- If search returns 0 results, explain what filters didn't match
- Ask clarifying questions: "3nps or 2nps?" "Which positions?"
- Be concise - guitarists want to practice, not read.
- **Always** mention note function awareness when relevant.
- When modifying routines, tell the user exactly what you're changing before doing it.`;

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

        // Log user message asynchronously
        supabase.from('ai_coach_chats').insert({
            user_id: user.id,
            role: 'user',
            content: message
        }).then(({ error }: any) => {
            if (error) console.error("Error logging user chat:", error);
        });

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
        let maxIterations = 10; // Supports multi-step info gathering
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

        // Log assistant response asynchronously
        supabase.from('ai_coach_chats').insert({
            user_id: user.id,
            role: 'assistant',
            content: responseText,
            tool_calls: toolCalls.length > 0 ? toolCalls : null
        }).then(({ error }: any) => {
            if (error) console.error("Error logging assistant chat:", error);
        });

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
    try {
        switch (toolName) {
            case "search_scale_shapes":
                return await searchScaleShapes(supabase, input);

            case "create_module_config":
                return await createModuleConfig(input);

            case "get_user_routines":
                return await getUserRoutines(supabase, userId);

            case "get_routine_details":
                return await getRoutineDetails(supabase, userId, input);

            case "update_routine":
                return await updateRoutine(supabase, userId, input);

            case "create_routine":
                return await createRoutine(supabase, userId, input);

            case "duplicate_routine":
                return await duplicateRoutineFunc(supabase, userId, input);

            case "get_practice_history":
                return await getPracticeHistory(supabase, userId, input);

            case "analyze_progress":
                return await analyzeProgress(supabase, userId, input);

            case "submit_suggestion":
                return await submitSuggestion(supabase, userId, input);

            default:
                return { error: `Unknown tool: ${toolName}` };
        }
    } catch (err: any) {
        console.error(`Tool "${toolName}" threw an error:`, err);
        return { error: `Tool execution failed: ${err.message}` };
    }
}

// =============================================================================
// Tool Implementations
// =============================================================================

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
                suggestion: "Try broadening your search. Available types: '3 notes per string', '2 notes per string', 'arpeggio'. You can also try a different search with fewer filters."
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

function createModuleConfig(input: any) {
    const moduleType = input.module_type;
    let config: any;

    switch (moduleType) {
        case "scale":
        case "arpeggio":
            config = {
                module_type: moduleType,
                priority_scale_shape_ids: input.priority_shape_ids || [],
                group_by_shape: true,
                order_by: "created_at",
                current_index: 0,
                progression_mode: input.progression_mode || "cycle",
                focus_target_bpm: input.progression_mode === "focus"
                    ? (input.focus_target_bpm || 90)
                    : undefined,
            };
            break;

        case "rhythm":
            config = {
                module_type: "rhythm",
                rhythm_level: input.rhythm_level || 1,
                duration_minutes: input.duration_minutes || 2,
            };
            break;

        case "notewalking":
            config = {
                module_type: "notewalking",
                key: input.notewalking_key || "C",
                chords: input.notewalking_chords || ["I", "IV", "V"],
                measures_per_chord: input.measures_per_chord || 4,
            };
            break;

        case "chord_progressions":
            config = {
                module_type: "chord_progressions",
                progression_id: input.progression_id || "",
                key: input.chord_key || "C",
            };
            break;

        default:
            config = { module_type: moduleType };
    }

    return {
        success: true,
        name: input.name,
        description: input.description,
        module_config: config,
        duration_minutes: input.duration_minutes || 2,
        shape_count: input.priority_shape_ids?.length || 0,
        message: `Created "${input.name}" module (${moduleType}). Duration: ${input.duration_minutes || 2} min.${input.progression_mode ? ` Mode: ${input.progression_mode}.` : ""
            }`,
    };
}

async function getUserRoutines(supabase: any, userId: string) {
    try {
        const { data, error } = await supabase
            .from("practice_routines")
            .select("id, name, description, icon, session_plan, is_favorite, last_practiced_at, times_practiced, created_by_ai, total_duration_minutes")
            .eq("user_id", userId)
            .eq("is_active", true)
            .order("last_practiced_at", { ascending: false, nullsFirst: false });

        if (error) return { error: error.message };

        if (!data || data.length === 0) {
            return {
                routines: [],
                count: 0,
                message: "No saved routines found. You can create one with the create_module_config tool, or I can help you build one.",
            };
        }

        const routines = data.map((r: any) => {
            const plan = Array.isArray(r.session_plan) ? r.session_plan : [];
            return {
                id: r.id,
                name: r.name,
                description: r.description || null,
                icon: r.icon || "🎸",
                is_favorite: r.is_favorite || false,
                module_count: plan.length,
                modules_summary: plan.map((b: any, i: number) => ({
                    index: i,
                    module_type: b.module_type,
                    duration_minutes: b.duration_minutes,
                })),
                total_duration_minutes: r.total_duration_minutes,
                last_practiced_at: r.last_practiced_at,
                times_practiced: r.times_practiced || 0,
                created_by_ai: r.created_by_ai || false,
            };
        });

        return {
            routines,
            count: routines.length,
        };
    } catch (err: any) {
        return { error: err.message };
    }
}

async function getRoutineDetails(supabase: any, userId: string, input: any) {
    try {
        if (!input.routine_id) {
            return { error: "routine_id is required. Call get_user_routines first to see available routine IDs." };
        }

        const { data, error } = await supabase
            .from("practice_routines")
            .select("*")
            .eq("id", input.routine_id)
            .eq("user_id", userId)
            .single();

        if (error) {
            return { error: `Routine not found: ${error.message}. Call get_user_routines to see available routines.` };
        }

        const plan = Array.isArray(data.session_plan) ? data.session_plan : [];

        return {
            id: data.id,
            name: data.name,
            description: data.description || null,
            icon: data.icon || "🎸",
            is_favorite: data.is_favorite || false,
            created_by_ai: data.created_by_ai || false,
            total_duration_minutes: data.total_duration_minutes,
            last_practiced_at: data.last_practiced_at,
            times_practiced: data.times_practiced || 0,
            session_plan: plan.map((block: any, index: number) => ({
                index,
                module_type: block.module_type,
                duration_minutes: block.duration_minutes,
                config: block.config,
                order: block.order ?? index,
                conceptId: block.conceptId,
            })),
            block_count: plan.length,
        };
    } catch (err: any) {
        return { error: err.message };
    }
}

// Validate that a session block has required fields
function validateSessionBlock(block: any, context: string): string | null {
    if (!block) return `${context}: block is null or undefined`;
    if (!block.module_type) return `${context}: missing module_type`;
    if (!VALID_MODULE_TYPES.includes(block.module_type)) {
        return `${context}: invalid module_type "${block.module_type}". Must be one of: ${VALID_MODULE_TYPES.join(", ")}`;
    }
    if (typeof block.duration_minutes !== "number" || block.duration_minutes < 1) {
        return `${context}: duration_minutes must be a positive number, got ${block.duration_minutes}`;
    }
    if (!block.config) return `${context}: missing config object`;
    if (block.config.module_type && block.config.module_type !== block.module_type) {
        return `${context}: config.module_type "${block.config.module_type}" doesn't match block module_type "${block.module_type}"`;
    }
    return null; // Valid
}

async function updateRoutine(supabase: any, userId: string, input: any) {
    try {
        if (!input.routine_id) {
            return { error: "routine_id is required" };
        }
        if (!input.edits || !Array.isArray(input.edits) || input.edits.length === 0) {
            return { error: "edits array is required and must not be empty" };
        }

        // Load the current routine
        const { data: routine, error: fetchError } = await supabase
            .from("practice_routines")
            .select("*")
            .eq("id", input.routine_id)
            .eq("user_id", userId)
            .single();

        if (fetchError) {
            return { error: `Routine not found: ${fetchError.message}` };
        }

        let plan = Array.isArray(routine.session_plan) ? [...routine.session_plan] : [];
        const previousPlan = JSON.parse(JSON.stringify(plan)); // Deep copy for undo
        const editLog: string[] = [];
        const validationErrors: string[] = [];

        // Apply edits in order
        for (let i = 0; i < input.edits.length; i++) {
            const edit = input.edits[i];

            switch (edit.action) {
                case "add": {
                    if (!edit.block) {
                        validationErrors.push(`Edit ${i}: "add" action requires a "block" object`);
                        continue;
                    }

                    // Ensure config has module_type
                    const newBlock = {
                        ...edit.block,
                        config: {
                            module_type: edit.block.module_type,
                            ...(edit.block.config || {}),
                        },
                        order: 0, // Will be recalculated
                        conceptId: `ai-edit-${crypto.randomUUID()}`,
                    };

                    const addError = validateSessionBlock(newBlock, `Edit ${i} (add)`);
                    if (addError) {
                        validationErrors.push(addError);
                        continue;
                    }

                    const pos = typeof edit.position === "number"
                        ? Math.min(Math.max(0, edit.position), plan.length)
                        : plan.length;

                    plan.splice(pos, 0, newBlock);
                    editLog.push(`Added ${newBlock.module_type} block (${newBlock.duration_minutes} min) at position ${pos}`);
                    break;
                }

                case "remove": {
                    if (typeof edit.index !== "number") {
                        validationErrors.push(`Edit ${i}: "remove" action requires an "index" number`);
                        continue;
                    }
                    if (edit.index < 0 || edit.index >= plan.length) {
                        validationErrors.push(`Edit ${i}: index ${edit.index} out of range (0-${plan.length - 1})`);
                        continue;
                    }

                    const removed = plan[edit.index];
                    plan.splice(edit.index, 1);
                    editLog.push(`Removed ${removed.module_type} block from position ${edit.index}`);
                    break;
                }

                case "modify": {
                    if (typeof edit.index !== "number") {
                        validationErrors.push(`Edit ${i}: "modify" action requires an "index" number`);
                        continue;
                    }
                    if (edit.index < 0 || edit.index >= plan.length) {
                        validationErrors.push(`Edit ${i}: index ${edit.index} out of range (0-${plan.length - 1})`);
                        continue;
                    }
                    if (!edit.changes || typeof edit.changes !== "object") {
                        validationErrors.push(`Edit ${i}: "modify" action requires a "changes" object`);
                        continue;
                    }

                    const existing = plan[edit.index];
                    const changes: string[] = [];

                    if (edit.changes.duration_minutes !== undefined) {
                        changes.push(`duration: ${existing.duration_minutes} → ${edit.changes.duration_minutes} min`);
                        existing.duration_minutes = edit.changes.duration_minutes;
                    }
                    if (edit.changes.module_type !== undefined) {
                        changes.push(`type: ${existing.module_type} → ${edit.changes.module_type}`);
                        existing.module_type = edit.changes.module_type;
                    }
                    if (edit.changes.config !== undefined) {
                        existing.config = {
                            module_type: edit.changes.module_type || existing.module_type,
                            ...edit.changes.config,
                        };
                        changes.push(`config updated`);
                    }

                    const modError = validateSessionBlock(existing, `Edit ${i} (modify result)`);
                    if (modError) {
                        validationErrors.push(modError);
                        continue;
                    }

                    plan[edit.index] = existing;
                    editLog.push(`Modified block ${edit.index}: ${changes.join(", ")}`);
                    break;
                }

                default:
                    validationErrors.push(`Edit ${i}: unknown action "${edit.action}". Use "add", "remove", or "modify".`);
            }
        }

        // If there were validation errors and NO successful edits, return the errors
        if (validationErrors.length > 0 && editLog.length === 0) {
            return {
                error: "All edits failed validation",
                validation_errors: validationErrors,
                message: "Please fix the errors and try again. Check that blocks have module_type, config, and duration_minutes.",
            };
        }

        // Re-number the order field
        plan = plan.map((block: any, idx: number) => ({
            ...block,
            order: idx,
        }));

        // Calculate total duration
        const totalDuration = plan.reduce((acc: number, b: any) => acc + (b.duration_minutes || 0), 0);

        // Build update object
        const updateData: any = {
            session_plan: plan,
            total_duration_minutes: totalDuration,
        };
        if (input.name) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;

        // Save to database
        const { error: updateError } = await supabase
            .from("practice_routines")
            .update(updateData)
            .eq("id", input.routine_id);

        if (updateError) {
            return { error: `Failed to save: ${updateError.message}` };
        }

        return {
            success: true,
            routine_id: input.routine_id,
            routine_name: input.name || routine.name,
            edits_applied: editLog,
            validation_warnings: validationErrors.length > 0 ? validationErrors : undefined,
            previous_session_plan: previousPlan.map((block: any, index: number) => ({
                index,
                module_type: block.module_type,
                duration_minutes: block.duration_minutes,
                config: block.config,
            })),
            updated_session_plan: plan.map((block: any, index: number) => ({
                index,
                module_type: block.module_type,
                duration_minutes: block.duration_minutes,
                config: block.config,
            })),
            total_duration_minutes: totalDuration,
            block_count: plan.length,
            message: `Updated "${input.name || routine.name}": ${editLog.join("; ")}.${validationErrors.length > 0
                ? ` Warning: ${validationErrors.length} edit(s) had validation issues.`
                : ""
                }`,
        };
    } catch (err: any) {
        return { error: err.message };
    }
}

async function createRoutine(supabase: any, userId: string, input: any) {
    try {
        if (!input.name) {
            return { error: "name is required" };
        }
        if (!input.blocks || !Array.isArray(input.blocks) || input.blocks.length === 0) {
            return { error: "blocks array is required and must not be empty" };
        }

        // Validate all blocks
        const validationErrors: string[] = [];
        const sessionPlan = input.blocks.map((block: any, i: number) => {
            const fullBlock = {
                module_type: block.module_type,
                duration_minutes: block.duration_minutes || 10,
                config: {
                    module_type: block.module_type,
                    ...(block.config || {}),
                },
                order: i,
                conceptId: `ai-created-${crypto.randomUUID()}`,
            };

            const err = validateSessionBlock(fullBlock, `Block ${i}`);
            if (err) validationErrors.push(err);

            return fullBlock;
        });

        if (validationErrors.length > 0) {
            return {
                error: "Some blocks failed validation",
                validation_errors: validationErrors,
                message: "Fix the block errors and try again.",
            };
        }

        const totalDuration = sessionPlan.reduce((acc: number, b: any) => acc + (b.duration_minutes || 0), 0);

        const { data, error } = await supabase
            .from("practice_routines")
            .insert({
                user_id: userId,
                name: input.name,
                description: input.description || null,
                icon: input.icon || "🎸",
                session_plan: sessionPlan,
                total_duration_minutes: totalDuration,
                is_active: true,
                is_favorite: false,
                created_by_ai: true,
                times_practiced: 0,
            })
            .select()
            .single();

        if (error) {
            return { error: `Failed to create routine: ${error.message}` };
        }

        return {
            success: true,
            routine_id: data.id,
            routine_name: data.name,
            session_plan: sessionPlan.map((block: any, index: number) => ({
                index,
                module_type: block.module_type,
                duration_minutes: block.duration_minutes,
                config: block.config,
            })),
            total_duration_minutes: totalDuration,
            block_count: sessionPlan.length,
            message: `Created routine "${data.name}" with ${sessionPlan.length} blocks (${totalDuration} min total).`,
        };
    } catch (err: any) {
        return { error: err.message };
    }
}

async function duplicateRoutineFunc(supabase: any, userId: string, input: any) {
    try {
        if (!input.routine_id) {
            return { error: "routine_id is required" };
        }
        if (!input.new_name) {
            return { error: "new_name is required" };
        }

        // Load the original routine
        const { data: original, error: fetchError } = await supabase
            .from("practice_routines")
            .select("*")
            .eq("id", input.routine_id)
            .eq("user_id", userId)
            .single();

        if (fetchError) {
            return { error: `Routine not found: ${fetchError.message}` };
        }

        // Create the duplicate
        const { data, error } = await supabase
            .from("practice_routines")
            .insert({
                user_id: userId,
                name: input.new_name,
                description: original.description,
                icon: original.icon || "🎸",
                color: original.color,
                session_plan: original.session_plan,
                total_duration_minutes: original.total_duration_minutes,
                is_active: true,
                is_favorite: false,
                created_by_ai: true,
                times_practiced: 0,
            })
            .select()
            .single();

        if (error) {
            return { error: `Failed to duplicate routine: ${error.message}` };
        }

        const plan = Array.isArray(data.session_plan) ? data.session_plan : [];

        return {
            success: true,
            original_routine_id: input.routine_id,
            original_routine_name: original.name,
            new_routine_id: data.id,
            new_routine_name: data.name,
            session_plan: plan.map((block: any, index: number) => ({
                index,
                module_type: block.module_type,
                duration_minutes: block.duration_minutes,
                config: block.config,
            })),
            total_duration_minutes: data.total_duration_minutes,
            block_count: plan.length,
            message: `Duplicated "${original.name}" as "${data.name}". You can now modify the copy without affecting the original.`,
        };
    } catch (err: any) {
        return { error: err.message };
    }
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
