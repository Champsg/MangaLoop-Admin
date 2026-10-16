-- =====================================================
-- MangaLoop Admin Dashboard Fix: Ban & Delete User RPCs
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Ensure banned column exists on profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT FALSE;

-- 2. Create RPC to ban / unban users (SECURITY DEFINER allows admins to bypass RLS)
CREATE OR REPLACE FUNCTION public.update_user_ban_status(
  target_user_id UUID,
  is_banned_status BOOLEAN
)
RETURNS VOID AS $$
DECLARE
  caller_email TEXT;
  caller_is_admin BOOLEAN;
BEGIN
  -- Get caller's email and admin status
  SELECT email, is_admin INTO caller_email, caller_is_admin
  FROM public.profiles
  WHERE id = auth.uid();

  -- Verify admin privileges
  IF caller_email != 'shujaatbhat8@gmail.com' AND COALESCE(caller_is_admin, FALSE) = FALSE THEN
    RAISE EXCEPTION 'Access Denied: Only admins can ban or unban users';
  END IF;

  -- Prevent banning super admin
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id AND email = 'shujaatbhat8@gmail.com') THEN
    RAISE EXCEPTION 'Cannot ban super admin user';
  END IF;

  -- Update profiles table
  UPDATE public.profiles
  SET banned = is_banned_status,
      updated_at = NOW()
  WHERE id = target_user_id;

  -- Sync with Supabase Auth (banned_until)
  IF is_banned_status THEN
    UPDATE auth.users SET banned_until = '3000-01-01 00:00:00+00' WHERE id = target_user_id;
  ELSE
    UPDATE auth.users SET banned_until = NULL WHERE id = target_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.update_user_ban_status(UUID, BOOLEAN) TO authenticated;


-- 3. Create RPC to delete users by admin (SECURITY DEFINER allows deleting from auth.users)
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(
  target_user_id UUID
)
RETURNS VOID AS $$
DECLARE
  caller_email TEXT;
  caller_is_admin BOOLEAN;
BEGIN
  -- Get caller's email and admin status
  SELECT email, is_admin INTO caller_email, caller_is_admin
  FROM public.profiles
  WHERE id = auth.uid();

  -- Verify admin privileges
  IF caller_email != 'shujaatbhat8@gmail.com' AND COALESCE(caller_is_admin, FALSE) = FALSE THEN
    RAISE EXCEPTION 'Access Denied: Only admins can delete users';
  END IF;

  -- Prevent deleting super admin
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id AND email = 'shujaatbhat8@gmail.com') THEN
    RAISE EXCEPTION 'Cannot delete super admin user';
  END IF;

  -- Delete associated user data first
  DELETE FROM public.manga_library WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_by_admin(UUID) TO authenticated;
