-- Add metronome and display settings to lesson_exercises
ALTER TABLE lesson_exercises ADD COLUMN metronome_mode TEXT CHECK (metronome_mode IN ('standard', 'speed_builder', 'progressive'));
ALTER TABLE lesson_exercises ADD COLUMN starting_bpm INTEGER;
ALTER TABLE lesson_exercises ADD COLUMN increments INTEGER;
ALTER TABLE lesson_exercises ADD COLUMN measures_per_bpm INTEGER;
ALTER TABLE lesson_exercises ADD COLUMN display_view TEXT CHECK (display_view IN ('tab', 'grid', 'fretboard'));
ALTER TABLE lesson_exercises ADD COLUMN target_type TEXT CHECK (target_type IN ('max', 'perfect', 'both'));