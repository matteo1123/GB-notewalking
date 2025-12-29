-- Create chords table for storing concrete chord instances
-- Generated from chord_shapes templates via normalization

CREATE TABLE chords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,  -- e.g., "C Major", "A Minor", "G Dominant 7"
    chord_name TEXT NOT NULL,  -- Just the root note, e.g., "C", "A", "F#"
    chord_quality TEXT NOT NULL,  -- 'major', 'minor', 'diminished', 'augmented', 'dominant7', etc.
    root_note TEXT NOT NULL,  -- The root note name, e.g., 'C', 'A', 'F#', 'Bb'
    intervals INT[],  -- e.g., [0, 4, 7] for major triad
    notes TEXT[],  -- Enharmonically correct note names e.g., ['C', 'E', 'G']
    notes_json JSONB NOT NULL,  -- Absolute positions: [{string: number, fret: number, time: number, duration: number}]
    chord_shape_id UUID REFERENCES chord_shapes(id) ON DELETE SET NULL,
    is_public BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX idx_chords_root_note ON chords(root_note);
CREATE INDEX idx_chords_chord_quality ON chords(chord_quality);
CREATE INDEX idx_chords_chord_name ON chords(chord_name);
CREATE INDEX idx_chords_shape_id ON chords(chord_shape_id);

-- Add composite index for finding specific chords
CREATE INDEX idx_chords_name_quality ON chords(chord_name, chord_quality);

-- Add RLS policies
ALTER TABLE chords ENABLE ROW LEVEL SECURITY;

-- Public chords are visible to everyone
CREATE POLICY "Public chords are viewable by everyone"
    ON chords FOR SELECT
    USING (is_public = true);

-- Users can view their own chords
CREATE POLICY "Users can view their own chords"
    ON chords FOR SELECT
    USING (auth.uid() = created_by);

-- Users can insert their own chords
CREATE POLICY "Users can insert their own chords"
    ON chords FOR INSERT
    WITH CHECK (auth.uid() = created_by);

-- Users can update their own chords
CREATE POLICY "Users can update their own chords"
    ON chords FOR UPDATE
    USING (auth.uid() = created_by);

-- Users can delete their own chords
CREATE POLICY "Users can delete their own chords"
    ON chords FOR DELETE
    USING (auth.uid() = created_by);

-- Add comments for documentation
COMMENT ON TABLE chords IS 'Concrete chord instances generated from chord_shapes templates. Each row represents a specific chord in a specific position.';
COMMENT ON COLUMN chords.chord_name IS 'Just the root note letter (e.g., C, A, F#) for filtering and display';
COMMENT ON COLUMN chords.notes_json IS 'Absolute fretboard positions with timing info for playback';
