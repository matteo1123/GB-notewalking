-- Create the notewalking_comfort table to store mastery progress
CREATE TABLE public.notewalking_comfort (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_key TEXT NOT NULL,
    chord_pair TEXT NOT NULL,
    comfort_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Ensure exactly one record per user, key, and chord pair combination
    UNIQUE(user_id, session_key, chord_pair)
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.notewalking_comfort ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own notewalking comfort"
    ON public.notewalking_comfort
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notewalking comfort"
    ON public.notewalking_comfort
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notewalking comfort"
    ON public.notewalking_comfort
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notewalking comfort"
    ON public.notewalking_comfort
    FOR DELETE
    USING (auth.uid() = user_id);
