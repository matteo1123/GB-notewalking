ALTER TABLE public.profiles
ADD COLUMN settings JSONB DEFAULT '{}'::jsonb;