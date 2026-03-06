-- Create a secure RPC function to atomically increment a user's points and XP
-- This prevents race conditions if multiple practice sessions end simultaneously

CREATE OR REPLACE FUNCTION increment_user_points(user_id_param UUID, points_to_add INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to update profiles table safely
AS $$
BEGIN
  UPDATE profiles
  SET 
    points = COALESCE(points, 0) + points_to_add,
    current_xp = COALESCE(current_xp, 0) + points_to_add
  WHERE id = user_id_param;
END;
$$;
