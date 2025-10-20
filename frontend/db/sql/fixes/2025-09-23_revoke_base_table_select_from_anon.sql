-- =========================================================
-- REVOKE BASE TABLE SELECT FROM ANON/AUTHENTICATED
-- Date: 2025-09-23
--
-- Ensures that anon and authenticated roles have NO SELECT
-- permissions on base tables. They should only read from
-- public_v_* views.
--
-- This is a critical security hardening step.
-- =========================================================

BEGIN;

-- =========================================
-- REVOKE SELECT ON BASE TABLES
-- =========================================

-- Revoke any existing SELECT permissions on base tables
-- Note: This won't error if permissions don't exist
REVOKE SELECT ON TABLE news_trends FROM anon, authenticated;
REVOKE SELECT ON TABLE stories FROM anon, authenticated;
REVOKE SELECT ON TABLE snapshots FROM anon, authenticated;
REVOKE SELECT ON TABLE ai_images FROM anon, authenticated;
REVOKE SELECT ON TABLE system_meta FROM anon, authenticated;
REVOKE SELECT ON TABLE stats FROM anon, authenticated;
REVOKE SELECT ON TABLE image_files FROM anon, authenticated;
REVOKE SELECT ON TABLE weekly_report_snapshots FROM anon, authenticated;

-- =========================================
-- ENSURE VIEWS HAVE PROPER GRANTS
-- =========================================

-- These should already be granted, but let's be explicit
GRANT SELECT ON public.public_v_home_news TO anon, authenticated;
GRANT SELECT ON public.public_v_ai_images_latest TO anon, authenticated;
GRANT SELECT ON public.public_v_system_meta TO anon, authenticated;

-- Grant on weekly views if they exist
DO $$
BEGIN
  -- Check if weekly stats view exists and grant
  IF EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'public_v_weekly_stats'
  ) THEN
    GRANT SELECT ON public.public_v_weekly_stats TO anon, authenticated;
  END IF;

  -- Check if weekly snapshots view exists and grant
  IF EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'public_v_weekly_snapshots'
  ) THEN
    GRANT SELECT ON public.public_v_weekly_snapshots TO anon, authenticated;
  END IF;
END $$;

-- =========================================
-- VERIFICATION
-- =========================================

DO $$
DECLARE
  v_base_grants INTEGER;
  v_view_grants INTEGER;
BEGIN
  -- Count base table grants (should be 0)
  SELECT COUNT(*)
  INTO v_base_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN ('news_trends', 'stories', 'snapshots', 'ai_images', 'system_meta', 'stats', 'image_files', 'weekly_report_snapshots')
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type = 'SELECT';

  IF v_base_grants > 0 THEN
    RAISE WARNING 'Found % SELECT grants on base tables for anon/authenticated - this should be 0!', v_base_grants;
  ELSE
    RAISE NOTICE '✅ No SELECT grants on base tables for anon/authenticated (correct)';
  END IF;

  -- Count view grants (should be at least 3 for core views)
  SELECT COUNT(*)
  INTO v_view_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN ('public_v_home_news', 'public_v_ai_images_latest', 'public_v_system_meta')
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type = 'SELECT';

  IF v_view_grants >= 6 THEN  -- 3 views x 2 roles (anon, authenticated)
    RAISE NOTICE '✅ Core views have proper SELECT grants (%)', v_view_grants;
  ELSE
    RAISE WARNING 'Only % SELECT grants found on core views - expected at least 6', v_view_grants;
  END IF;
END $$;

-- =========================================
-- DETAILED GRANT REPORT
-- =========================================

-- Show current state of grants for audit trail
SELECT 
  table_name,
  grantee,
  privilege_type,
  CASE 
    WHEN table_name LIKE 'public_v_%' THEN 'VIEW'
    ELSE 'BASE TABLE'
  END as object_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type = 'SELECT'
  AND table_name IN (
    -- Base tables
    'news_trends', 'stories', 'snapshots', 'ai_images', 'system_meta', 'stats', 'image_files', 'weekly_report_snapshots',
    -- Views
    'public_v_home_news', 'public_v_ai_images_latest', 'public_v_system_meta', 'public_v_weekly_stats', 'public_v_weekly_snapshots'
  )
ORDER BY 
  CASE WHEN table_name LIKE 'public_v_%' THEN 0 ELSE 1 END,
  table_name, 
  grantee;

COMMIT;
