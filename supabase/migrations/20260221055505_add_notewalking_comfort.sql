-- Create the notewalking_comfort table
CREATE TABLE IF NOT EXISTS public.notewalking_comfort (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_key TEXT NOT NULL,
    chord_pair TEXT NOT NULL,
    comfort_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

    -- Ensure one record per user, per key, per chord pair
    UNIQUE(user_id, session_key, chord_pair)
);

-- Enable RLS
ALTER TABLE public.notewalking_comfort ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own notewalking comfort data."
    ON public.notewalking_comfort FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notewalking comfort data."
    ON public.notewalking_comfort FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notewalking comfort data."
    ON public.notewalking_comfort FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notewalking comfort data."
    ON public.notewalking_comfort FOR DELETE
    USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER handle_updated_at_notewalking_comfort
    BEFORE UPDATE ON public.notewalking_comfort
    FOR EACH ROW
    EXECUTE FUNCTION moddatetime (updated_at);
