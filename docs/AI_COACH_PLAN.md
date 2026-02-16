# AI Coach & Practice Routines Implementation Plan

**Branch:** `ai`
**Goal:** Add AI-powered coaching, named practice routines, and smart progression
**Constraint:** Must not break the existing app on `main`
**Last Updated:** 2026-02-15

---

## Executive Summary

This plan adds three major capabilities:
1. **Named Practice Routines** - Saveable, named practice configurations users can switch between
2. **Smart Progression Modes** - Focus mode, cycle mode, sequential mode for exercise groups
3. **AI Coach** - Natural language interface for configuring practice and analyzing progress

All changes are designed to be **additive and non-breaking**.

---

## Key Design Decisions

### Simplified AI Approach

The AI works **one module at a time**, not creating entire routines from scratch:

1. User talks to AI: *"I want to practice C# minor in all positions"*
2. AI searches `scale_shapes` for C# minor shapes
3. AI returns a configured `ScaleModuleConfig` with those shape IDs in `priority_scale_shape_ids`
4. User can add that module to any routine

This approach:
- **Maximizes success rate** - AI is just populating IDs, not inventing structure
- **Uses existing data** - 99% of the work is searching and filtering
- **Aligns with existing architecture** - Module configs already support `priority_scale_shape_ids`
- **Gives user control** - User decides which routine to add the module to

### Progression Modes

The three progression modes (`cycle`, `sequential`, `focus`) apply **at the module level**, primarily for scale/arpeggio modules:

| Mode | Behavior | Best For |
|------|----------|----------|
| `cycle` | Rotate through all exercises, loop back to start | General maintenance |
| `sequential` | Complete exercises in order, stop at end | Working through a curriculum |
| `focus` | Auto-switch to lowest BPM exercise until target reached | Mastering specific shapes |

**Note:** These modes build on the existing `useExerciseQueue` hook which already handles `current_index`, `priority_scale_shape_ids`, and navigation. The modes just change how `next()` determines the next exercise.

For other module types (rhythm, notewalking, chord_progressions), these modes may have different interpretations or be ignored - this will be revisited per module.

### What Already Exists

The app already has smart progression via:
- `useExerciseQueue` hook - manages exercise ordering and navigation
- `priority_scale_shape_ids` - user-defined priority order
- `current_index` - tracks position in queue
- `sessionPlanner.ts` - curriculum-based session generation
- `user_concept_progress` - mastery tracking per concept

We are **adding to** this system, not replacing it.

---

## Current State Analysis

### Existing Architecture
- **Frontend:** React + Vite + TailwindCSS + Shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **Sessions:** `practice_sessions` table with `session_plan` JSONB array
- **Modules:** Polymorphic configs stored in `practice_log.module_config` JSONB

### Current Premium Tabs
```
[🚀 Start] [⚙️ Priorities] [📝 Recap] [🎯 Modules]
```

### Why Changes Are Non-Breaking
| Change | Impact |
|--------|--------|
| New DB table `practice_routines` | Additive - no existing code affected |
| New optional JSONB fields | Existing code ignores unknown fields |
| New Edge Function `ai-coach` | Additive - new endpoint only |
| Tab reorganization | Can be feature-flagged or done after foundation |

---

## Phase 1: Database Foundation (Non-Breaking)

### 1.1 New Table: `practice_routines`

This replaces the concept of "sessions" with named, reusable routines.

```sql
-- Migration: 20260215_add_practice_routines.sql

CREATE TABLE practice_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,

  -- Identity
  name TEXT NOT NULL,                      -- "C# Minor Mastery"
  description TEXT,                        -- "Focus on C# minor for Metallica song"
  icon TEXT DEFAULT '🎸',                  -- Emoji or icon name
  color TEXT DEFAULT 'blue',               -- Theme color for UI

  -- Practice Configuration
  session_plan JSONB NOT NULL,             -- Array of SessionBlock
  total_duration_minutes INTEGER,          -- Estimated duration

  -- Progression Settings
  progression_mode TEXT DEFAULT 'cycle',   -- 'focus' | 'cycle' | 'sequential'
  progression_state JSONB DEFAULT '{}',    -- Current state for incremental progress

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  is_favorite BOOLEAN DEFAULT false,
  last_practiced_at TIMESTAMPTZ,
  times_practiced INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- AI-generated flag
  created_by_ai BOOLEAN DEFAULT false,
  ai_prompt TEXT,                          -- Original prompt if AI-created

  CONSTRAINT valid_progression_mode CHECK (
    progression_mode IN ('focus', 'cycle', 'sequential')
  )
);

-- RLS Policy: Users can only access their own routines
ALTER TABLE practice_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own routines"
  ON practice_routines FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own routines"
  ON practice_routines FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own routines"
  ON practice_routines FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own routines"
  ON practice_routines FOR DELETE
  USING (auth.uid() = user_id);

-- Index for common queries
CREATE INDEX idx_practice_routines_user_id ON practice_routines(user_id);
CREATE INDEX idx_practice_routines_last_practiced ON practice_routines(last_practiced_at DESC);
```

