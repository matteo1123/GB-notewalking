# Database Migration Summary

## ✅ All 7 Migration Files Created!

Location: `supabase/migrations/`

### Migration Order (Run in sequence)

1. **20251224000001_make_lesson_exercises_polymorphic.sql**
   - Adds `module_type` and `module_config` to `lesson_exercises`
   - Sets existing records to `module_type = 'scale'`
   
2. **20251224000002_make_practice_log_polymorphic.sql**
   - Adds `module_type` and `module_config` to `practice_log`
   - Backfills module_type from existing data
   
3. **20251224000003_create_practice_sessions.sql**
   - Creates `practice_sessions` table
   - Links `practice_log` via new `session_id` column
   - Adds RLS policies and indexes
   
4. **20251224000004_create_lesson_progress.sql**
   - Creates `lesson_progress` table
   - Tracks student progress on lessons
   - Adds RLS (students see own, teachers see their lessons)
   
5. **20251224000005_extend_lessons.sql**
   - Adds `description`, `status`, `target_level`, `estimated_duration_minutes`
   - Sets defaults for existing lessons
   
6. **20251224000006_create_chord_progressions.sql**
   - Creates `chord_progressions` table
   - Library of progressions with chord shapes
   - Public/private with RLS
   
7. **20251224000007_create_chord_progression_progress.sql**
   - Creates `chord_progression_progress` table
   - Tracks BPM, mastery level, practice time

---

## How to Apply Migrations

### Option 1: Supabase CLI (Recommended)
```bash
cd "c:\Users\matth\Documents\coding projects\August 25\tempo-trekker"
supabase db push
```

### Option 2: Supabase Dashboard
1. Go to your Supabase project → SQL Editor
2. Copy each migration file contents
3. Run them **in order** (1 through 7)

### Option 3: Local Supabase (if running locally)
```bash
supabase migration up
```

---

## What's Now Possible

### ✅ Multi-Module Lessons
Teachers can create lessons with:
- Scales/arpeggios (existing)
- Rhythm training patterns
- Notewalking exercises
- Chord progressions
- Riffs

### ✅ Smart Practice Sessions
App can generate sessions like:
- 5 min scales
- 5 min rhythm level 3
- 5 min notewalking in C
- 5 min chord changes I-IV-V

### ✅ Complete Progress Tracking
- Practice log works for ALL modules
- Lesson progress shows overall completion
- Module-specific progress (e.g., chord max BPM)

### ✅ Auto-Recording for All
- practice_log.audio links recordings
- Tied to specific modules
- Works across all practice types

---

## Database Schema (After Migrations)

### Tables (14 total)
**Existing (extended):**
1. lesson_exercises → now polymorphic
2. practice_log → now polymorphic  
3. lessons → goal tracking fields

**New:**
4. practice_sessions
5. lesson_progress
6. chord_progressions
7. chord_progression_progress

**Unchanged:**
8. exercises
9. scales
10. scale_shapes
11. sequences
12. profiles
13. user_roles
14. legacy_exercises

---

## Next Steps After Migration

### 1. Update TypeScript Types
Create/update types to match new schema:
- `src/types/practice.ts` (new file)
- `src/types/lessons.ts` (update)

### 2. Extract Auto-Recording Hook
- Create `src/hooks/useAutoRecording.ts`
- Extract from RiffPractice component

### 3. Add Tracking to Modules
- RhythmTraining → log to practice_log
- ChordProgressionExercise → log to practice_log

### 4. Build Session Planner
- Algorithm to generate session plans
- UI to start guided sessions

### 5. Teacher UI Updates
- Lesson builder supports all modules
- Can assign rhythms, notewalking, etc.

---

## Rollback Plan (If Needed)

If issues occur, migrations can be rolled back in reverse order:

```sql
-- 7. Drop chord progression progress
DROP TABLE IF EXISTS chord_progression_progress CASCADE;

-- 6. Drop chord progressions
DROP TABLE IF EXISTS chord_progressions CASCADE;

-- 5. Remove lesson extensions
ALTER TABLE lessons DROP COLUMN description, DROP COLUMN status, DROP COLUMN target_level, DROP COLUMN estimated_duration_minutes;

-- 4. Drop lesson progress
DROP TABLE IF EXISTS lesson_progress CASCADE;

-- 3. Drop practice sessions
ALTER TABLE practice_log DROP COLUMN session_id;
DROP TABLE IF EXISTS practice_sessions CASCADE;

-- 2. Remove practice_log polymorphic columns
ALTER TABLE practice_log DROP COLUMN module_type, DROP COLUMN module_config;

-- 1. Remove lesson_exercises polymorphic columns
ALTER TABLE lesson_exercises DROP COLUMN module_type, DROP COLUMN module_config;
```

---

## Testing Checklist

After applying migrations:

- [ ] Verify all migrations applied successfully
- [ ] Check existing lesson_exercises still work
- [ ] Check existing practice_log entries still work
- [ ] Insert test data for new module types
- [ ] Test RLS policies (student can't see other's data)
- [ ] Test teacher can view student progress on their lessons

---

## Database Size Impact

**Estimated Additional Storage:**
- practice_sessions: ~100 bytes per session
- lesson_progress: ~200 bytes per user per lesson
- chord_progressions: ~1KB per progression (includes chord data)
- chord_progression_progress: ~50 bytes per user per progression

**Est. for 100 users with 10 lessons each:**
- ~500KB total additional data
- Negligible impact on Supabase free tier

Ready to apply? 🚀
