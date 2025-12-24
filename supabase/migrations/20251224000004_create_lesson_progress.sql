-- Migration: Create lesson_progress table
-- Tracks student progress on assigned lessons (goal tracking)

CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  last_practiced TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_time_seconds INTEGER DEFAULT 0,
  exercises_completed INTEGER DEFAULT 0,
  metrics JSONB, -- { best_bpms: {}, mastery_levels: {}, recordings: [] }
  UNIQUE(user_id, lesson_id)
);

-- Enable RLS
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own progress"
  ON lesson_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON lesson_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON lesson_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress"
  ON lesson_progress FOR DELETE
  USING (auth.uid() = user_id);

-- Teachers can view their students' progress
CREATE POLICY "Teachers can view student progress on their lessons"
  ON lesson_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lessons
      WHERE lessons.id = lesson_progress.lesson_id
      AND lessons.created_by = auth.uid()
    )
  );

-- Add indexes
CREATE INDEX idx_lesson_progress_user_id ON lesson_progress(user_id);
CREATE INDEX idx_lesson_progress_lesson_id ON lesson_progress(lesson_id);
CREATE INDEX idx_lesson_progress_last_practiced ON lesson_progress(last_practiced DESC);

-- Add comments
COMMENT ON TABLE lesson_progress IS 'Student progress tracking for assigned lessons';
COMMENT ON COLUMN lesson_progress.metrics IS 'Progress metrics in JSONB: { best_bpms, mastery_levels, recordings }';
