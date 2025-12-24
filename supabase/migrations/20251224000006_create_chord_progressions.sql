-- Migration: Create chord_progressions table
-- Library of chord progressions for students to learn

CREATE TABLE chord_progressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  progression TEXT NOT NULL, -- Roman numeral notation: "I-IV-V-I"
  key TEXT NOT NULL,
  genre TEXT, -- pop, rock, jazz, blues, country, etc.
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 10),
  chords JSONB NOT NULL, -- Array of chord definitions
  measures_per_chord INTEGER DEFAULT 1,
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE chord_progressions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public progressions viewable by all"
  ON chord_progressions FOR SELECT
  USING (is_public = true OR auth.uid() = created_by);

CREATE POLICY "Users can create progressions"
  ON chord_progressions FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own progressions"
  ON chord_progressions FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own progressions"
  ON chord_progressions FOR DELETE
  USING (auth.uid() = created_by);

-- Add indexes
CREATE INDEX idx_chord_progressions_difficulty ON chord_progressions(difficulty);
CREATE INDEX idx_chord_progressions_genre ON chord_progressions(genre);
CREATE INDEX idx_chord_progressions_key ON chord_progressions(key);
CREATE INDEX idx_chord_progressions_is_public ON chord_progressions(is_public);

-- Add comments
COMMENT ON TABLE chord_progressions IS 'Library of chord progressions for practice';
COMMENT ON COLUMN chord_progressions.chords IS 'Array of chord objects: [{ numeral, name, voicing_type, frets, fingers, notes }]';

-- Example chords JSONB structure:
-- [
--   {
--     "numeral": "I",
--     "name": "C",
--     "voicing_type": "open",
--     "frets": [null, 3, 2, 0, 1, 0],
--     "fingers": [null, 3, 2, 0, 1, 0],
--     "notes": ["x", "C", "E", "G", "C", "E"]
--   },
--   {
--     "numeral": "IV",
--     "name": "F",
--     "voicing_type": "open",
--     "frets": [null, null, 3, 2, 1, 1],
--     "fingers": [null, null, 3, 2, 1, 1],
--     "notes": ["x", "x", "F", "A", "C", "F"]
--   }
-- ]
