-- Migration: Extend lessons table with goal tracking fields
-- Adds description, status, target level, and duration estimates

ALTER TABLE lessons
ADD COLUMN description TEXT,
ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
ADD COLUMN target_level INTEGER DEFAULT 1 CHECK (target_level BETWEEN 1 AND 10),
ADD COLUMN estimated_duration_minutes INTEGER;

-- Add helpful comments
COMMENT ON COLUMN lessons.description IS 'Detailed description of lesson goals and expectations';
COMMENT ON COLUMN lessons.status IS 'Lesson status: active (current), completed (archived but finished), archived (deprecated)';
COMMENT ON COLUMN lessons.target_level IS 'Target skill level (1-10) this lesson aims to achieve';
COMMENT ON COLUMN lessons.estimated_duration_minutes IS 'Estimated time to complete this lesson in minutes';

-- Set default values for existing lessons
UPDATE lessons
SET status = 'active',
    target_level = 1
WHERE status IS NULL OR target_level IS NULL;
