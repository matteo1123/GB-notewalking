-- Create chord_shapes table for storing chord fingering templates
-- This is separate from scale_shapes to avoid confusion between scales and chords

CREATE TABLE chord_shapes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,  -- e.g., "C Major Open Position", "A Minor Barre 5th Fret"
    chord_quality TEXT NOT NULL,  -- 'major', 'minor', 'diminished', 'augmented', 'dominant7', 'minor7', 'major7'
    root_fret INT DEFAULT 0,  -- The fret offset that represents the root note (usually 0)
    shape_json JSONB NOT NULL,  -- Array of {string: number, fret_offset: number}
    intervals INT[],  -- e.g., [0, 4, 7] for major triad
    notes TEXT[],  -- Template note names e.g., ['C', 'E', 'G']
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add index for quick lookups by chord quality
CREATE INDEX idx_chord_shapes_quality ON chord_shapes(chord_quality);

-- Add comment for documentation
COMMENT ON TABLE chord_shapes IS 'Template definitions for chord fingerings. These are normalized to create concrete chord instances in the chords table.';
COMMENT ON COLUMN chord_shapes.chord_quality IS 'The type of chord: major, minor, diminished, augmented, dominant7, minor7, major7, etc.';
COMMENT ON COLUMN chord_shapes.shape_json IS 'Array of note positions relative to root. Format: [{string: 1-6, fret_offset: 0-24}]';
