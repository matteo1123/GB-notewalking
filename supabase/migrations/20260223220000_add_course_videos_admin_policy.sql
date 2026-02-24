-- Add RLS policy so Admins can insert/update/delete course videos
CREATE POLICY "Admins can manage course_videos"
ON public.course_videos
FOR ALL
USING (auth.jwt() ->> 'user_role' = 'admin')
WITH CHECK (auth.jwt() ->> 'user_role' = 'admin');
