-- Comprehensive seed of standard chord shapes
-- This creates a library of common open position and barre chord shapes

-- ============================================================================
-- MAJOR CHORDS - Open Positions
-- ============================================================================

INSERT INTO chord_shapes (name, chord_quality, root_fret, shape_json, intervals, notes) VALUES
('C Major Open', 'major', 0, '[{"string": 5, "fret_offset": 3}, {"string": 4, "fret_offset": 2}, {"string": 3, "fret_offset": 0}, {"string": 2, "fret_offset": 1}, {"string": 1, "fret_offset": 0}]'::JSONB, ARRAY[0, 4, 7], ARRAY['C', 'E', 'G']),
('D Major Open', 'major', 0, '[{"string": 4, "fret_offset": 0}, {"string": 3, "fret_offset": 2}, {"string": 2, "fret_offset": 3}, {"string": 1, "fret_offset": 2}]'::JSONB, ARRAY[0, 4, 7], ARRAY['D', 'F#', 'A']),
('E Major Open', 'major', 0, '[{"string": 6, "fret_offset": 0}, {"string": 5, "fret_offset": 2}, {"string": 4, "fret_offset": 2}, {"string": 3, "fret_offset": 1}, {"string": 2, "fret_offset": 0}, {"string": 1, "fret_offset": 0}]'::JSONB, ARRAY[0, 4, 7], ARRAY['E', 'G#', 'B']),
('G Major Open', 'major', 0, '[{"string": 6, "fret_offset": 3}, {"string": 5, "fret_offset": 2}, {"string": 4, "fret_offset": 0}, {"string": 3, "fret_offset": 0}, {"string": 2, "fret_offset": 0}, {"string": 1, "fret_offset": 3}]'::JSONB, ARRAY[0, 4, 7], ARRAY['G', 'B', 'D']),
('A Major Open', 'major', 0, '[{"string": 5, "fret_offset": 0}, {"string": 4, "fret_offset": 2}, {"string": 3, "fret_offset": 2}, {"string": 2, "fret_offset": 2}, {"string": 1, "fret_offset": 0}]'::JSONB, ARRAY[0, 4, 7], ARRAY['A', 'C#', 'E']);

-- ============================================================================
-- MINOR CHORDS - Open Positions
-- ============================================================================

INSERT INTO chord_shapes (name, chord_quality, root_fret, shape_json, intervals, notes) VALUES
('A Minor Open', 'minor', 0, '[{"string": 5, "fret_offset": 0}, {"string": 4, "fret_offset": 2}, {"string": 3, "fret_offset": 2}, {"string": 2, "fret_offset": 1}, {"string": 1, "fret_offset": 0}]'::JSONB, ARRAY[0, 3, 7], ARRAY['A', 'C', 'E']),
('D Minor Open', 'minor', 0, '[{"string": 4, "fret_offset": 0}, {"string": 3, "fret_offset": 2}, {"string": 2, "fret_offset": 3}, {"string": 1, "fret_offset": 1}]'::JSONB, ARRAY[0, 3, 7], ARRAY['D', 'F', 'A']),
('E Minor Open', 'minor', 0, '[{"string": 6, "fret_offset": 0}, {"string": 5, "fret_offset": 2}, {"string": 4, "fret_offset": 2}, {"string": 3, "fret_offset": 0}, {"string": 2, "fret_offset": 0}, {"string": 1, "fret_offset": 0}]'::JSONB, ARRAY[0, 3, 7], ARRAY['E', 'G', 'B']);

-- ============================================================================
-- DOMINANT 7 CHORDS - Open Positions
-- ============================================================================

