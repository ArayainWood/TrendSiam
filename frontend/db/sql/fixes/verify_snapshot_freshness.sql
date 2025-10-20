-- =========================================================
-- QUICK VERIFICATION: Snapshot-based Freshness
-- Run this after applying the migrations
-- =========================================================

\echo '========================================='
\echo 'SNAPSHOT FRESHNESS VERIFICATION'
\echo '========================================='
\echo ''

-- 1) View has rows (if there are real snapshots in 72h/30d):
\echo '1. Checking home view row count...'
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '⚠️  View returns 0 rows (check if snapshots exist in time windows)'
    ELSE '✅ View has ' || COUNT(*) || ' rows'
  END as view_status
FROM public.public_v_home_news;

-- 2) Reality check on snapshots window:
\echo ''
\echo '2. Checking snapshot data availability...'
WITH snapshot_windows AS (
  SELECT 
    COUNT(*) FILTER (WHERE snapshot_date >= now() - interval '72 hours') as recent_72h,
    COUNT(*) FILTER (WHERE snapshot_date >= now() - interval '30 days') as recent_30d
  FROM snapshots
)
SELECT 
  '📊 Snapshots - Last 72h: ' || recent_72h || ', Last 30d: ' || recent_30d as snapshot_status
FROM snapshot_windows;

-- 3) No duplicates per story in the view:
\echo ''
\echo '3. Checking for duplicate stories...'
WITH duplicates AS (
  SELECT id, COUNT(*) as cnt
  FROM public.public_v_home_news
  GROUP BY id 
  HAVING COUNT(*) > 1
)
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ No duplicate stories found'
    ELSE '❌ ERROR: Found ' || COUNT(*) || ' duplicate story IDs'
  END as duplicate_status
FROM duplicates;

-- 4) Top-3 enforcement looks correct (sample):
\echo ''
\echo '4. Checking Top-3 image/prompt policy...'
\echo 'Sample of top 10 stories:'
SELECT 
  id,
  rank,
  is_top3,
  CASE 
    WHEN is_top3 AND image_url IS NOT NULL THEN '✅ Has image'
    WHEN is_top3 AND image_url IS NULL THEN '⚠️  Missing image'
    WHEN NOT is_top3 AND image_url IS NULL THEN '✅ No image (correct)'
    ELSE '❌ Non-Top3 has image!'
  END as image_status,
  CASE 
    WHEN is_top3 AND ai_prompt IS NOT NULL THEN '✅'
    WHEN is_top3 AND ai_prompt IS NULL THEN '⚠️'
    WHEN NOT is_top3 AND ai_prompt IS NULL THEN '✅'
    ELSE '❌'
  END as prompt_ok
FROM public.public_v_home_news 
ORDER BY rank 
LIMIT 10;

-- 5) Policy visible in public metadata:
\echo ''
\echo '5. Checking system metadata...'
SELECT 
  key,
  value,
  CASE 
    WHEN key = 'home_freshness_policy' AND value = 'latest_snapshot:72h_primary|30d_fallback' THEN '✅ Correct'
    WHEN key = 'home_freshness_policy' THEN '⚠️  Unexpected value'
    WHEN key = 'home_columns_hash' AND value IS NOT NULL THEN '✅ Hash stored'
    ELSE '✅'
  END as status
FROM public.public_v_system_meta 
WHERE key IN ('home_freshness_policy', 'home_columns_hash', 'home_limit', 'top3_max')
ORDER BY key;

-- 6) Column count verification
\echo ''
\echo '6. Verifying 26-column contract...'
WITH column_check AS (
  SELECT COUNT(*) as col_count
  FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'public_v_home_news'
)
SELECT 
  CASE 
    WHEN col_count = 26 THEN '✅ Exactly 26 columns as expected'
    ELSE '❌ ERROR: Expected 26 columns, found ' || col_count
  END as column_status
FROM column_check;

\echo ''
\echo '========================================='
\echo 'VERIFICATION COMPLETE'
\echo '========================================='