### 1.2 Extended Types

Add to `src/types/practice.ts`:

```typescript
// Progression Modes
export type ProgressionMode = 'focus' | 'cycle' | 'sequential';

export interface ProgressionState {
  mode: ProgressionMode;

  // For 'focus' mode - switches to lowest performer until mastered
  exercise_progress?: {
    [exerciseId: string]: {
      max_bpm: number;
      target_bpm: number;
      last_practiced: string;
      times_practiced: number;
    };
  };
  current_focus_id?: string;
  focus_target_bpm?: number;  // e.g., 90 BPM threshold

  // For 'cycle' mode - rotates through exercises
  current_index?: number;
  exercises_order?: string[];

  // For 'sequential' mode - completes exercises in order
  completed_exercises?: string[];
}

// Named Practice Routine
export interface PracticeRoutine {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  session_plan: SessionBlock[];
  total_duration_minutes?: number;
  progression_mode: ProgressionMode;
  progression_state: ProgressionState;
  is_active: boolean;
  is_favorite: boolean;
  last_practiced_at?: string;
  times_practiced: number;
  created_at: string;
  updated_at: string;
  created_by_ai: boolean;
  ai_prompt?: string;
}

// Routine summary for lists
export interface PracticeRoutineSummary {
  id: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
  progression_mode: ProgressionMode;
  last_practiced_at?: string;
  times_practiced: number;
  is_favorite: boolean;
  module_count: number;  // Derived from session_plan.length
}
```

### 1.3 Extend Existing Module Configs (Optional Fields)

These fields are already optional in the interface, so existing code won't break:

```typescript
// Add to ScaleModuleConfig, ArpeggioModuleConfig:
export interface ScaleModuleConfig {
  // ... existing fields ...

  // NEW: Progression tracking (optional)
  progression_mode?: ProgressionMode;
  progression_state?: ProgressionState;
}
```

---

## Phase 2: AI Coach Backend

### 2.1 Architecture Decision: Supabase Edge Function + LangChain.js

```
┌─────────────────┐     ┌─────────────────────────┐     ┌──────────────┐
│   React Frontend│────▶│  Supabase Edge Function │────▶│  Claude API  │
│   (Chat UI)     │◀────│  (LangChain.js + Tools) │◀────│              │
└─────────────────┘     └─────────────────────────┘     └──────────────┘
                                    │
                                    ▼
                        ┌─────────────────────────┐
                        │   Supabase (RLS-secured)│
                        │   - scales              │
                        │   - practice_log        │
                        │   - practice_routines   │
                        └─────────────────────────┘
```

**Why this approach:**
- No additional server needed
- Uses existing Supabase infrastructure
- LangChain.js works in Deno (Edge Functions runtime)
- RLS naturally secures queries to current user
- API keys stay server-side (secure)

### 2.2 Edge Function: `ai-coach`

