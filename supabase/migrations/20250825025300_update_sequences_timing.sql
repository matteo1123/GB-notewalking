ALTER TABLE public.sequences
DROP COLUMN timing;

ALTER TABLE public.sequences
ADD COLUMN notes_per_beat integer,
ADD COLUMN subdivision integer;