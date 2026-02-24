-- Add course_enrollments table
CREATE TABLE IF NOT EXISTS public.course_enrollments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending_verification', 'verified', 'rejected')),
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE,
    source TEXT DEFAULT 'guitar_brain',
    UNIQUE(user_id) -- A user can only have one course enrollment record for now
);

-- Add course_progress table
CREATE TABLE IF NOT EXISTS public.course_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    video_id TEXT NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, video_id) -- Prevent duplicate completion records
);

-- RLS for course_enrollments
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own enrollments"
    ON public.course_enrollments FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own enrollments"
    ON public.course_enrollments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own enrollments (limited to certain fields)"
    ON public.course_enrollments FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id AND status = 'pending_verification'); -- Only let them touch it if it's pending (e.g., they made a mistake)

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

-- Explicitly allow Admins to manage everything (Assuming an admin boolean on profiles or checking email)
-- (Tempo Trekker has an `is_admin` function or we can just rely on the service key for admin routes)