**Location:** `supabase/functions/ai-coach/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ChatAnthropic } from "https://esm.sh/@langchain/anthropic";
import { AgentExecutor, createToolCallingAgent } from "https://esm.sh/langchain/agents";
import { ChatPromptTemplate } from "https://esm.sh/@langchain/core/prompts";

// Tools
import { SearchExercisesTool } from "./tools/searchExercises.ts";
import { GetPracticeHistoryTool } from "./tools/getPracticeHistory.ts";
import { CreateRoutineTool } from "./tools/createRoutine.ts";
import { AnalyzeProgressTool } from "./tools/analyzeProgress.ts";
import { GetCurrentRoutinesTool } from "./tools/getCurrentRoutines.ts";

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authenticate user
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // 2. Parse request
    const { message, conversationHistory } = await req.json();

    // 3. Initialize LLM
    const llm = new ChatAnthropic({
      apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
      model: "claude-sonnet-4-20250514",
      temperature: 0.7,
    });

    // 4. Create tools with user context (RLS-secured)
    const tools = [
      new SearchExercisesTool(supabase, user.id),
      new GetPracticeHistoryTool(supabase, user.id),
      new CreateRoutineTool(supabase, user.id),
      new AnalyzeProgressTool(supabase, user.id),
      new GetCurrentRoutinesTool(supabase, user.id),
    ];

    // 5. Create agent
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", COACH_SYSTEM_PROMPT],
      ["placeholder", "{chat_history}"],
      ["human", "{input}"],
      ["placeholder", "{agent_scratchpad}"],
    ]);

    const agent = createToolCallingAgent({ llm, tools, prompt });
    const executor = new AgentExecutor({ agent, tools });

    // 6. Run agent
    const result = await executor.invoke({
      input: message,
      chat_history: conversationHistory || [],
    });

    return new Response(JSON.stringify({
      response: result.output,
      toolCalls: result.intermediateSteps,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI Coach error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
```

### 2.3 Agent Tools (Simplified Module-First Approach)

The AI's primary job is to **configure individual modules** by searching for exercises and populating the right IDs. Users then add these configured modules to their routines.

#### Tool 1: Search Scale Shapes
```typescript
// supabase/functions/ai-coach/tools/searchScaleShapes.ts

import { Tool } from "langchain/tools";
import { z } from "zod";

export class SearchScaleShapesTool extends Tool {
  name = "search_scale_shapes";
  description = `Search for scale or arpeggio shapes by criteria.
  Returns scale_shape IDs that can be added to priority_scale_shape_ids.
  Examples: "Find all C# minor shapes", "Search for position 1 major scales", "Find minor 7 arpeggios"`;

  schema = z.object({
    type: z.enum(["scale", "arpeggio"]).optional(),
    root_note: z.string().optional(),      // "C#", "G", etc.
    tonality: z.string().optional(),       // "major", "minor", "dominant7"
    position: z.number().optional(),       // 1-7
    type_filter: z.string().optional(),    // "3 Notes Per String", "CAGED"
    limit: z.number().default(20),
  });

  constructor(private supabase: any, private userId: string) {
    super();
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    // Query scale_shapes table for shape-based learning
    let query = this.supabase
      .from("scale_shapes")
      .select("id, name, scale_id, intervals, notes");

    // Also get related scale info for filtering
    const { data: shapes, error } = await query.limit(input.limit);

    if (error) return `Error searching: ${error.message}`;
    if (!shapes || shapes.length === 0) return "No shapes found matching criteria.";

    // Filter by criteria (scale_shapes may need joins for full filtering)
    // Return shape IDs and names for the AI to present to user
    return JSON.stringify({
      shapes: shapes.map(s => ({
        shape_id: s.id,
        name: s.name,
        intervals: s.intervals,
      })),
      instruction: "Use these shape_ids in priority_scale_shape_ids when creating a module config",
    });
  }
}
```

#### Tool 2: Get Practice History
```typescript
// supabase/functions/ai-coach/tools/getPracticeHistory.ts

export class GetPracticeHistoryTool extends Tool {
  name = "get_practice_history";
  description = `View the user's practice history and progress.
  Use this to understand what the user has been practicing and their BPM progress.
  The data is automatically filtered to only show this user's history.`;

  schema = z.object({
    module_type: z.enum(["scale", "arpeggio", "rhythm", "chord_progressions"]).optional(),
    exercise_id: z.string().optional(),
    days_back: z.number().default(30),
    limit: z.number().default(50),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    let query = this.supabase
      .from("practice_log")
      .select("*, scales(name, root_note, tonality)")
      .eq("user_id", this.userId)  // RLS + explicit filter
      .gte("created_at", new Date(Date.now() - input.days_back * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false });

    if (input.module_type) {
      query = query.eq("module_type", input.module_type);
    }

    if (input.exercise_id) {
      query = query.eq("scale_id", input.exercise_id);
    }

    const { data, error } = await query.limit(input.limit);

    if (error) return `Error: ${error.message}`;
    if (!data || data.length === 0) return "No practice history found for this period.";

    // Summarize
    const summary = {
      total_sessions: data.length,
      total_duration_minutes: Math.round(data.reduce((acc, d) => acc + (d.duration || 0), 0) / 60),
      exercises_practiced: [...new Set(data.map(d => d.scale_id).filter(Boolean))].length,
      max_bpm_achieved: Math.max(...data.map(d => d.max_bpm || 0)),
      recent_sessions: data.slice(0, 10).map(d => ({
        date: d.created_at,
        exercise: d.scales?.name || d.module_type,
        max_bpm: d.max_bpm,
        duration_seconds: d.duration,
      })),
    };

    return JSON.stringify(summary);
  }
}
```

#### Tool 3: Create Module Config (Primary Tool)

This is the AI's main tool - creating a configured module that the user can add to any routine.

```typescript
// supabase/functions/ai-coach/tools/createModuleConfig.ts

