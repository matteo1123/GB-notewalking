-- Migration: Create chord_progression_progress table
-- Tracks student progress on chord progressions

CREATE TABLE chord_progression_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  progression_id UUID NOT NULL REFERENCES chord_progressions(id) ON DELETE CASCADE,
  max_clean_bpm INTEGER DEFAULT 0,
  time_practiced_seconds INTEGER DEFAULT 0,
  last_practiced TIMESTAMPTZ,
  mastery_level DECIMAL(3,2) DEFAULT 0.00 CHECK (mastery_level BETWEEN 0 AND 1),
  UNIQUE(user_id, progression_id)
);

-- Enable RLS
ALTER TABLE chord_progression_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own chord progress"
  ON chord_progression_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own chord progress"
  ON chord_progression_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chord progress"
  ON chord_progression_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chord progress"
  ON chord_progression_progress FOR DELETE
  USING (auth.uid() = user_id);

-- Add indexes
CREATE INDEX idx_chord_progression_progress_user_id ON chord_progression_progress(user_id);
CREATE INDEX idx_chord_progression_progress_progression_id ON chord_progression_progress(progression_id);
CREATE INDEX idx_chord_progression_progress_last_practiced ON chord_progression_progress(last_practiced DESC);
CREATE INDEX idx_chord_progression_progress_mastery ON chord_progression_progress(mastery_level DESC);

-- Add comments
COMMENT ON TABLE chord_progression_progress IS 'Student progress tracking for chord progressions';
COMMENT ON COLUMN chord_progression_progress.mastery_level IS 'Calculated mastery level from 0.00 (just started) to 1.00 (complete mastery)';
COMMENT ON COLUMN chord_progression_progress.max_clean_bpm IS 'Highest BPM achieved with clean chord changes';
