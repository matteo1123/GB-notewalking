-- Migration: Create practice_routines table
-- Purpose: Named, reusable practice configurations that users can save and switch between
-- Examples: "C# Minor Mastery", "General Guitar Skills", "Away from Instrument"

-- Create the practice_routines table
CREATE TABLE IF NOT EXISTS practice_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,

  -- Identity
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🎸',
  color TEXT DEFAULT 'blue',

  -- Practice Configuration
  -- Array of SessionBlock objects, same structure as practice_sessions.session_plan
  session_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_duration_minutes INTEGER,

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  is_favorite BOOLEAN DEFAULT false,
  last_practiced_at TIMESTAMPTZ,
  times_practiced INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- AI-generated tracking
  created_by_ai BOOLEAN DEFAULT false,
  ai_prompt TEXT
);

-- Add comment explaining the table
COMMENT ON TABLE practice_routines IS 'Named practice configurations that users can save, switch between, and reuse';
COMMENT ON COLUMN practice_routines.session_plan IS 'Array of SessionBlock objects: [{module_type, config, duration_minutes, order}]';
COMMENT ON COLUMN practice_routines.created_by_ai IS 'True if this routine was created by the AI coach';

-- Enable RLS
ALTER TABLE practice_routines ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own routines
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

-- Indexes for common queries
CREATE INDEX idx_practice_routines_user_id ON practice_routines(user_id);
CREATE INDEX idx_practice_routines_last_practiced ON practice_routines(user_id, last_practiced_at DESC);
CREATE INDEX idx_practice_routines_favorite ON practice_routines(user_id, is_favorite) WHERE is_favorite = true;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_practice_routines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER practice_routines_updated_at
  BEFORE UPDATE ON practice_routines
  FOR EACH ROW
  EXECUTE FUNCTION update_practice_routines_updated_at();