export class CreateModuleConfigTool extends Tool {
  name = "create_module_config";
  description = `Create a configured module based on searched shapes/exercises.
  This is the primary output - a module config the user can add to their routines.
  Use search_scale_shapes first, then create the config with those shape IDs.`;

  schema = z.object({
    module_type: z.enum(["scale", "arpeggio"]),
    name: z.string(),                              // "C# Minor All Positions"
    description: z.string().optional(),
    priority_shape_ids: z.array(z.string()),       // From search results
    type_filter: z.string().optional(),            // "3 Notes Per String"
    progression_mode: z.enum(["focus", "cycle", "sequential"]).default("cycle"),
    focus_target_bpm: z.number().optional(),       // For focus mode (default 90)
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    // Build the module config
    const config = {
      module_type: input.module_type,
      priority_scale_shape_ids: input.priority_shape_ids,
      type_filter: input.type_filter,
      group_by_shape: true,
      order_by: 'created_at' as const,
      current_index: 0,
      progression_mode: input.progression_mode,
      focus_target_bpm: input.progression_mode === 'focus'
        ? (input.focus_target_bpm || 90)
        : undefined,
    };

    // Return the config for the frontend to save/display
    // The frontend will handle saving via useModuleConfig hook
    return JSON.stringify({
      success: true,
      module_config: config,
      name: input.name,
      description: input.description,
      shape_count: input.priority_shape_ids.length,
      message: `Created "${input.name}" with ${input.priority_shape_ids.length} shapes. ` +
               `Mode: ${input.progression_mode}. ` +
               `Add this to any routine from the Routines tab.`,
    });
  }
}
```

#### Tool 4: Create Full Routine (Secondary)

For when users want a complete routine created at once.

```typescript
// supabase/functions/ai-coach/tools/createRoutine.ts

export class CreateRoutineTool extends Tool {
  name = "create_routine";
  description = `Create a complete practice routine with multiple modules.
  Use this when the user explicitly wants a full routine, not just a single module.
  Prefer create_module_config for single-module requests.`;

  schema = z.object({
    name: z.string(),
    description: z.string().optional(),
    icon: z.string().default("🎸"),
    modules: z.array(z.object({
      module_type: z.enum(["scale", "arpeggio", "rhythm", "notewalking", "chord_progressions"]),
      priority_shape_ids: z.array(z.string()).optional(),
      duration_minutes: z.number().default(5),
      progression_mode: z.enum(["focus", "cycle", "sequential"]).optional(),
    })),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const session_plan = input.modules.map((mod, i) => ({
      module_type: mod.module_type,
      config: {
        module_type: mod.module_type,
        priority_scale_shape_ids: mod.priority_shape_ids,
        progression_mode: mod.progression_mode || 'cycle',
        group_by_shape: true,
      },
      duration_minutes: mod.duration_minutes,
      order: i,
    }));

    const { data, error } = await this.supabase
      .from("practice_routines")
      .insert({
        user_id: this.userId,
        name: input.name,
        description: input.description,
        icon: input.icon,
        session_plan,
        total_duration_minutes: input.modules.reduce((acc, m) => acc + m.duration_minutes, 0),
        created_by_ai: true,
        ai_prompt: `Created routine: ${input.name}`,
      })
      .select()
      .single();

    if (error) return `Error creating routine: ${error.message}`;

    return `Created routine "${data.name}" with ${input.modules.length} modules. ` +
           `Total duration: ${data.total_duration_minutes} minutes. ` +
           `Start it from "My Routines" tab.`;
  }
}
```

#### Tool 4: Analyze Progress
```typescript
// supabase/functions/ai-coach/tools/analyzeProgress.ts

export class AnalyzeProgressTool extends Tool {
  name = "analyze_progress";
  description = `Analyze the user's progress on specific exercises or overall.
  Provides insights on BPM progression, practice consistency, and recommendations.`;

