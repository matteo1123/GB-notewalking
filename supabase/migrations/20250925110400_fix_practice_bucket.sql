-- Delete the incorrect "Practice" bucket
DELETE FROM storage.buckets WHERE id = 'Practice';

-- Create the correct "practice" bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('practice', 'practice', true);

-- Add RLS policies to the "practice" bucket
CREATE POLICY "Enable insert for authenticated users only" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'practice');
CREATE POLICY "Enable update for users based on user_id" ON storage.objects FOR UPDATE TO authenticated USING (auth.uid() = owner);
CREATE POLICY "Enable delete for users based on user_id" ON storage.objects FOR DELETE TO authenticated USING (auth.uid() = owner);
CREATE POLICY "Enable read access for all users" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'practice');