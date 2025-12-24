# Current Database Analysis

## Existing Tables Summary

### Core Tables (10 total)

1. **exercises** (9 columns)
   - Links users to scale+sequence combinations
   - Tracks: user_id, scale_id, sequence_id, bpm, rhythm_value
   
2. **scales** (17 columns)
   - Scale definitions with notes, intervals, positions
   - Has: name, root_note, tonality, difficulty, notes_json, mode, major_key
   
3. **scale_shapes** (10 columns)
   - Physical fretboard patterns
   - Has: intervals, shape_json, root_fret, notes array
   
4. **sequences** (9 columns)
   - Practice patterns/picking sequences
   - Has: pattern_string, repetition_style, num_clicks, note_value, is_triplet
   
5. **lessons** (4 columns) 
   - Teacher-created lessons (name, created_by, created_at)
   - **CURRENTLY SIMPLE** - Just a container
   
6. **lesson_exercises** (15 columns) ⭐ KEY TABLE
   - Links lessons to exercises
   - Has: scale_id, scale_shape_id, target_bpm, metronome settings
   - **ALREADY HAS**: metronome_mode, starting_bpm, increments, measures_per_bpm, progressive_step_bpm
   - **ALREADY HAS**: target_type, time, description, display_view
   - ❌ **MISSING**: module_type, rhythm_config, notewalking_config, chord_progression_config
   
7. **practice_log** (12 columns) ⭐ KEY TABLE
   - Tracks practice sessions
   - Has: user_id, exercise_id, scale_id, scale_shape_id, duration, max_bpm, perfect_bpm
   - **ALREADY HAS**: audio (recording link!), exercise_category, name
   - ❌ **MISSING**: module_type, session_id, module_config jsonb
   
8. **profiles** (5 columns)
   - User profiles
   - Has: website, youtube, band, **settings (jsonb)** ← autoRecord already here!
   
9. **user_roles** (3 columns)
   - Role-based access (teacher/student)
   
10. **legacy_exercises** (15 columns)
    - Old exercise format (deprecated)

### Storage Buckets
- **Piano** (public)
- **practice** (private) ← for recordings

---

## Key Observations

### ✅ What's Already Built (Better Than Expected!)

1. **lesson_exercises is feature-rich!**
   - Already has metronome configuration fields
   - Already has target_type and description
   - Just needs module_type + config JSONB

2. **practice_log already tracks audio!**
   - `audio` column exists
   - `exercise_category` and `name` for categorization
   - Just needs to expand beyond exercises

3. **Auto-recording infrastructure exists**
   - Storage bucket ready
   - Settings in profiles
   - Code in RiffPractice component

### ❌ What's Missing (Smaller Gap Than I Thought!)

1. **Polymorphic support in lesson_exercises**
   - Add `module_type` column
   - Add `module_config` JSONB for flex config
   - Make `scale_id` nullable (already nullable!)

2. **Polymorphic support in practice_log**
   - Add `module_type` column  
   - Add `module_config` JSONB
   - Add `session_id` for grouping

3. **New tables needed**
   - `practice_sessions` (track 5-min blocks)
   - `lesson_progress` (student progress on lessons)
   - `chord_progressions` (chord progression library)
   - `chord_progression_progress` (tracking)

---

## Simplified Migration Plan

### Phase 1: Make Existing Tables Polymorphic (MINIMAL CHANGES)

**Migration 1: Extend lesson_exercises**
```sql
ALTER TABLE lesson_exercises
ADD COLUMN module_type TEXT CHECK (
  module_type IN ('scale', 'rhythm', 'notewalking', 'arpeggio', 'riff', 'chord_progressions')
),
ADD COLUMN module_config JSONB;

-- scale_id is already nullable! No change needed.
-- Set module_type = 'scale' for existing rows
UPDATE lesson_exercises SET module_type = 'scale' WHERE module_type IS NULL;
```

**Migration 2: Extend practice_log**
```sql
ALTER TABLE practice_log
ADD COLUMN module_type TEXT,
ADD COLUMN module_config JSONB,
ADD COLUMN session_id UUID REFERENCES practice_sessions(id);

-- Set module_type based on existing data
UPDATE practice_log 
SET module_type = CASE
  WHEN exercise_category IS NOT NULL THEN exercise_category
  WHEN scale_id IS NOT NULL THEN 'scale'
  ELSE 'unknown'
END
WHERE module_type IS NULL;
```

**Migration 3: Add practice_sessions table**
```sql
CREATE TABLE practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  total_duration_seconds INTEGER,
  session_plan JSONB, -- [{ module_type, config, duration_minutes, order }]
  completed BOOLEAN DEFAULT false
);

-- RLS
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON practice_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON practice_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON practice_sessions FOR UPDATE
  USING (auth.uid() = user_id);
```

**Migration 4: Add lesson_progress table**
```sql
CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  last_practiced TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_time_seconds INTEGER DEFAULT 0,
  exercises_completed INTEGER DEFAULT 0,
  metrics JSONB, -- { best_bpms: {}, mastery_levels: {} }
  UNIQUE(user_id, lesson_id)
);

-- RLS
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress"
  ON lesson_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON lesson_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON lesson_progress FOR UPDATE
  USING (auth.uid() = user_id);
```

**Migration 5: Extend lessons table**
```sql
ALTER TABLE lessons
ADD COLUMN description TEXT,
ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
ADD COLUMN target_level INTEGER DEFAULT 1,
ADD COLUMN estimated_duration_minutes INTEGER;
```

**Migration 6: Add chord_progressions table**
```sql
CREATE TABLE chord_progressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  progression TEXT NOT NULL, -- "I-IV-V-I"
  key TEXT NOT NULL,
  genre TEXT,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 10),
  chords JSONB NOT NULL, -- [{ numeral, name, voicing_type, frets, fingers, notes }]
  measures_per_chord INTEGER DEFAULT 1,
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE chord_progressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public progressions viewable by all"
  ON chord_progressions FOR SELECT
  USING (is_public = true OR auth.uid() = created_by);

CREATE POLICY "Users can create progressions"
  ON chord_progressions FOR INSERT
  WITH CHECK (auth.uid() = created_by);
```

**Migration 7: Add chord_progression_progress table**
```sql
CREATE TABLE chord_progression_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  progression_id UUID NOT NULL REFERENCES chord_progressions(id) ON DELETE CASCADE,
  max_clean_bpm INTEGER DEFAULT 0,
  time_practiced_seconds INTEGER DEFAULT 0,
  last_practiced TIMESTAMPTZ,
  mastery_level DECIMAL(3,2) DEFAULT 0.00,
  UNIQUE(user_id, progression_id)
);

-- RLS
ALTER TABLE chord_progression_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chord progress"
  ON chord_progression_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own chord progress"
  ON chord_progression_progress FOR ALL
  USING (auth.uid() = user_id);
```

---

## Summary: Database Changes Required

### Extend Existing (3 tables)
1. `lesson_exercises` - Add 2 columns (module_type, module_config)
2. `practice_log` - Add 3 columns (module_type, module_config, session_id)
3. `lessons` - Add 4 columns (description, status, target_level, estimated_duration_minutes)

### New Tables (4 tables)
1. `practice_sessions` - Group practice into sessions
2. `lesson_progress` - Track student progress on lessons
3. `chord_progressions` - Library of chord progressions
4. `chord_progression_progress` - Track mastery

### Total Changes
- **7 migrations total**
- **3 tables extended** (minor changes)
- **4 new tables**
- **All with RLS policies**

This is MUCH simpler than the original plan because so much already exists!
