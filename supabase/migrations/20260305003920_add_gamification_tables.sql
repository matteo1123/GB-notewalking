-- Add Gamification columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS points INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS level INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS current_xp INT DEFAULT 0;

-- Create videos table for unlockable instructional content
CREATE TABLE IF NOT EXISTS videos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  unlock_cost INT DEFAULT 0,
  prerequisite_level INT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on Row Level Security for videos
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view videos
CREATE POLICY "Videos are viewable by authenticated users"
  ON videos FOR SELECT
  TO authenticated
  USING (true);

-- Only admins/service role can insert or update videos (enforced implicitly by missing INSERT/UPDATE policies for authenticated users)

-- Create user_videos table to track unlocked videos per user
CREATE TABLE IF NOT EXISTS user_videos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, video_id)
);

-- Turn on Row Level Security for user_videos
ALTER TABLE user_videos ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own unlocked videos
CREATE POLICY "Users can view their own unlocked videos"
  ON user_videos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to insert (unlock) a video for themselves
CREATE POLICY "Users can unlock videos for themselves"
  ON user_videos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
