-- Migration: Create recital system
-- Purpose: Weekly recital feature - scheduled live events with video queue, chat, and moderation

-- ============================================================
-- HELPER: is_admin() checks JWT claim set by Supabase auth hook
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb->>'user_role' = 'admin'
$$;

-- ============================================================
-- PROFILES: add recital-related columns
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS chat_ban_strikes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chat_permanently_banned BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- TABLE: recital_schedule
-- Upcoming / past scheduled recital events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recital_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_started BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recital_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read schedule"
  ON public.recital_schedule FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage schedule"
  ON public.recital_schedule FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.recital_schedule REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recital_schedule;

CREATE INDEX idx_recital_schedule_for ON public.recital_schedule(scheduled_for);

-- ============================================================
-- TABLE: recitals
-- One row per live recital event (active or ended)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.recital_schedule(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  daily_room_url TEXT,
  daily_room_name TEXT,
  current_performer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performer_slot_started_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

ALTER TABLE public.recitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read recitals"
  ON public.recitals FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage recitals"
  ON public.recitals FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.recitals REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recitals;

CREATE INDEX idx_recitals_status ON public.recitals(status);

-- ============================================================
-- TABLE: recital_queue
-- One row per user who has joined a recital (ready/not/performed)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recital_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recital_id UUID NOT NULL REFERENCES public.recitals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  ready BOOLEAN NOT NULL DEFAULT false,
  chat_banned_this_session BOOLEAN NOT NULL DEFAULT false,
  video_banned BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  performed_at TIMESTAMPTZ,
  UNIQUE (recital_id, user_id)
);

ALTER TABLE public.recital_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read queue"
  ON public.recital_queue FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can join queue"
  ON public.recital_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ready status"
  ON public.recital_queue FOR UPDATE
  USING (auth.uid() = user_id AND NOT video_banned AND NOT chat_banned_this_session);

CREATE POLICY "Admin can update any queue row"
  ON public.recital_queue FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.recital_queue REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recital_queue;

CREATE INDEX idx_recital_queue_recital ON public.recital_queue(recital_id);
CREATE INDEX idx_recital_queue_user ON public.recital_queue(user_id);

-- ============================================================
-- TABLE: recital_chat
-- Append-only chat log per recital
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recital_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recital_id UUID NOT NULL REFERENCES public.recitals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 500),
  deleted_by_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recital_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read chat"
  ON public.recital_chat FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can send chat messages"
  ON public.recital_chat FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can soft-delete messages"
  ON public.recital_chat FOR UPDATE
  USING (public.is_admin());

ALTER TABLE public.recital_chat REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recital_chat;

CREATE INDEX idx_recital_chat_recital ON public.recital_chat(recital_id, created_at);

-- ============================================================
-- TRIGGER: rate-limit chat (max 5 messages per 10 seconds per user per recital)
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_chat_rate_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.recital_chat
  WHERE user_id = NEW.user_id
    AND recital_id = NEW.recital_id
    AND created_at > now() - INTERVAL '10 seconds';

  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded: too many messages sent recently';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER recital_chat_rate_limit
  BEFORE INSERT ON public.recital_chat
  FOR EACH ROW EXECUTE FUNCTION public.check_chat_rate_limit();
