-- =====================================================
-- MangaLoop: User Sessions & Device / Location Tracking
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Create user_sessions table
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_name TEXT,
  avatar_url TEXT,
  is_guest BOOLEAN DEFAULT FALSE,

  -- Device Information
  device_name TEXT,
  device_model TEXT,
  platform TEXT, -- 'Android', 'iOS', 'Web', 'Windows', 'macOS', 'Linux'
  os_version TEXT,
  app_version TEXT,
  browser TEXT,
  screen_resolution TEXT,
  user_agent TEXT,

  -- Network & Geolocation Information
  ip_address TEXT,
  country TEXT,
  country_code TEXT,
  region TEXT,
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  timezone TEXT,
  isp TEXT,

  -- Activity & Timestamps
  last_screen TEXT,
  session_count INTEGER DEFAULT 1,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for high-performance querying
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active ON public.user_sessions (last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_platform ON public.user_sessions (platform);
CREATE INDEX IF NOT EXISTS idx_user_sessions_country_code ON public.user_sessions (country_code);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON public.user_sessions (session_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Allow anyone (authenticated or anonymous guest) to insert or update their session
DROP POLICY IF EXISTS "Public can insert user_sessions" ON public.user_sessions;
CREATE POLICY "Public can insert user_sessions"
  ON public.user_sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update user_sessions" ON public.user_sessions;
CREATE POLICY "Public can update user_sessions"
  ON public.user_sessions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users / admins to view session data
DROP POLICY IF EXISTS "Authenticated can view user_sessions" ON public.user_sessions;
CREATE POLICY "Authenticated can view user_sessions"
  ON public.user_sessions FOR SELECT
  TO authenticated, anon
  USING (true);

-- 5. RPC to upsert / heartbeat user sessions cleanly
CREATE OR REPLACE FUNCTION public.record_user_session(
  p_session_id TEXT,
  p_user_id UUID DEFAULT NULL,
  p_user_email TEXT DEFAULT NULL,
  p_user_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_is_guest BOOLEAN DEFAULT FALSE,
  p_device_name TEXT DEFAULT NULL,
  p_device_model TEXT DEFAULT NULL,
  p_platform TEXT DEFAULT NULL,
  p_os_version TEXT DEFAULT NULL,
  p_app_version TEXT DEFAULT NULL,
  p_browser TEXT DEFAULT NULL,
  p_screen_resolution TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_country_code TEXT DEFAULT NULL,
  p_region TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL,
  p_isp TEXT DEFAULT NULL,
  p_last_screen TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_sessions (
    session_id, user_id, user_email, user_name, avatar_url, is_guest,
    device_name, device_model, platform, os_version, app_version, browser,
    screen_resolution, user_agent, ip_address, country, country_code,
    region, city, latitude, longitude, timezone, isp, last_screen,
    first_seen, last_active_at, created_at
  )
  VALUES (
    p_session_id, p_user_id, p_user_email, p_user_name, p_avatar_url, p_is_guest,
    p_device_name, p_device_model, p_platform, p_os_version, p_app_version, p_browser,
    p_screen_resolution, p_user_agent, p_ip_address, p_country, p_country_code,
    p_region, p_city, p_latitude, p_longitude, p_timezone, p_isp, p_last_screen,
    NOW(), NOW(), NOW()
  )
  ON CONFLICT (session_id) DO UPDATE SET
    user_id = COALESCE(EXCLUDED.user_id, user_sessions.user_id),
    user_email = COALESCE(EXCLUDED.user_email, user_sessions.user_email),
    user_name = COALESCE(EXCLUDED.user_name, user_sessions.user_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, user_sessions.avatar_url),
    is_guest = EXCLUDED.is_guest,
    device_name = COALESCE(EXCLUDED.device_name, user_sessions.device_name),
    device_model = COALESCE(EXCLUDED.device_model, user_sessions.device_model),
    platform = COALESCE(EXCLUDED.platform, user_sessions.platform),
    os_version = COALESCE(EXCLUDED.os_version, user_sessions.os_version),
    app_version = COALESCE(EXCLUDED.app_version, user_sessions.app_version),
    browser = COALESCE(EXCLUDED.browser, user_sessions.browser),
    screen_resolution = COALESCE(EXCLUDED.screen_resolution, user_sessions.screen_resolution),
    user_agent = COALESCE(EXCLUDED.user_agent, user_sessions.user_agent),
    ip_address = COALESCE(EXCLUDED.ip_address, user_sessions.ip_address),
    country = COALESCE(EXCLUDED.country, user_sessions.country),
    country_code = COALESCE(EXCLUDED.country_code, user_sessions.country_code),
    region = COALESCE(EXCLUDED.region, user_sessions.region),
    city = COALESCE(EXCLUDED.city, user_sessions.city),
    latitude = COALESCE(EXCLUDED.latitude, user_sessions.latitude),
    longitude = COALESCE(EXCLUDED.longitude, user_sessions.longitude),
    timezone = COALESCE(EXCLUDED.timezone, user_sessions.timezone),
    isp = COALESCE(EXCLUDED.isp, user_sessions.isp),
    last_screen = COALESCE(EXCLUDED.last_screen, user_sessions.last_screen),
    last_active_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.record_user_session TO anon, authenticated;
