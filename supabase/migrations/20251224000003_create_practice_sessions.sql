-- Migration: Create practice_sessions table
-- Groups practice activities into structured sessions (e.g., "5 min of X, 5 min of Y")

CREATE TABLE practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  total_duration_seconds INTEGER,
  session_plan JSONB, -- Array of blocks: [{ module_type, config, duration_minutes, order }]
  completed BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own sessions"
  ON practice_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON practice_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON practice_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON practice_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Add index for common queries
CREATE INDEX idx_practice_sessions_user_id ON practice_sessions(user_id);
CREATE INDEX idx_practice_sessions_lesson_id ON practice_sessions(lesson_id);
CREATE INDEX idx_practice_sessions_started_at ON practice_sessions(started_at DESC);

-- Add comments
COMMENT ON TABLE practice_sessions IS 'Organized practice sessions grouping multiple module blocks';
COMMENT ON COLUMN practice_sessions.session_plan IS 'Array of practice blocks in JSONB: [{ module_type, config, duration_minutes, order }]';

-- Link practice_log to sessions
ALTER TABLE practice_log
ADD COLUMN session_id UUID REFERENCES practice_sessions(id) ON DELETE SET NULL;

CREATE INDEX idx_practice_log_session_id ON practice_log(session_id);
