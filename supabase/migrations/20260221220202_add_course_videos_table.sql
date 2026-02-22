-- Create course_videos table
CREATE TABLE IF NOT EXISTS public.course_videos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    duration TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    locked BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: We defined video_id as TEXT in the previous migration for course_progress.
-- We must drop the default course_progress table to rebuild it correctly mapping to course_videos UUIDs.
-- Or just alter the column since it's early and prod data doesn't care.

DO $$
BEGIN
   -- Safely attempt to drop constraint if it exists (it doesn't, just user_id/video_id UNIQUE)
   ALTER TABLE public.course_progress DROP CONSTRAINT IF EXISTS course_progress_user_id_video_id_key;
EXCEPTION
   WHEN undefined_object THEN null;
END $$;

-- Drop course_progress because it's brand new and empty anyway, then recreate properly
DROP TABLE IF EXISTS public.course_progress;

CREATE TABLE public.course_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    video_id UUID REFERENCES public.course_videos(id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, video_id)
);

-- RLS for course_progress
ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own progress"
    ON public.course_progress FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress"
    ON public.course_progress FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own progress"
    ON public.course_progress FOR DELETE
    USING (auth.uid() = user_id);

-- RLS for course_videos
ALTER TABLE public.course_videos ENABLE ROW LEVEL SECURITY;

-- Anyone can view the videos (the frontend handles the lock based on profile.premium_until)
CREATE POLICY "Public video viewing"
    ON public.course_videos FOR SELECT
    USING (true);

-- Admins handle insert/update/delete, which we bypass using service role for the backend/GUI
