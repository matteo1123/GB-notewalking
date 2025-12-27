-- Make practice bucket public for social accountability
-- Users' practice recordings are visible to motivate performance
-- Users can delete recordings they don't want public

-- Update the practice bucket to be public
UPDATE storage.buckets
SET public = true
WHERE id = 'practice';

-- Add RLS policy to allow users to delete their own recordings
CREATE POLICY "Users can delete their own practice recordings"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'practice' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Add RLS policy to allow anyone to read public recordings
CREATE POLICY "Practice recordings are publicly readable"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'practice');

-- Add RLS policy for users to insert their own recordings (already handled by auto-recording)
CREATE POLICY "Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'practice' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
