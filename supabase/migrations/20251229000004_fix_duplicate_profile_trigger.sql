-- Remove duplicate trigger and function from 20250925102100_add_profile_for_new_user.sql
-- This resolves the "duplicate key value violates unique constraint profiles_pkey" error on signup

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
