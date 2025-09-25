-- Add num_clicks to sequences table
ALTER TABLE sequences ADD COLUMN num_clicks INTEGER DEFAULT 16;

-- Create practice bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('practice', 'practice', false);