-- Migration: Create Intelligent Curriculum Tables
-- 1. curriculum_concepts: Defines the static learnable skills
-- 2. user_concept_progress: Tracks user mastery of these skills
-- 3. profiles extension: Adds priority settings

-- 1. Curriculum Concepts Table
CREATE TABLE curriculum_concepts (
  id TEXT PRIMARY KEY, -- e.g. 'rhythm-level-1', 'scale-c-major'
  module_type TEXT NOT NULL CHECK (module_type IN ('scale', 'rhythm', 'notewalking', 'arpeggio', 'riff', 'chord_progressions')),
  level INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  paths JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. { "rhythm": 10, "improv": 2 }
  requires TEXT[] DEFAULT '{}', -- Array of prerequisite concept IDs
  practice_config JSONB NOT NULL, -- Config object for the module
  mastery_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE curriculum_concepts ENABLE ROW LEVEL SECURITY;

-- Everyone can view curriculum concepts
CREATE POLICY "Everyone can view curriculum concepts"
  ON curriculum_concepts FOR SELECT
  USING (true);

-- Only admins/service role can insert/update (for now)
-- No public insert policy

-- 2. User Concept Progress Table
CREATE TABLE user_concept_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id TEXT NOT NULL REFERENCES curriculum_concepts(id) ON DELETE CASCADE,
  mastery_level DECIMAL(3,2) DEFAULT 0.00, -- 0.00 to 1.00
  last_practiced TIMESTAMPTZ,
  times_practiced INTEGER DEFAULT 0,
  best_performance JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, concept_id)
);

-- Enable RLS
ALTER TABLE user_concept_progress ENABLE ROW LEVEL SECURITY;

-- Users can view/edit their own progress
CREATE POLICY "Users can view own concept progress"
  ON user_concept_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own concept progress"
  ON user_concept_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own concept progress"
  ON user_concept_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- 3. Add Priorities to Profiles
-- Note: Assuming profiles table exists (referenced in earlier context)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS priorities JSONB DEFAULT '{"rhythm": 5, "improv": 5, "technique": 5, "repertoire": 5}'::jsonb;

-- Indexes
CREATE INDEX idx_curriculum_concepts_module_type ON curriculum_concepts(module_type);
CREATE INDEX idx_user_concept_progress_user_id ON user_concept_progress(user_id);
CREATE INDEX idx_user_concept_progress_concept_id ON user_concept_progress(concept_id);

-- Comments
COMMENT ON TABLE curriculum_concepts IS 'Static definition of all learnable skills/concepts in the curriculum';
COMMENT ON TABLE user_concept_progress IS 'Tracks user mastery of specific curriculum concepts';
COMMENT ON COLUMN profiles.priorities IS 'User practice priorities weights (0-10) for different paths';
