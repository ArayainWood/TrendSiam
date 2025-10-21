-- =========================================================
-- VERIFY METADATA FIX
-- Run this after applying all migrations to verify success
-- =========================================================

\echo '========================================='
\echo 'METADATA FIX VERIFICATION'
\echo '========================================='
\echo ''

-- 1. Check home view exists and has data
\echo '1. Checking home view...'
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '⚠️  View returns 0 rows (check if snapshots exist)'
    ELSE '✅ View has ' || COUNT(*) || ' rows'
  END as home_view_status
FROM public.public_v_home_news;

-- 2. Check for duplicate stories
\echo ''
\echo '2. Checking for duplicates...'
WITH dups AS (
  SELECT id, COUNT(*) as cnt
  FROM public.public_v_home_news 
  GROUP BY id 
  HAVING COUNT(*) > 1
)
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ No duplicate stories'
    ELSE '❌ Found ' || COUNT(*) || ' duplicate IDs'
  END as duplicate_check
FROM dups;

-- 3. Check public metadata view
\echo ''
\echo '3. Checking public_v_system_meta...'
SELECT 
  key,
  value,
  CASE 
    WHEN key = 'home_freshness_policy' THEN 
      CASE 
        WHEN value = 'latest_snapshot:72h_primary|30d_fallback' THEN '✅ Correct'
        ELSE '❌ Unexpected value'
      END
    ELSE '✅'
  END as status
FROM public.public_v_system_meta 
WHERE key IN ('home_freshness_policy', 'home_limit', 'top3_max', 'home_columns_hash')
ORDER BY key;

-- 4. Verify base table has the policy
\echo ''
\echo '4. Checking system_meta base table...'
SELECT 
  'Base table check:' as check_type,
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ Policy exists in system_meta'
    ELSE '❌ Policy not found in system_meta'
  END as status
FROM system_meta 
WHERE key = 'home_freshness_policy' 
  AND value = 'latest_snapshot:72h_primary|30d_fallback';

-- 5. Check view permissions
\echo ''
\echo '5. Checking view permissions...'
SELECT 
  grantee,
  privilege_type,
  CASE 
    WHEN grantee IN ('anon', 'authenticated') AND privilege_type = 'SELECT' THEN '✅'
    ELSE '❓'
  END as status
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
  AND table_name = 'public_v_home_news'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee;

-- 6. Verify column count
\echo ''
\echo '6. Verifying 26-column contract...'
WITH col_count AS (
  SELECT COUNT(*) as cnt
  FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'public_v_home_news'
)
SELECT 
  CASE 
    WHEN cnt = 26 THEN '✅ Exactly 26 columns'
    ELSE '❌ Expected 26 columns, found ' || cnt
  END as column_check
FROM col_count;

-- 7. Sample Top-3 policy check
\echo ''
\echo '7. Sample Top-3 policy check...'
SELECT 
  rank,
  is_top3,
  CASE 
    WHEN is_top3 AND image_url IS NOT NULL THEN '✅ Has image'
    WHEN is_top3 AND image_url IS NULL THEN '⚠️  Missing image'
    WHEN NOT is_top3 AND image_url IS NULL THEN '✅ No image (correct)'
    ELSE '❌ Policy violation!'
  END as image_policy
FROM public.public_v_home_news
ORDER BY rank
LIMIT 5;

\echo ''
\echo '========================================='
\echo 'VERIFICATION COMPLETE'
\echo '========================================='