  schema = z.object({
    exercise_ids: z.array(z.string()).optional(),
    analysis_type: z.enum(["bpm_progress", "consistency", "recommendations", "all"]).default("all"),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    // Get practice history
    let query = this.supabase
      .from("practice_log")
      .select("*, scales(name)")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: true });

    if (input.exercise_ids?.length) {
      query = query.in("scale_id", input.exercise_ids);
    }

    const { data, error } = await query;
    if (error) return `Error: ${error.message}`;
    if (!data || data.length === 0) return "No practice data to analyze.";

    const analysis: any = {};

    // BPM Progress
    if (input.analysis_type === "bpm_progress" || input.analysis_type === "all") {
      const byExercise = data.reduce((acc, d) => {
        if (!d.scale_id) return acc;
        if (!acc[d.scale_id]) acc[d.scale_id] = [];
        acc[d.scale_id].push({ date: d.created_at, max_bpm: d.max_bpm });
        return acc;
      }, {} as Record<string, any[]>);

      analysis.bpm_progress = Object.entries(byExercise).map(([id, sessions]) => {
        const sorted = sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const first = sorted[0]?.max_bpm || 0;
        const last = sorted[sorted.length - 1]?.max_bpm || 0;
        return {
          exercise_id: id,
          exercise_name: data.find(d => d.scale_id === id)?.scales?.name,
          starting_bpm: first,
          current_bpm: last,
          improvement: last - first,
          sessions_count: sessions.length,
        };
      });
    }

