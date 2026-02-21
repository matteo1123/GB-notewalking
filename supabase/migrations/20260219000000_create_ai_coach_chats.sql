-- Migration: Create ai_coach_chats table
-- Purpose: Log conversational messages and tool calls between the User and AI Coach

CREATE TABLE IF NOT EXISTS ai_coach_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  
  -- Message details
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  
  -- For assistant messages, optionally store tool calls as JSON
  tool_calls JSONB,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add comments for clarity
COMMENT ON TABLE ai_coach_chats IS 'Logs messages between users and the AI Coach';
COMMENT ON COLUMN ai_coach_chats.tool_calls IS 'Optional JSON array of tool calls made by the assistant during this turn';

-- Enable Row Level Security
ALTER TABLE ai_coach_chats ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only view and manage their own chats
CREATE POLICY "Users can view own chats"
  ON ai_coach_chats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chats"
  ON ai_coach_chats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chats"
  ON ai_coach_chats FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_ai_coach_chats_user_id ON ai_coach_chats(user_id);
CREATE INDEX idx_ai_coach_chats_created_at ON ai_coach_chats(user_id, created_at DESC);
