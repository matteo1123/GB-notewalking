-- Add ear training tracking to practice_log table
ALTER TABLE public.practice_log
ADD COLUMN ear_training_enabled BOOLEAN DEFAULT false,
ADD COLUMN ear_training_mode TEXT CHECK (ear_training_mode IN ('sing-back', 'identify')),
ADD COLUMN ear_training_level INTEGER CHECK (ear_training_level >= 1 AND ear_training_level <= 12),
ADD COLUMN ear_training_accuracy DECIMAL(5,2) CHECK (ear_training_accuracy >= 0 AND ear_training_accuracy <= 100),
ADD COLUMN ear_training_notes_correct INTEGER DEFAULT 0,
ADD COLUMN ear_training_notes_total INTEGER DEFAULT 0,
ADD COLUMN audio TEXT,
ADD COLUMN exercise_category TEXT;

-- Add index for querying ear training progress
CREATE INDEX idx_practice_log_ear_training 
ON public.practice_log(user_id, scale_id, ear_training_enabled, ear_training_level)
WHERE ear_training_enabled = true;
