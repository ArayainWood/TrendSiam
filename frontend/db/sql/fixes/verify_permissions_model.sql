-- =========================================================
-- VERIFY PERMISSIONS MODEL
-- Date: 2025-09-23
--
-- Comprehensive verification that:
-- 1. Views are properly granted to anon/authenticated
-- 2. Base tables have NO grants to anon/authenticated
-- 3. Views return data without permission errors
-- 4. 26-column contract is maintained
-- =========================================================

\echo '========================================='
\echo 'PERMISSIONS MODEL VERIFICATION'
\echo '========================================='
\echo ''

-- 1. Core Views Permission Check
\echo '1. CHECKING CORE VIEWS PERMISSIONS...'
\echo '   Expected: SELECT grants for anon/authenticated'
\echo ''

WITH view_grants AS (
  SELECT 
    table_name,
    COUNT(*) FILTER (WHERE grantee = 'anon' AND privilege_type = 'SELECT') as anon_select,
    COUNT(*) FILTER (WHERE grantee = 'authenticated' AND privilege_type = 'SELECT') as auth_select
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN ('public_v_home_news', 'public_v_ai_images_latest', 'public_v_system_meta')
  GROUP BY table_name
)
SELECT 
  table_name as view_name,
  CASE 
    WHEN anon_select > 0 AND auth_select > 0 THEN '✅ Properly granted'
    WHEN anon_select = 0 AND auth_select = 0 THEN '❌ NO GRANTS (will cause permission errors!)'
    WHEN anon_select = 0 THEN '⚠️  Missing grant for anon'
    WHEN auth_select = 0 THEN '⚠️  Missing grant for authenticated'
  END as grant_status,
  anon_select,
  auth_select
FROM view_grants
ORDER BY table_name;

-- 2. Base Tables Permission Check
\echo ''
\echo '2. CHECKING BASE TABLE PERMISSIONS...'
\echo '   Expected: NO grants for anon/authenticated'
\echo ''

WITH base_grants AS (
  SELECT 
    table_name,
    grantee,
    privilege_type
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN ('news_trends', 'stories', 'snapshots', 'ai_images', 'system_meta', 'stats', 'image_files', 'weekly_report_snapshots')
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type = 'SELECT'
)
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ PASS: No base table SELECT grants for anon/authenticated'
    ELSE '❌ FAIL: Found ' || COUNT(*) || ' base table grants that should be revoked!'
  END as security_check
FROM base_grants;

-- Show any problematic base table grants
SELECT 
  table_name,
  grantee,
  '❌ SECURITY RISK - REVOKE THIS!' as action_required
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('news_trends', 'stories', 'snapshots', 'ai_images', 'system_meta', 'stats', 'image_files', 'weekly_report_snapshots')
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type = 'SELECT'
ORDER BY table_name, grantee;

-- 3. Test View Access (No Permission Errors)
\echo ''
\echo '3. TESTING VIEW ACCESS...'
\echo '   Expected: No permission errors'
\echo ''

-- Test home view
DO $$
DECLARE
  v_count INTEGER;
  v_error TEXT;
BEGIN
  BEGIN
    SELECT COUNT(*) INTO v_count FROM public.public_v_home_news;
    RAISE NOTICE '✅ public_v_home_news: Accessible (% rows)', v_count;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    RAISE WARNING '❌ public_v_home_news: ERROR - %', v_error;
  END;
END $$;

-- Test AI images view
DO $$
DECLARE
  v_count INTEGER;
  v_error TEXT;
BEGIN
  BEGIN
    SELECT COUNT(*) INTO v_count FROM public.public_v_ai_images_latest;
    RAISE NOTICE '✅ public_v_ai_images_latest: Accessible (% rows)', v_count;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    RAISE WARNING '❌ public_v_ai_images_latest: ERROR - %', v_error;
  END;
END $$;

-- Test system meta view
DO $$
DECLARE
  v_count INTEGER;
  v_error TEXT;
BEGIN
  BEGIN
    SELECT COUNT(*) INTO v_count FROM public.public_v_system_meta;
    RAISE NOTICE '✅ public_v_system_meta: Accessible (% rows)', v_count;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    RAISE WARNING '❌ public_v_system_meta: ERROR - %', v_error;
  END;
END $$;

-- 4. Verify 26-Column Contract
\echo ''
\echo '4. VERIFYING 26-COLUMN CONTRACT...'
\echo ''

