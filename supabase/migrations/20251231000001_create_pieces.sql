-- Migration: Create pieces and piece_progress tables for Piece Mastery feature
-- Enables users to store and practice songs with MP3 playback and progress tracking

-- Pieces table: stores user's pieces with audio and notes
CREATE TABLE pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT, -- chords, tabs, any text user wants to store
  audio_url TEXT, -- path in storage bucket
  duration_seconds NUMERIC, -- total audio length
  segment_seconds INTEGER DEFAULT 5, -- loop segment size
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Piece progress: tracks user's practice progress per piece
CREATE TABLE piece_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  piece_id UUID NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  current_block_index INTEGER DEFAULT 0, -- position in binary-tree expansion pattern
  total_practice_seconds INTEGER DEFAULT 0,
  last_practiced TIMESTAMPTZ,
  UNIQUE(user_id, piece_id)
);

-- Enable RLS
ALTER TABLE pieces ENABLE ROW LEVEL SECURITY;
ALTER TABLE piece_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pieces
CREATE POLICY "Users can view own pieces"
  ON pieces FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pieces"
  ON pieces FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pieces"
  ON pieces FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pieces"
  ON pieces FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for piece_progress
CREATE POLICY "Users can view own piece progress"
  ON piece_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own piece progress"
  ON piece_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own piece progress"
  ON piece_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own piece progress"
  ON piece_progress FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_pieces_user_id ON pieces(user_id);
CREATE INDEX idx_piece_progress_user_id ON piece_progress(user_id);
CREATE INDEX idx_piece_progress_piece_id ON piece_progress(piece_id);

-- Storage bucket for piece audio (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('pieces', 'pieces', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for pieces bucket
CREATE POLICY "Users can upload piece audio"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'pieces' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view piece audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pieces');

CREATE POLICY "Users can delete own piece audio"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'pieces' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Comments
COMMENT ON TABLE pieces IS 'User-created pieces for Piece Mastery practice';
COMMENT ON TABLE piece_progress IS 'Tracks practice progress for each piece';
COMMENT ON COLUMN pieces.segment_seconds IS 'Loop segment size in seconds (default 5)';
COMMENT ON COLUMN piece_progress.current_block_index IS 'Position in binary-tree loop expansion pattern';
