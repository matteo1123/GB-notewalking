-- Add module_config JSONB column to practice_log table
-- This stores module configuration for saved module instances (type filters, priority IDs, etc.)

ALTER TABLE practice_log
ADD COLUMN IF NOT EXISTS module_config JSONB DEFAULT NULL;

COMMENT ON COLUMN practice_log.module_config IS 'JSON configuration for module instances - includes type_filter, priority_ids, group_by_shape, etc.';
