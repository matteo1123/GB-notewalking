-- Migration: Make practice_log polymorphic to support all module types
-- Allows tracking practice for any module, not just exercises

ALTER TABLE practice_log
ADD COLUMN module_type TEXT,
ADD COLUMN module_config JSONB;

-- Backfill module_type for existing records
UPDATE practice_log 
SET module_type = CASE
  WHEN exercise_category IS NOT NULL THEN exercise_category
  WHEN scale_id IS NOT NULL THEN 'scale'
  ELSE 'freeplay'
END
WHERE module_type IS NULL;

-- Add helpful comments
COMMENT ON COLUMN practice_log.module_type IS 'Type of module practiced: scale, rhythm, notewalking, arpeggio, riff, chord_progressions';
COMMENT ON COLUMN practice_log.module_config IS 'Snapshot of what was practiced in JSONB format';

-- Example module_config:
-- { "scale_id": "uuid", "bpm_achieved": 120, "notes_hit": 1500 }
-- { "rhythm_level": 5, "patterns_completed": 12 }
-- { "progression_id": "uuid", "clean_changes": 45 }
