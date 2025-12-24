-- Migration: Make lesson_exercises polymorphic to support all module types
-- This allows lessons to include scales, rhythms, notewalking, arpeggios, riffs, and chord progressions

ALTER TABLE lesson_exercises
ADD COLUMN module_type TEXT CHECK (
  module_type IN ('scale', 'rhythm', 'notewalking', 'arpeggio', 'riff', 'chord_progressions')
),
ADD COLUMN module_config JSONB;

-- Set module_type = 'scale' for all existing lesson exercises
-- (they all currently link to scales via scale_id)
UPDATE lesson_exercises 
SET module_type = 'scale' 
WHERE module_type IS NULL;

-- Add helpful comment
COMMENT ON COLUMN lesson_exercises.module_type IS 'Type of practice module: scale, rhythm, notewalking, arpeggio, riff, chord_progressions';
COMMENT ON COLUMN lesson_exercises.module_config IS 'Module-specific configuration in JSONB format. Structure varies by module_type.';

-- Example module_config structures:
-- scale: { "scale_id": "uuid", "scale_shape_id": "uuid" }
-- rhythm: { "rhythm_level": 5, "duration_minutes": 5 }
-- notewalking: { "key": "C", "chords": ["I", "IV", "V"], "measures_per_chord": 4 }
-- chord_progressions: { "progression_id": "uuid", "key": "C", "target_bpm": 60 }
-- arpeggio: { "arpeggio_id": "uuid", "pattern": "ascending" }
-- riff: { "repertoire_id": "uuid", "target_bpm": 120 }