    // Consistency
    if (input.analysis_type === "consistency" || input.analysis_type === "all") {
      const dates = [...new Set(data.map(d => d.created_at.split("T")[0]))];
      const last30Days = dates.filter(d => new Date(d) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
      analysis.consistency = {
        total_practice_days: dates.length,
        days_last_30: last30Days.length,
        consistency_percentage: Math.round((last30Days.length / 30) * 100),
      };
    }

    // Recommendations
    if (input.analysis_type === "recommendations" || input.analysis_type === "all") {
      const needsWork = analysis.bpm_progress
        ?.filter((p: any) => p.improvement < 10 && p.sessions_count > 3)
        .map((p: any) => p.exercise_name);

      const progressing = analysis.bpm_progress
        ?.filter((p: any) => p.improvement >= 20)
        .map((p: any) => p.exercise_name);

      analysis.recommendations = {
        needs_more_focus: needsWork || [],
        progressing_well: progressing || [],
        suggestion: needsWork?.length > 0
          ? `Consider using Focus mode for: ${needsWork.join(", ")}`
          : "Great progress! Consider adding new exercises.",
      };
    }

    return JSON.stringify(analysis);
  }
}
```

### 2.4 System Prompt for Coach

```typescript
const COACH_SYSTEM_PROMPT = `You are Guitar Brain Coach, an AI assistant helping guitarists configure their practice.

## Your Primary Job
Help users configure **individual practice modules** by searching for the right exercises and creating module configs. Users will then add these modules to their routines.

## Workflow
1. User describes what they want to practice
2. You search for matching scale_shapes or exercises
3. You create a module config with those shape IDs
4. User adds the module to their routine

## Your Tools
- search_scale_shapes: Find scales/arpeggios by criteria (root note, tonality, position)
- create_module_config: Create a configured module (PRIMARY OUTPUT)
- create_routine: Create a full routine (use only when explicitly requested)
- get_practice_history: View user's practice history
- analyze_progress: Analyze BPM progress and give recommendations

## Progression Modes (for scale/arpeggio modules)
- "cycle": Rotate through all exercises each session (DEFAULT)
- "sequential": Complete in order, stop at end
- "focus": Auto-switch to lowest BPM exercise until it hits target (great for mastery)

## Guidelines
- Prefer creating individual module configs over full routines
- Ask clarifying questions: "Which positions?" "What's your target BPM?"
- When user says "all positions", search for shapes in positions 1-7
- Default progression_mode to "cycle" unless user wants to master something (then "focus")
- Be concise - guitar players want to practice, not read essays
- Always show what shapes/exercises you found before creating the config`;
```

---

## Phase 3: Frontend Components

### 3.1 New Tab Structure

```
┌──────────────────────────────────────────────────────────────────┐
│  [🎸 Practice]  [📋 Routines]  [🎯 Library]  [🤖 Coach]  [📊 Progress] │
└──────────────────────────────────────────────────────────────────┘
```

| Tab | Purpose | Component |
|-----|---------|-----------|
| Practice | Quick start or pick a routine | `<PracticeStart />` |
| Routines | Named, saved practice configurations | `<MyRoutines />` |
| Library | Browse all exercises and modules | `<ModuleLibrary />` (existing) |
| Coach | AI chat interface | `<CoachChat />` |
| Progress | Analytics, history, recaps | `<ProgressDashboard />` |

### 3.2 My Routines Component

```typescript
// src/components/MyRoutines.tsx

interface MyRoutinesProps {
  onStartRoutine: (routine: PracticeRoutine) => void;
}

export function MyRoutines({ onStartRoutine }: MyRoutinesProps) {
  const [routines, setRoutines] = useState<PracticeRoutineSummary[]>([]);
  const [creating, setCreating] = useState(false);

  // Fetch routines
  useEffect(() => {
    // Load from practice_routines table
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2>My Practice Routines</h2>
        <Button onClick={() => setCreating(true)}>
          + New Routine
        </Button>
      </div>

      {/* Favorites section */}
      <section>
        <h3>Favorites</h3>
        <div className="grid grid-cols-2 gap-3">
          {routines.filter(r => r.is_favorite).map(routine => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              onStart={() => onStartRoutine(routine)}
            />
          ))}
        </div>
      </section>

      {/* All routines */}
      <section>
        <h3>All Routines</h3>
        <div className="space-y-2">
          {routines.map(routine => (
            <RoutineRow
              key={routine.id}
              routine={routine}
              onStart={() => onStartRoutine(routine)}
            />
          ))}
        </div>
      </section>

      {/* Create routine modal */}
      {creating && (
        <CreateRoutineModal onClose={() => setCreating(false)} />
      )}
    </div>
  );
}
```

### 3.3 Coach Chat Component

```typescript
// src/components/CoachChat.tsx

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: any[];
}

export function CoachChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await supabase.functions.invoke('ai-coach', {
        body: {
          message: input,
          conversationHistory: messages,
        },
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        toolCalls: data.toolCalls,
      }]);
    } catch (error) {
      console.error('Coach error:', error);
      // Show error toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Welcome message if no messages */}
      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md">
            <div className="text-6xl">🤖🎸</div>
            <h2 className="text-xl font-semibold">Guitar Brain Coach</h2>
            <p className="text-muted-foreground">
              I can help you create practice routines, analyze your progress,
              and find the right exercises for your goals.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <SuggestionChip onClick={() => setInput("Create a routine for C# minor in all positions")}>
                C# minor routine
              </SuggestionChip>
              <SuggestionChip onClick={() => setInput("Analyze my progress this month")}>
                Analyze progress
              </SuggestionChip>
              <SuggestionChip onClick={() => setInput("What scales should I practice next?")}>
                Recommendations
              </SuggestionChip>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {loading && <TypingIndicator />}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }}>
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything about your practice..."
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !input.trim()}>
              Send
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## Phase 4: Smart Progression Logic

### 4.1 Focus Mode Algorithm

```typescript
// src/lib/progressionEngine.ts

export function getNextExerciseForFocusMode(
  state: ProgressionState,
  targetBpm: number = 90
): { exerciseId: string; reason: string } | null {
  if (!state.exercise_progress) return null;

  // Find exercises below target
  const belowTarget = Object.entries(state.exercise_progress)
    .filter(([_, progress]) => progress.max_bpm < targetBpm)
    .sort((a, b) => a[1].max_bpm - b[1].max_bpm);

  if (belowTarget.length === 0) {
    return null; // All exercises at target!
  }

  const [exerciseId, progress] = belowTarget[0];

  return {
    exerciseId,
    reason: `Focusing on this exercise (${progress.max_bpm} BPM) until it reaches ${targetBpm} BPM`,
  };
}

export function updateFocusProgress(
  state: ProgressionState,
  exerciseId: string,
  newMaxBpm: number
): ProgressionState {
  return {
    ...state,
    exercise_progress: {
      ...state.exercise_progress,
      [exerciseId]: {
        ...state.exercise_progress?.[exerciseId],
        max_bpm: Math.max(state.exercise_progress?.[exerciseId]?.max_bpm || 0, newMaxBpm),
        last_practiced: new Date().toISOString(),
        times_practiced: (state.exercise_progress?.[exerciseId]?.times_practiced || 0) + 1,
      },
    },
    current_focus_id: exerciseId,
  };
}
```

