-- Update the secure RPC function to atomically increment a user's points and XP
-- AND calculate their new level based on their total XP.

CREATE OR REPLACE FUNCTION increment_user_points(user_id_param UUID, points_to_add INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to update profiles table safely
AS $$
DECLARE
  new_xp INT;
  new_level INT;
BEGIN
  -- Update points and current_xp
  -- Only increase current_xp if points_to_add > 0 (don't lose XP when spending points)
  UPDATE profiles
  SET 
    points = COALESCE(points, 0) + points_to_add,
    current_xp = COALESCE(current_xp, 0) + GREATEST(points_to_add, 0)
  WHERE id = user_id_param
  RETURNING current_xp INTO new_xp;

  -- Calculate new level based on formula: Level = 1 + floor(sqrt(XP / 50))
  -- Level 1: 0 XP
  -- Level 2: 50 XP
  -- Level 3: 200 XP
  -- Level 4: 450 XP
  -- Level 5: 800 XP
  new_level := 1 + FLOOR(SQRT(COALESCE(new_xp, 0) / 50.0));

  -- Update level
  UPDATE profiles
  SET level = new_level
  WHERE id = user_id_param AND level IS DISTINCT FROM new_level;
END;
$$;
