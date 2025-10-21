-- =========================================================
-- VERIFY PERMISSIONS FOR HOME AND AI BRIDGE VIEWS
-- Date: 2025-09-23
--
-- Run this after migrations to verify:
-- - Views exist and return data
-- - No permission errors
-- - Correct grants (views yes, base tables no)
-- - 26-column contract maintained
-- =========================================================

\echo '========================================='
\echo 'AI IMAGES PERMISSIONS VERIFICATION'
\echo '========================================='
\echo ''

-- 1. Home view returns data (0+ ok depending on data)
\echo '1. Checking home view...'
SELECT 
  COUNT(*) AS home_rows,
  CASE 
    WHEN COUNT(*) = 0 THEN '⚠️  No rows (check if snapshots exist)'
    ELSE '✅ ' || COUNT(*) || ' rows returned'
  END as status
FROM public.public_v_home_news;

-- 2. Can read bridge view
\echo ''
\echo '2. Checking AI images bridge view...'
SELECT 
  COUNT(*) AS ai_bridge_rows,
  CASE 
    WHEN COUNT(*) = 0 THEN '⚠️  No AI images found'
    ELSE '✅ ' || COUNT(*) || ' AI images accessible'
  END as status
FROM public.public_v_ai_images_latest;

-- 3. No duplicates by id in home view
\echo ''
\echo '3. Checking for duplicate stories...'
WITH dups AS (
  SELECT id, COUNT(*) as cnt
  FROM public.public_v_home_news 
  GROUP BY id 
  HAVING COUNT(*) > 1
)
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ No duplicate IDs'
    ELSE '❌ Found ' || COUNT(*) || ' duplicate IDs'
  END as duplicate_check
FROM dups;

-- 4. Check grants (critical security check)
\echo ''
\echo '4. Checking permissions (CRITICAL)...'
\echo 'Views should have SELECT grants for anon/authenticated'
\echo 'Base tables should NOT have grants for anon/authenticated'
\echo ''

WITH grants_check AS (
  SELECT 
    table_name,
    grantee,
    privilege_type,
    CASE 
      WHEN table_name LIKE 'public_v_%' AND grantee IN ('anon', 'authenticated') AND privilege_type = 'SELECT' THEN '✅ Correct'
      WHEN table_name NOT LIKE 'public_v_%' AND grantee IN ('anon', 'authenticated') THEN '❌ SECURITY RISK!'
      ELSE '✓ OK'
    END as status
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN ('public_v_home_news', 'public_v_ai_images_latest', 'ai_images', 'news_trends', 'snapshots')
    AND grantee IN ('anon', 'authenticated', 'postgres', 'service_role')
  ORDER BY 
    CASE table_name 
      WHEN 'public_v_home_news' THEN 1
      WHEN 'public_v_ai_images_latest' THEN 2
      ELSE 3
    END,
    table_name, 
    grantee
)
SELECT 
  table_name,
  grantee,
  privilege_type,
  status
FROM grants_check;

-- 5. Contract: 26 columns in home view
\echo ''
\echo '5. Verifying 26-column contract...'
WITH col_check AS (
  SELECT 
    COUNT(*) AS col_count,
    array_agg(column_name ORDER BY ordinal_position) as columns
  FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'public_v_home_news'
)
SELECT 
  CASE 
    WHEN col_count = 26 THEN '✅ Exactly 26 columns'
    ELSE '❌ Expected 26 columns, found ' || col_count
  END as column_check,
  col_count as actual_count
FROM col_check;

-- 6. Sample Top-3 with images
\echo ''
\echo '6. Sample Top-3 items (should have images)...'
SELECT 
  rank,
  is_top3,
  CASE 
    WHEN image_url IS NOT NULL THEN '✅ Has image'
    ELSE '⚠️  No image'
  END as image_status,
  LEFT(title, 50) || '...' as title_preview
FROM public.public_v_home_news
WHERE is_top3 = true
ORDER BY rank
LIMIT 3;

-- 7. Sample non-Top-3 (should NOT have images)
\echo ''
\echo '7. Sample non-Top-3 items (should NOT have images)...'
SELECT 
  rank,
  is_top3,
  CASE 
    WHEN image_url IS NULL THEN '✅ No image (correct)'
    ELSE '❌ Has image (policy violation!)'
  END as image_status,
  LEFT(title, 50) || '...' as title_preview
FROM public.public_v_home_news
WHERE is_top3 = false
ORDER BY rank
LIMIT 3;

-- 8. Bridge view sample
\echo ''
\echo '8. Sample from AI images bridge view...'
SELECT 
  news_id,
  LEFT(image_url, 60) || '...' as image_url_preview,
  created_at
FROM public.public_v_ai_images_latest
ORDER BY created_at DESC
LIMIT 5;

-- 9. Final security summary
\echo ''
\echo '========================================='
\echo 'SECURITY SUMMARY'
\echo '========================================='

WITH security_summary AS (
  SELECT 
    COUNT(*) FILTER (WHERE table_name = 'ai_images' AND grantee IN ('anon', 'authenticated')) as ai_base_grants,
    COUNT(*) FILTER (WHERE table_name = 'news_trends' AND grantee IN ('anon', 'authenticated')) as news_base_grants,
    COUNT(*) FILTER (WHERE table_name = 'snapshots' AND grantee IN ('anon', 'authenticated')) as snap_base_grants,
    COUNT(*) FILTER (WHERE table_name = 'public_v_home_news' AND grantee IN ('anon', 'authenticated') AND privilege_type = 'SELECT') as home_view_grants,
    COUNT(*) FILTER (WHERE table_name = 'public_v_ai_images_latest' AND grantee IN ('anon', 'authenticated') AND privilege_type = 'SELECT') as ai_view_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
)
SELECT 
  CASE 
    WHEN ai_base_grants = 0 THEN '✅ ai_images: No anon/auth grants (correct)'
    ELSE '❌ ai_images: Has ' || ai_base_grants || ' anon/auth grants (SECURITY RISK!)'
  END as ai_images_security,
  CASE 
    WHEN news_base_grants = 0 THEN '✅ news_trends: No anon/auth grants (correct)'
    ELSE '❌ news_trends: Has ' || news_base_grants || ' anon/auth grants (SECURITY RISK!)'
  END as news_trends_security,
  CASE 
    WHEN snap_base_grants = 0 THEN '✅ snapshots: No anon/auth grants (correct)'
    ELSE '❌ snapshots: Has ' || snap_base_grants || ' anon/auth grants (SECURITY RISK!)'
  END as snapshots_security,
  CASE 
    WHEN home_view_grants >= 2 THEN '✅ public_v_home_news: Has grants'
    ELSE '❌ public_v_home_news: Missing grants'
  END as home_view_status,
  CASE 
    WHEN ai_view_grants >= 2 THEN '✅ public_v_ai_images_latest: Has grants'
    ELSE '❌ public_v_ai_images_latest: Missing grants'
  END as ai_view_status
FROM security_summary;

\echo ''
\echo '========================================='
\echo 'VERIFICATION COMPLETE'
\echo '========================================='
