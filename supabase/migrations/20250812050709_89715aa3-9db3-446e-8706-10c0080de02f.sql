-- 1) Create enums for exercise type and difficulty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'exercise_type') THEN
    CREATE TYPE public.exercise_type AS ENUM ('riff', 'scale', 'arpeggio');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'exercise_difficulty') THEN
    CREATE TYPE public.exercise_difficulty AS ENUM ('beginner', 'intermediate', 'advanced');
  END IF;
END$$;

-- 2) Create exercises table
CREATE TABLE IF NOT EXISTS public.exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  name text NOT NULL,
  description text,
  type public.exercise_type NOT NULL,
  difficulty public.exercise_difficulty NOT NULL DEFAULT 'beginner',
  tempo integer NOT NULL CHECK (tempo > 0 AND tempo < 400),
  notes jsonb NOT NULL,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.exercises IS 'Library of guitar training exercises (riffs, scales, arpeggios) stored as JSON notes';
COMMENT ON COLUMN public.exercises.notes IS 'Array of note objects: { time, duration, string, fret }';

-- 3) Enable Row Level Security
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

-- 4) RLS Policies (drop if exist then create)
DROP POLICY IF EXISTS "Public can read public exercises" ON public.exercises;
DROP POLICY IF EXISTS "Owners can read own exercises" ON public.exercises;
DROP POLICY IF EXISTS "Owners can insert exercises" ON public.exercises;
DROP POLICY IF EXISTS "Owners can update own exercises" ON public.exercises;
DROP POLICY IF EXISTS "Owners can delete own exercises" ON public.exercises;

CREATE POLICY "Public can read public exercises"
ON public.exercises
FOR SELECT
USING (is_public = true);

CREATE POLICY "Owners can read own exercises"
ON public.exercises
FOR SELECT
USING (auth.uid() = created_by);

CREATE POLICY "Owners can insert exercises"
ON public.exercises
FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can update own exercises"
ON public.exercises
FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Owners can delete own exercises"
ON public.exercises
FOR DELETE
USING (auth.uid() = created_by);

-- 5) Timestamp trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_exercises_updated_at ON public.exercises;
CREATE TRIGGER trg_exercises_updated_at
BEFORE UPDATE ON public.exercises
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Validation trigger for notes JSON structure
CREATE OR REPLACE FUNCTION public.validate_exercise_notes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.notes IS NULL OR jsonb_typeof(NEW.notes) <> 'array' THEN
    RAISE EXCEPTION 'notes must be a JSON array';
  END IF;
  -- Basic check on first element if present
  IF jsonb_array_length(NEW.notes) > 0 THEN
    IF NOT (
      (NEW.notes->0 ? 'time') AND
      (NEW.notes->0 ? 'duration') AND
      (NEW.notes->0 ? 'string') AND
      (NEW.notes->0 ? 'fret')
    ) THEN
      RAISE EXCEPTION 'each note must include time, duration, string, and fret keys';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_exercises_validate_notes ON public.exercises;
CREATE TRIGGER trg_exercises_validate_notes
BEFORE INSERT OR UPDATE ON public.exercises
FOR EACH ROW
EXECUTE FUNCTION public.validate_exercise_notes();

-- 7) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_exercises_type ON public.exercises (type);
CREATE INDEX IF NOT EXISTS idx_exercises_difficulty ON public.exercises (difficulty);
CREATE INDEX IF NOT EXISTS idx_exercises_is_public ON public.exercises (is_public);
CREATE INDEX IF NOT EXISTS idx_exercises_created_by ON public.exercises (created_by);

-- 8) Enable realtime (optional but useful)
ALTER TABLE public.exercises REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'exercises'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.exercises';
  END IF;
END$$;