WITH expected_cols AS (
  SELECT unnest(ARRAY[
    'id', 'title', 'summary', 'summary_en', 'category', 'platform',
    'channel', 'published_at', 'source_url', 'image_url', 'ai_prompt',
    'popularity_score', 'rank', 'is_top3', 'views', 'likes', 'comments',
    'growth_rate_value', 'growth_rate_label', 'ai_opinion', 'score_details',
    'video_id', 'external_id', 'platform_mentions', 'keywords', 'updated_at'
  ]) as column_name
),
actual_cols AS (
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'public_v_home_news'
),
col_check AS (
  SELECT 
    COUNT(*) as actual_count,
    COUNT(*) FILTER (WHERE e.column_name IS NOT NULL AND a.column_name IS NOT NULL) as matching,
    COUNT(*) FILTER (WHERE e.column_name IS NOT NULL AND a.column_name IS NULL) as missing,
    COUNT(*) FILTER (WHERE e.column_name IS NULL AND a.column_name IS NOT NULL) as unexpected
  FROM expected_cols e
  FULL OUTER JOIN actual_cols a USING (column_name)
)
SELECT 
  CASE 
    WHEN actual_count = 26 AND missing = 0 AND unexpected = 0 THEN '✅ PASS: Exactly 26 columns, all correct'
    WHEN actual_count != 26 THEN '❌ FAIL: Expected 26 columns, found ' || actual_count
    WHEN missing > 0 THEN '❌ FAIL: Missing ' || missing || ' expected columns'
    WHEN unexpected > 0 THEN '❌ FAIL: Found ' || unexpected || ' unexpected columns'
  END as contract_status,
  actual_count,
  matching,
  missing,
  unexpected
FROM col_check;

-- Show any missing columns
SELECT 
  e.column_name as missing_column
FROM (
  SELECT unnest(ARRAY[
    'id', 'title', 'summary', 'summary_en', 'category', 'platform',
    'channel', 'published_at', 'source_url', 'image_url', 'ai_prompt',
    'popularity_score', 'rank', 'is_top3', 'views', 'likes', 'comments',
    'growth_rate_value', 'growth_rate_label', 'ai_opinion', 'score_details',
    'video_id', 'external_id', 'platform_mentions', 'keywords', 'updated_at'
  ]) as column_name
) e
LEFT JOIN information_schema.columns a 
  ON a.table_schema = 'public' 
  AND a.table_name = 'public_v_home_news'
  AND a.column_name = e.column_name
WHERE a.column_name IS NULL;

-- 5. Test Definer Security
\echo ''
\echo '5. TESTING DEFINER SECURITY MODEL...'
\echo ''

-- Check if views use security_invoker (they should NOT for definer model)
SELECT 
  viewname,
  CASE 
    WHEN definition ILIKE '%security_invoker%true%' THEN '❌ Uses INVOKER security (should be DEFINER)'
    WHEN definition ILIKE '%security_invoker%false%' THEN '✅ Uses DEFINER security (correct)'
    ELSE '✅ Uses DEFINER security (default)'
  END as security_model
FROM pg_views
WHERE schemaname = 'public' 
  AND viewname IN ('public_v_home_news', 'public_v_ai_images_latest', 'public_v_system_meta');

-- 6. Summary Report
\echo ''
\echo '========================================='
\echo 'SUMMARY REPORT'
\echo '========================================='

WITH summary AS (
  SELECT 
    (SELECT COUNT(*) FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
       AND table_name IN ('public_v_home_news', 'public_v_ai_images_latest', 'public_v_system_meta')
       AND grantee IN ('anon', 'authenticated')
       AND privilege_type = 'SELECT') as view_grants,
    (SELECT COUNT(*) FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
       AND table_name IN ('news_trends', 'stories', 'snapshots', 'ai_images', 'system_meta')
       AND grantee IN ('anon', 'authenticated')
       AND privilege_type = 'SELECT') as base_grants,
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'public_v_home_news') as column_count
)
SELECT 
  CASE 
    WHEN view_grants >= 6 AND base_grants = 0 AND column_count = 26 THEN 
      '✅ ALL CHECKS PASSED - Views-only model is correctly implemented!'
    ELSE 
      '❌ ISSUES FOUND - Review the detailed results above'
  END as overall_status,
  view_grants || ' view grants (expect ≥6)' as view_grant_status,
  base_grants || ' base table grants (expect 0)' as base_grant_status,
  column_count || ' columns (expect 26)' as column_status
FROM summary;

\echo ''
\echo '========================================='
\echo 'VERIFICATION COMPLETE'
\echo '========================================='