### 4.2 Cycle Mode Algorithm

```typescript
export function getNextExerciseForCycleMode(
  state: ProgressionState
): { exerciseId: string; index: number } | null {
  if (!state.exercises_order?.length) return null;

  const currentIndex = state.current_index || 0;
  const nextIndex = (currentIndex + 1) % state.exercises_order.length;

  return {
    exerciseId: state.exercises_order[nextIndex],
    index: nextIndex,
  };
}

export function updateCycleProgress(
  state: ProgressionState,
  completedIndex: number
): ProgressionState {
  return {
    ...state,
    current_index: completedIndex,
  };
}
```

---

## Implementation Order

### Week 1: Foundation (Non-Breaking) - COMPLETED
- [x] Create `practice_routines` migration (`20260215000001_create_practice_routines.sql`)
- [x] Add TypeScript types for `PracticeRoutine`, `ProgressionMode`, etc. (`src/types/practice.ts`)
- [x] Add `progression_mode` and `focus_target_bpm` to `ScaleModuleConfig` and `ArpeggioModuleConfig`
- [x] Create `useRoutines` hook for CRUD operations (`src/hooks/useRoutines.ts`)
- [ ] Run migration and verify no impact on existing app

### Week 2: Routines UI
- [ ] Build `<MyRoutines />` component
- [ ] Build `<RoutineCard />` and `<RoutineRow />` components
- [ ] Build `<CreateRoutineModal />` (manual creation)
- [ ] Integrate with existing `SessionExecutor`

### Week 3: Tab Reorganization
- [ ] Refactor `Premium.tsx` with new tab structure
- [ ] Move Priorities to settings/onboarding
- [ ] Create `<ProgressDashboard />` (merge Recap + analytics)
- [ ] Add Coach tab placeholder

### Week 4: AI Coach Backend
- [ ] Create `ai-coach` Edge Function
- [ ] Implement `SearchExercisesTool`
- [ ] Implement `GetPracticeHistoryTool`
- [ ] Implement `CreateRoutineTool`
- [ ] Implement `AnalyzeProgressTool`
- [ ] Add ANTHROPIC_API_KEY to Supabase secrets

### Week 5: AI Coach Frontend
- [ ] Build `<CoachChat />` component
- [ ] Add suggestion chips for common queries
- [ ] Handle tool call results in UI
- [ ] Add loading states and error handling

### Week 6: Smart Progression
- [ ] Implement Focus mode algorithm
- [ ] Implement Cycle mode algorithm
- [ ] Add progression state updates to practice completion
- [ ] UI indicators for progression mode

---

## Environment Variables Needed

```bash
# Supabase Edge Functions
ANTHROPIC_API_KEY=sk-ant-...

# Already configured
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## Security Considerations

1. **RLS Policies**: All `practice_routines` queries filtered by `auth.uid()`
2. **Edge Function Auth**: JWT validation before any operations
3. **API Key Storage**: Anthropic key stored in Supabase secrets (not client)
4. **Tool Constraints**: All tools receive `user_id` and filter queries accordingly
5. **Rate Limiting**: Consider adding rate limits to `ai-coach` function

---

## Testing Strategy

1. **Migration Testing**: Run migration on dev, verify no breaks to existing data
2. **Tool Testing**: Unit tests for each LangChain tool
3. **Integration Testing**: E2E tests for chat flow
4. **Regression Testing**: Verify existing premium features still work

---

## Rollback Plan

Since all changes are additive:
- New table can be dropped without impact
- Edge function can be deleted without impact
- Tab changes can be reverted by restoring `Premium.tsx`
- No data migrations that alter existing schemas

---

## Open Questions

1. **Conversation History**: Store in DB or client-side only?
2. **Tool Call Visibility**: Show users what the AI is doing (searching, creating)?
3. **Rate Limits**: How many AI requests per user per day?
4. **Routine Sharing**: Should users be able to share routines publicly?