INSERT INTO chord_shapes (name, chord_quality, root_fret, shape_json, intervals, notes) VALUES
('A7 Open', 'dominant7', 0, '[{"string": 5, "fret_offset": 0}, {"string": 4, "fret_offset": 2}, {"string": 3, "fret_offset": 0}, {"string": 2, "fret_offset": 2}, {"string": 1, "fret_offset": 0}]'::JSONB, ARRAY[0, 4, 7, 10], ARRAY['A', 'C#', 'E', 'G']),
('B7 Open', 'dominant7', 0, '[{"string": 5, "fret_offset": 2}, {"string": 4, "fret_offset": 1}, {"string": 3, "fret_offset": 2}, {"string": 2, "fret_offset": 0}, {"string": 1, "fret_offset": 2}]'::JSONB, ARRAY[0, 4, 7, 10], ARRAY['B', 'D#', 'F#', 'A']),
('C7 Open', 'dominant7', 0, '[{"string": 5, "fret_offset": 3}, {"string": 4, "fret_offset": 2}, {"string": 3, "fret_offset": 3}, {"string": 2, "fret_offset": 1}, {"string": 1, "fret_offset": 0}]'::JSONB, ARRAY[0, 4, 7, 10], ARRAY['C', 'E', 'G', 'Bb']),
('D7 Open', 'dominant7', 0, '[{"string": 4, "fret_offset": 0}, {"string": 3, "fret_offset": 2}, {"string": 2, "fret_offset": 1}, {"string": 1, "fret_offset": 2}]'::JSONB, ARRAY[0, 4, 7, 10], ARRAY['D', 'F#', 'A', 'C']),
('E7 Open', 'dominant7', 0, '[{"string": 6, "fret_offset": 0}, {"string": 5, "fret_offset": 2}, {"string": 4, "fret_offset": 0}, {"string": 3, "fret_offset": 1}, {"string": 2, "fret_offset": 0}, {"string": 1, "fret_offset": 0}]'::JSONB, ARRAY[0, 4, 7, 10], ARRAY['E', 'G#', 'B', 'D']),
('G7 Open', 'dominant7', 0, '[{"string": 6, "fret_offset": 3}, {"string": 5, "fret_offset": 2}, {"string": 4, "fret_offset": 0}, {"string": 3, "fret_offset": 0}, {"string": 2, "fret_offset": 0}, {"string": 1, "fret_offset": 1}]'::JSONB, ARRAY[0, 4, 7, 10], ARRAY['G', 'B', 'D', 'F']);

-- ============================================================================
-- BARRE CHORD TEMPLATES (Moveable Shapes)
-- ============================================================================

-- E-shape barre chords (6th string root)
INSERT INTO chord_shapes (name, chord_quality, root_fret, shape_json, intervals, notes) VALUES
('E-Shape Major Barre', 'major', 0, '[{"string": 6, "fret_offset": 0}, {"string": 5, "fret_offset": 2}, {"string": 4, "fret_offset": 2}, {"string": 3, "fret_offset": 1}, {"string": 2, "fret_offset": 0}, {"string": 1, "fret_offset": 0}]'::JSONB, ARRAY[0, 4, 7], ARRAY['E', 'G#', 'B']),
('E-Shape Minor Barre', 'minor', 0, '[{"string": 6, "fret_offset": 0}, {"string": 5, "fret_offset": 2}, {"string": 4, "fret_offset": 2}, {"string": 3, "fret_offset": 0}, {"string": 2, "fret_offset": 0}, {"string": 1, "fret_offset": 0}]'::JSONB, ARRAY[0, 3, 7], ARRAY['E', 'G', 'B']),
('E-Shape Dominant 7 Barre', 'dominant7', 0, '[{"string": 6, "fret_offset": 0}, {"string": 5, "fret_offset": 2}, {"string": 4, "fret_offset": 0}, {"string": 3, "fret_offset": 1}, {"string": 2, "fret_offset": 0}, {"string": 1, "fret_offset": 0}]'::JSONB, ARRAY[0, 4, 7, 10], ARRAY['E', 'G#', 'B', 'D']);

