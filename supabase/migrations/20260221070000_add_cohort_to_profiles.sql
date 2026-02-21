-- Migration: Add cohort to profiles
-- Purpose: Track user cohorts. All existing and future users start at cohort 1.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cohort INTEGER NOT NULL DEFAULT 1;