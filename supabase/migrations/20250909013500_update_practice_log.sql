ALTER TABLE public.practice_log
ADD COLUMN scale_id UUID REFERENCES public.scales(id) ON DELETE SET NULL,
ADD COLUMN scale_shape_id UUID REFERENCES public.scale_shapes(id) ON DELETE SET NULL,
ADD COLUMN perfect_bpm INTEGER;

-- Drop the not null constraint on exercise_id
ALTER TABLE public.practice_log ALTER COLUMN exercise_id DROP NOT NULL;