-- A-shape barre chords (5th string root)
INSERT INTO chord_shapes (name, chord_quality, root_fret, shape_json, intervals, notes) VALUES
('A-Shape Major Barre', 'major', 0, '[{"string": 5, "fret_offset": 0}, {"string": 4, "fret_offset": 2}, {"string": 3, "fret_offset": 2}, {"string": 2, "fret_offset": 2}, {"string": 1, "fret_offset": 0}]'::JSONB, ARRAY[0, 4, 7], ARRAY['A', 'C#', 'E']),
('A-Shape Minor Barre', 'minor', 0, '[{"string": 5, "fret_offset": 0}, {"string": 4, "fret_offset": 2}, {"string": 3, "fret_offset": 2}, {"string": 2, "fret_offset": 1}, {"string": 1, "fret_offset": 0}]'::JSONB, ARRAY[0, 3, 7], ARRAY['A', 'C', 'E']),
('A-Shape Dominant 7 Barre', 'dominant7', 0, '[{"string": 5, "fret_offset": 0}, {"string": 4, "fret_offset": 2}, {"string": 3, "fret_offset": 0}, {"string": 2, "fret_offset": 2}, {"string": 1, "fret_offset": 0}]'::JSONB, ARRAY[0, 4, 7, 10], ARRAY['A', 'C#', 'E', 'G']);

-- ============================================================================
-- MINOR 7 CHORDS
-- ============================================================================

INSERT INTO chord_shapes (name, chord_quality, root_fret, shape_json, intervals, notes) VALUES
('A Minor 7 Open', 'minor7', 0, '[{"string": 5, "fret_offset": 0}, {"string": 4, "fret_offset": 2}, {"string": 3, "fret_offset": 0}, {"string": 2, "fret_offset": 1}, {"string": 1, "fret_offset": 0}]'::JSONB, ARRAY[0, 3, 7, 10], ARRAY['A', 'C', 'E', 'G']),
('D Minor 7 Open', 'minor7', 0, '[{"string": 4, "fret_offset": 0}, {"string": 3, "fret_offset": 2}, {"string": 2, "fret_offset": 1}, {"string": 1, "fret_offset": 1}]'::JSONB, ARRAY[0, 3, 7, 10], ARRAY['D', 'F', 'A', 'C']),
('E Minor 7 Open', 'minor7', 0, '[{"string": 6, "fret_offset": 0}, {"string": 5, "fret_offset": 2}, {"string": 4, "fret_offset": 0}, {"string": 3, "fret_offset": 0}, {"string": 2, "fret_offset": 0}, {"string": 1, "fret_offset": 0}]'::JSONB, ARRAY[0, 3, 7, 10], ARRAY['E', 'G', 'B', 'D']);

-- ============================================================================
-- MAJOR 7 CHORDS
-- ============================================================================

INSERT INTO chord_shapes (name, chord_quality, root_fret, shape_json, intervals, notes) VALUES
('C Major 7 Open', 'major7', 0, '[{"string": 5, "fret_offset": 3}, {"string": 4, "fret_offset": 2}, {"string": 3, "fret_offset": 0}, {"string": 2, "fret_offset": 0}, {"string": 1, "fret_offset": 0}]'::JSONB, ARRAY[0, 4, 7, 11], ARRAY['C', 'E', 'G', 'B']),
('D Major 7 Open', 'major7', 0, '[{"string": 4, "fret_offset": 0}, {"string": 3, "fret_offset": 2}, {"string": 2, "fret_offset": 2}, {"string": 1, "fret_offset": 2}]'::JSONB, ARRAY[0, 4, 7, 11], ARRAY['D', 'F#', 'A', 'C#']),
('A Major 7 Open', 'major7', 0, '[{"string": 5, "fret_offset": 0}, {"string": 4, "fret_offset": 2}, {"string": 3, "fret_offset": 1}, {"string": 2, "fret_offset": 2}, {"string": 1, "fret_offset": 0}]'::JSONB, ARRAY[0, 4, 7, 11], ARRAY['A', 'C#', 'E', 'G#']);

-- Add summary comment
DO $$
DECLARE
  shape_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO shape_count FROM chord_shapes;
  RAISE NOTICE 'Loaded % chord shapes into the database', shape_count;
END $$;
