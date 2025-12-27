# TempoTrekker Technical Architecture

**Complete System Documentation**

Last Updated: December 26, 2024

---

## 🗺️ Table of Contents

1. [System Overview](#system-overview)
2. [Core Concepts](#core-concepts)
3. [Exercise Engine](#exercise-engine)
4. [Data Model](#data-model)
5. [Module System](#module-system)
6. [Progressive Practice System](#progressive-practice-system)
7. [Critical Relationships](#critical-relationships)

---

## System Overview

TempoTrekker is a **generative guitar practice system** with three key innovations:

1. **Scale Shape Generator**: User-defined shapes generalized to all keys
2. **Sequence Engine**: Real-time rendering of note patterns
3. **Intelligent Progression**: Adaptive difficulty based on performance

```
User Input → Scale Shape → Sequence → Rendered Exercise → Performance Tracking
```

---

## Core Concepts

### The Triadic Exercise Model

Every exercise has **three components**:

```
EXERCISE = SCALE SHAPE + SEQUENCE + KEY
```

#### 1. Scale Shape (What to play)
- **Definition**: A template of fret positions relative to a root note
- **Types**: 
  - 3 Notes Per String (3nps)
  - 4 Notes Per String (4nps)
  - 2 Notes Per String (2nps)
  - Arpeggios
  - Chords
  - CAGED patterns (future)
- **Generalizable**: One shape works in all 12 keys
- **Storage**: `scales` table

#### 2. Sequence (How to play it)
- **Definition**: Pattern of indices that determine note order
- **Example**: `[1, 2, 3, 2, 3, 4, 3, 4, 5...]`
- **Type-Specific**: A 3nps sequence only works with 3nps shapes
- **Purpose**: Creates musical patterns from static shapes
- **Storage**: `sequences` table

#### 3. Key (Where to play it)
- **Definition**: The root note (C, D, E, etc.)
- **Dynamic**: Changed at runtime via `tonic` field
- **Transposition**: Shape + Sequence stay constant, only root changes

### Real-Time Rendering

**The engine NEVER stores pre-rendered exercises.** Instead:

```typescript
function renderExercise(scaleShape, sequence, key) {
  // 1. Get shape intervals (relative to root)
  const intervals = scaleShape.intervals; // [0, 2, 4, 5, 7, 9, 11]
  
  // 2. Apply key transposition
  const actualNotes = intervals.map(i => transposeNote(key, i));
  
  // 3. Apply sequence pattern
  const renderedNotes = sequence.pattern.map(index => {
    return actualNotes[index - 1]; // Sequence uses 1-indexed
  });
  
  // 4. Map to fretboard positions
  return renderedNotes.map(note => getFretPosition(note, tuning));
}
```

This means:
- **One scale shape** = 12 exercises (one per key)
- **Add a sequence** = 12x more exercises
- **Infinite combinations** without database bloat

---

## Exercise Engine

### Component Architecture

```
┌─────────────────────────────────────────────┐
│          Exercise Generator                 │
├─────────────────────────────────────────────┤
│                                             │
│  Input: { scale_id, sequence_id, key }     │
│                                             │
│  Process:                                   │
│  1. Fetch scale shape                       │
│  2. Fetch sequence                          │
│  3. Validate compatibility (type match)     │
│  4. Render notes                            │
│  5. Display on fretboard                    │
│                                             │
│  Output: Interactive fretboard + metronome  │
└─────────────────────────────────────────────┘
```

### Type System

**Exercise Types** (enum in database):
- `scale` - Melodic patterns
- `arpeggio` - Broken chords
- `riff` - Complete musical phrases
- `chord` - Harmonic structures

**Scale Types** (more specific):
- `2 notes per string scale`
- `3 notes per string scale`
- `4 notes per string scale`
- `arpeggio`
- `chord`

**Critical Rule:** 
```
sequence.compatible_with === scale.Type
```

If violated → Exercise won't render correctly

---

## Data Model

### Core Tables

#### `scales` (The Shape Library)
```sql
CREATE TABLE scales (
  id UUID PRIMARY KEY,
  name TEXT,                    -- "G Major Pentatonic Pos 1"
  Type TEXT,                    -- "3 notes per string scale"
  root_note TEXT,               -- "G"
  tonality TEXT,                -- "major"
  mode TEXT,                    -- "ionian", "dorian", etc.
  Position INTEGER,             -- 1-5 (fretboard position)
  
  -- The core data
  intervals INTEGER[],          -- [0, 2, 4, 5, 7, 9, 11]
  notes TEXT[],                 -- Current implementation (to deprecate?)
  notes_json JSONB,             -- { fret, string }[]
  
  -- Metadata
  difficulty INTEGER,           -- 1-10
  major_key TEXT,               -- Parent key
  is_public BOOLEAN,
  created_by UUID,
  created_at TIMESTAMPTZ
);
```

**Key Insight:** `intervals` allows transposition, `notes_json` is the fretboard layout

#### `sequences` (The Pattern Library)
```sql
CREATE TABLE sequences (
  id UUID PRIMARY KEY,
  name TEXT,                    -- "Ascending 3-note groups"
  pattern INTEGER[],            -- [1, 2, 3, 2, 3, 4, 3, 4, 5...]
  compatible_type TEXT,         -- "3 notes per string scale"
  
  -- Performance tracking
  notes_per_click DECIMAL,      -- NEW: For ranking difficulty
  
  -- Metadata
  difficulty INTEGER,
  description TEXT,
  is_public BOOLEAN,
  created_by UUID
);
```

**Notes Per Click:**
- Measures actual speed requirement
- Used for intelligent progression
- Example: 16th notes at 120 BPM = 8 notes per beat = higher difficulty than quarter notes

#### `exercises` (Legacy - Being Deprecated?)
```sql
CREATE TABLE exercises (
  id UUID PRIMARY KEY,
  name TEXT,
  scale_id UUID REFERENCES scales(id),
  sequence_id UUID REFERENCES sequences(id),
  user_id UUID,
  
  -- Config
  bpm INTEGER,
  rhythm_value INTEGER,         -- Notes per beat
  
  created_at TIMESTAMPTZ
);
```

**Status:** Appears to be pre-compiled exercises. May be deprecated in favor of real-time generation.

#### `practice_log` (Performance Tracking)
```sql
CREATE TABLE practice_log (
  id SERIAL PRIMARY KEY,
  user_id UUID,
  session_id UUID,              -- NEW: Links to practice_sessions
  
  -- Polymorphic module reference
  module_type TEXT,             -- 'rhythm', 'scale', 'arpeggio', etc.
  module_config JSONB,          -- Module-specific data
  
  -- Legacy fields (still used)
  scale_id UUID,
  exercise_category TEXT,
  
  -- Performance metrics
  max_bpm INTEGER,
  duration INTEGER,             -- seconds
  audio TEXT,                   -- Recording URL
  
  created_at TIMESTAMPTZ
);
```

**Evolution:** Moving from specific IDs to polymorphic `module_type` + `module_config`

#### `practice_sessions` (NEW - Session Tracking)
```sql
CREATE TABLE practice_sessions (
  id UUID PRIMARY KEY,
  user_id UUID,
  lesson_id UUID,               -- Teacher-assigned
  routine_id UUID,              -- User-created routine
  
  -- Session plan
  session_plan JSONB,           -- Array of SessionBlock
  total_duration_seconds INTEGER,
  
  -- Execution
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  completed BOOLEAN,
  
  created_at TIMESTAMPTZ
);
```

**Purpose:** Tracks planned vs actual practice

### Supporting Tables

#### `chord_progressions`
```sql
CREATE TABLE chord_progressions (
  id UUID PRIMARY KEY,
  name TEXT,                    -- "I-IV-V in C"
  key TEXT,                     -- "C"
  chords JSONB,                 -- [{ name, diagram }]
  measures_per_chord INTEGER,   -- 4
  difficulty INTEGER,
  genre TEXT,                   -- "Jazz", "Blues", etc.
);
```

#### `user_priorities` (NEW - Intelligent Practice)
```sql
CREATE TABLE user_priorities (
  id UUID PRIMARY KEY,
  user_id UUID,
  
  -- Priority definition
  type TEXT,                    -- 'module' or 'specific'
  weight INTEGER,               -- 1-10
  module_type TEXT,             -- For module-level
  exercise_id TEXT,             -- For specific goals
  
  -- Target & progress
  target_metric JSONB,          -- { target_bpm: 120 }
  current_progress JSONB,       -- { current_bpm: 85 }
  last_practiced TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

## Module System

### The Six Practice Modules

#### 1. **Rhythm Training**
- **Purpose**: 16th note strumming patterns
- **Levels**: 1-50 (increasing complexity)
- **Progression**: Linear levels
- **Config**: `{ rhythm_level: 8 }`

#### 2. **Scale Practice**
- **Purpose**: Fretboard knowledge
- **Content**: Uses `scales` table
- **Sequence-Driven**: YES
- **Config**: `{ scale_id, sequence_id, key }`

#### 3. **Arpeggio Practice**
- **Purpose**: Chord tones & sweep picking
- **Content**: Uses `scales` table (Type = "arpeggio")
- **Sequence-Driven**: YES
- **Config**: `{ scale_id, sequence_id, key }`

#### 4. **Notewalking (Ear Training)**
- **Purpose**: Sing chord changes
- **Content**: Uses `chord_progressions` table
- **Unique**: Pitch detection + audio playback
- **Config**: `{ progression_id }`

#### 5. **Chord Changes** (Planned)
- **Purpose**: Smooth transitions
- **Content**: Uses `chord_progressions` + `scales` (Type = "chord")
- **Sequence-Driven**: MAYBE (rhythmic patterns?)
- **Config**: TBD

#### 6. **Repertoire (R

iffs)**
- **Purpose**: Learn songs
- **Content**: Uses `legacy_exercises` or new system
- **Sequence-Driven**: NO (pre-composed)
- **Config**: `{ riff_id }`

### Module Standardization

All modules implement:
```typescript
interface PracticeModuleProps {
  mode: 'freeplay' | 'routine' | 'goal';
  onComplete?: (results: ModuleResults) => void;
  config?: ModuleConfig;
  timeLimit?: number;
}
```

---

## Progressive Practice System

### Ranking Algorithm

**Goal:** Identify which exercises need work

**Metric:** Notes per second at current max BPM

```typescript
function calculateNotesPerSecond(exercise) {
  const bpm = exercise.max_bpm || 60;
  const notesPerBeat = exercise.sequence.notes_per_click;
  
  // BPM = beats per minute
  // Convert to beats per second: BPM / 60
  // Multiply by notes per beat
  return (bpm / 60) * notesPerBeat;
}
```

**Example:**
- Exercise A: 120 BPM, 4 notes per beat = 8 notes/sec
- Exercise B: 100 BPM, 1 note per beat = 1.67 notes/sec
- **Exercise B needs focus!**

### Threshold System

**Graduation Criteria:**
- Maintain 10 BPM above target for 3 consecutive sessions
- Clean execution (no errors)
- Recorded performance available

**Warm-up vs Focus:**
- **Focus**: Exercises below threshold
- **Warm-up**: Exercises at or above threshold

### Session Generation

```typescript
function intelligentSession(userPriorities, duration) {
  // 1. Get all user exercises
  const exercises = getAllUserExercises();
  
  // 2. Calculate notes/sec for each
  const ranked = exercises.map(ex => ({
    ...ex,
    notesPerSec: calculateNotesPerSecond(ex)
  })).sort((a, b) => a.notesPerSec - b.notesPerSec);
  
  // 3. Split into focus (bottom) and warmup (top)
  const focusExercises = ranked.slice(0, ranked.length * 0.7);
  const warmupExercises = ranked.slice(ranked.length * 0.7);
  
  // 4. Allocate time based on priorities
  const blocks = [];
  
  // Warm-up: 10%
  blocks.push({
    type: 'warmup',
    exercise: pickRandom(warmupExercises),
    duration: duration * 0.1
  });
  
  // Focus: 90% (weighted by priorities)
  for (const priority of userPriorities) {
    const timeShare = (priority.weight / totalWeight) * duration * 0.9;
    const focusInThisPriority = focusExercises.filter(
      ex => ex.module_type === priority.module_type
    );
    blocks.push({
      type: 'priority',
      exercise: focusInThisPriority[0], // Weakest in this category
      duration: timeShare
    });
  }
  
  return blocks;
}
```

---

## Critical Relationships

### Exercise Generation Flow

```
User wants to practice → Pick module → Get config

IF module is scale/arpeggio:
  1. User selects scale (or system picks based on ranking)
  2. User selects sequence (or system picks)
  3. User selects key (or system picks)
  4. Engine renders: scale.intervals + sequence.pattern + key
  5. Display on fretboard with metronome
  6. Track performance → practice_log

IF module is rhythm:
  1. Determine level (from progress or priority)
  2. Load rhythm pattern for level
  3. Display strumming diagram with metronome
  4. Track performance → practice_log

IF module is notewalking:
  1. Pick chord progression
  2. Play progression audio
  3. User sings chord tones
  4. Pitch detection validates
  5. Track performance → practice_log
```

### Data Dependencies

```
scales
  └─ sequences (must match Type)
      └─ exercises (combines scale + sequence)
          └─ practice_log (performance data)
              └─ analyses which exercises need work
                  └─ feeds into session generator
                      └─ creates practice_sessions
```

### Type Compatibility Matrix

| Scale Type | Compatible Sequences |
|------------|---------------------|
| `3 notes per string scale` | Sequences where `compatible_type = "3 notes per string scale"` |
| `4 notes per string scale` | Sequences where `compatible_type = "4 notes per string scale"` |
| `arpeggio` | Sequences where `compatible_type = "arpeggio"` |
| `chord` | Sequences where `compatible_type = "chord"` (or maybe rhythms?) |

**Never mix types!** A 3nps sequence applied to a 4nps scale = broken exercise

---

## Important Implementation Notes

### 1. Sequences Store Indices, Not Notes
```javascript
// WRONG
sequence.pattern = ['C', 'D', 'E', 'D', 'E', 'F'];

// RIGHT
sequence.pattern = [1, 2, 3, 2, 3, 4];
```

Why? Because the actual notes come from `scale.intervals + key`

### 2. Notes Per Click is Critical
```javascript
// Store this in sequences table
sequence.notes_per_click = 4; // For 16th notes
sequence.notes_per_click = 1; // For quarter notes
sequence.notes_per_click = 3; // For triplets
```

This + BPM = actual speed requirement

### 3. Module Config is Polymorphic
```typescript
// Don't hardcode scale_id in practice_log
// Instead:
{
  module_type: 'scale',
  module_config: {
    scale_id: '...',
    sequence_id: '...',
    key: 'G'
  }
}
```

### 4. Lessons vs Sessions
- **Lesson**: Teacher-created collection of exercises
- **Session**: System-generated practice plan
- Both can use same underlying engine!

---

## Future Considerations

### Chord Progressions Module

**Challenge:** How do sequences apply to chords?

**Option A:** Rhythmic patterns
```javascript
sequence.pattern = [1, 2, 2, 3, 3, 4]; // Strum pattern
chordProgression.chords = ['C', 'F', 'G', 'C'];
// Result: C(downup) F(updown) G(updown) C
```

**Option B:** Voicing patterns
```javascript
sequence.pattern = [1, 3, 5, 8]; // Chord tones to emphasize
chord.notes = ['C', 'E', 'G', 'B']; // Cmaj7
// Result: Play C → G → B → C (octave up)
```

**Decision:** TBD - needs user testing

### CAGED System Integration

- Another `Type`: "CAGED pattern"
- Links shapes across positions
- Sequences could navigate between positions?

### AI-Generated Sequences

- Analyze user weaknesses
- Generate custom sequences to target specific finger combinations
- Store as new sequence in database

---

## Summary

**The Golden Rule:**

> TempoTrekker is NOT a static exercise database.  
> It's a GENERATIVE system that combines shapes, patterns, and keys to create infinite practice variations while tracking user progress to intelligently select what to practice next.

**Key Relationships:**
1. `Scale Shape` + `Sequence` + `Key` = `Exercise`
2. `Exercise` + `BPM` + `Performance` = `practice_log` entry
3. `practice_log` metrics + `user_priorities` = `Session Plan`
4. `Session Plan` → User practices → `practice_log` → Repeat

**Before Making Changes:**
1. Check type compatibility
2. Ensure sequence indices match scale structure
3. Verify module_type is consistent
4. Update both database AND UI
5. Test rendering pipeline

---

*This document is the source of truth for TempoTrekker's architecture. Update it when the system evolves.*
