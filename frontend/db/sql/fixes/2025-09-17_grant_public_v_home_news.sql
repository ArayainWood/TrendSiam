-- =========================================================
-- GRANT PUBLIC_V_HOME_NEWS
-- Date: 2025-09-17
--
-- Harden public_v_home_news view with invoker rights + grants
-- NOTE: Run this AFTER the view has been created/updated
-- =========================================================

BEGIN;

-- Ensure view uses SECURITY INVOKER (respects RLS)
ALTER VIEW public.public_v_home_news SET (security_invoker = true);

-- Grant SELECT to anon and authenticated users
GRANT SELECT ON public.public_v_home_news TO anon;
GRANT SELECT ON public.public_v_home_news TO authenticated;

-- Also ensure grants on other critical public views
-- (These may not exist in all deployments, so we'll check first)
DO $$
BEGIN
  -- Grant on public_v_weekly_stats if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'public_v_weekly_stats'
  ) THEN
    GRANT SELECT ON public.public_v_weekly_stats TO anon, authenticated;
  END IF;

  -- Grant on public_v_weekly_snapshots if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'public_v_weekly_snapshots'
  ) THEN
    GRANT SELECT ON public.public_v_weekly_snapshots TO anon, authenticated;
  END IF;
END $$;

COMMIT;
