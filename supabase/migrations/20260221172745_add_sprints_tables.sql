-- Migration: Add Sprints and Push Subscriptions Feature
-- Purpose: Schema for tracking 3-5 day high-intensity focus sessions.

-- 1. Create Sprints table
CREATE TABLE IF NOT EXISTS public.sprints (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    module_type TEXT NOT NULL,
    module_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    duration_days INTEGER NOT NULL DEFAULT 3,
    sessions_per_day INTEGER NOT NULL DEFAULT 3,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Create Push Subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, subscription) -- Prevent duplicate identical subscriptions for the same user
);

-- Note: We aren't strictly preventing multiple active sprints entirely, 
-- but you probably only want one active per user. Enforcing that might be better in application logic.

-- Enable Row Level Security
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Sprints Policies
CREATE POLICY "Users can view their own sprints."
    ON public.sprints FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sprints."
    ON public.sprints FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sprints."
    ON public.sprints FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sprints."
    ON public.sprints FOR DELETE
    USING (auth.uid() = user_id);

-- Push Subscriptions Policies
CREATE POLICY "Users can view their own push subscriptions."
    ON public.push_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push subscriptions."
    ON public.push_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push subscriptions."
    ON public.push_subscriptions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subscriptions."
    ON public.push_subscriptions FOR DELETE
    USING (auth.uid() = user_id);

-- Updated_at triggers
CREATE TRIGGER handle_updated_at_sprints
    BEFORE UPDATE ON public.sprints
    FOR EACH ROW
    EXECUTE FUNCTION moddatetime (updated_at);

CREATE TRIGGER handle_updated_at_push_subscriptions
    BEFORE UPDATE ON public.push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION moddatetime (updated_at);
