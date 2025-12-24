# Revised Implementation Plan Based on Existing Schema

## Current Database Schema (From Migrations)

### Existing Tables:
1. **profiles** - User profiles (website, youtube, band)
2. **scales** - Scale definitions (name, tonic, tonality, position, difficulty, notes_json)
3. **scale_shapes** - Physical patterns on fretboard
4. **sequences** - Practice patterns (pattern_string, repetition_style, num_clicks)
5. **exercises** - User exercises (user_id, scale_id, sequence_id, bpm, rhythm_value)
6. **lessons** - Teacher-created lessons (name, created_by)
7. **lesson_exercises** - Links lessons to exercises (lesson_id, scale_id, scale_shape_id, target_bpm, order)
8. **practice_log** - Practice tracking (user_id, exercise_id, scale_id, scale_shape_id, duration, max_bpm, perfect_bpm)

### Existing Features:
- ✅ Auto-recording already working (in RiffPractice/Scales)
- ✅ Practice logging (time, BPM tracking)
- ✅ Lessons system (teacher creates, assigns exercises)
- ✅ Storage bucket ('practice') for recordings
- ✅ User settings (autoRecord flag in profiles)

## What's Missing for Your Vision:

### 1. Lessons Currently Only Support Scales
**Problem**: `lesson_exercises` only has `scale_id` and `scale_shape_id`
**Solution**: Need to make it polymorphic to support rhythms, notewalking, arpeggios

### 2. No Goal/Progress Tracking
**Problem**: Lessons don't track completion or progress toward goals
**Solution**: Need goal status and progress metrics

### 3. No Session Planning Algorithm
**Problem**: No way to automatically plan "5 minutes of this, 5 minutes of that"
**Solution**: Need session planner + active session tracking

### 4. Practice Log is Exercise-Only
**Problem**: `practice_log` is tied to exercises, not rhythms/notewalking
**Solution**: Make it polymorphic or add separate tracking

---

## Minimal Database Changes Needed

### Option A: Extend Existing Tables (Recommended)

#### 1. Make `lesson_exercises` Polymorphic
```sql
ALTER TABLE lesson_exercises
ADD COLUMN module_type TEXT CHECK (module_type IN ('scale', 'rhythm', 'notewalking', 'arpeggio', 'riff', 'chord_progressions')),
ADD COLUMN module_config JSONB; -- Flexible config for each module type

-- Now scale_id becomes optional
ALTER TABLE lesson_exercises ALTER COLUMN scale_id DROP NOT NULL;
```

**Module Config Examples:**
```json
// Scale
{ "scale_id": "uuid", "scale_shape_id": "uuid" }

// Rhythm
{ "rhythm_level": 5, "duration_minutes": 5 }

// Notewalking (ear training over changes)
{ "key": "C", "chords": ["I", "IV", "V"], "measures_per_chord": 4 }

// Chord Progressions (learning shapes and changes)
{ 
  "progression_name": "I-IV-V-I",
  "key": "C", 
  "chord_shapes": ["open", "barre"], 
  "difficulty": 3,
  "target_bpm": 60 // For smooth changes
}

// Arpeggio
{ "arpeggio_id": "uuid", "pattern": "ascending" }

// Riff
{ "repertoire_id": "uuid", "target_bpm": 120 }
```

#### 2. Add Goal Tracking to Lessons
```sql
ALTER TABLE lessons
ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
ADD COLUMN target_level INTEGER DEFAULT 1,
ADD COLUMN description TEXT;

-- Track student progress on lessons
CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id),
  lesson_id UUID NOT NULL REFERENCES lessons(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  last_practiced TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metrics JSONB, -- { time_practiced_minutes, exercises_completed, best_bpms }
  UNIQUE(student_id, lesson_id)
);
```

#### 3. Make `practice_log` Polymorphic
```sql
ALTER TABLE practice_log
ADD COLUMN module_type TEXT,
ADD COLUMN module_config JSONB, -- What was practiced
ADD COLUMN recording_url TEXT; -- Link to auto-recording

-- exercise_id already nullable from previous migration
```

#### 4. Add Practice Sessions
```sql
CREATE TABLE practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  total_duration_minutes INTEGER,
  lesson_id UUID REFERENCES lessons(id), -- Optional: if session is for a specific lesson
  session_plan JSONB -- [{ module_type, config, duration_minutes, order }]
);

-- Link practice_log entries to sessions
ALTER TABLE practice_log
ADD COLUMN session_id UUID REFERENCES practice_sessions(id);
```

---

## Revised Implementation Phases

### Phase 1: Extend Database (1 week)
**Goal**: Make existing tables support all module types

- [ ] Run migration to make `lesson_exercises` polymorphic
- [ ] Run migration to add `lesson_progress` table
- [ ] Run migration to make `practice_log` polymorphic
- [ ] Run migration to add `practice_sessions` table
- [ ] Update TypeScript types to match new schema

### Phase 2: Reuse Auto-Recording (3 days)
**Goal**: Extract auto-recording from RiffPractice, make it reusable

- [ ] Create `useAutoRecording` hook (extract from RiffPractice)
- [ ] Add auto-recording to RhythmTraining component
- [ ] Add auto-recording to ChordProgressionExercise (Notewalking)
- [ ] Save recordings to `practice_log.recording_url`

### Phase 3: Module Tracking (1 week)
**Goal**: Log practice for all modules

- [ ] Add practice logging to RhythmTraining
- [ ] Add practice logging to ChordProgressionExercise
- [ ] Update existing scale logging to use new schema
- [ ] Create unified `usePracticeTracking` hook

### Phase 4: Session Planning (1 week)
**Goal**: Build intelligent session planner

- [ ] Create session planning algorithm
- [ ] Build `PracticeSessionManager` component
- [ ] Create session progress UI
- [ ] Add "Start Today's Practice" flow

### Phase 5: Teacher UI Updates (1 week)
**Goal**: Allow teachers to create multi-module lessons

- [ ] Update `LessonBuilder` to support all module types
- [ ] Add rhythm/notewalking configuration UI
- [ ] Update lesson listing to show module diversity
- [ ] Add goal/level selection

### Phase 6: Student Dashboard (1 week)
**Goal**: Show students their progress and goals

- [ ] Lesson progress dashboard
- [ ] Goal completion tracking
- [ ] Recording review interface
- [ ] Practice history visualization

---

## Key Insights from Existing Code

### Auto-Recording Flow (from RiffPractice)
```typescript
1. User enables autoRecord setting
2. On practice start, schedule random recording (30-90 clicks)
3. Show countdown when approaching
4. Auto-start recording at scheduled time
5. Record for configured duration
6. Auto-save to supabase storage
7. Link recording to practice log entry
```

### This is Already Built! Just need to:
- Extract it to a hook
- Add to other modules
- Link to practice_log table

---

## Recommended Next Steps

1. **Run the schema query** I provided to confirm current state
2. **Create the database migrations** for polymorphic tables
3. **Extract auto-recording** to reusable hook
4. **Add tracking to Rhythms & Notewalking**
5. **Build session planner** later

Sound good?
