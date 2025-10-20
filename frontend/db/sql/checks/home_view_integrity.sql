-- =========================================================
-- HOME VIEW INTEGRITY CHECK
-- Date: 2025-09-23
--
-- This script performs data quality and integrity checks
-- on the public_v_home_news view.
-- =========================================================

\echo '========================================='
\echo 'HOME VIEW INTEGRITY CHECK'
\echo '========================================='
\echo ''

-- 1. Check view row count
\echo '1. Checking home view data availability...'
WITH view_check AS (
  SELECT COUNT(*) as view_count
  FROM public.public_v_home_news
)
SELECT 
  CASE 
    WHEN view_count = 0 THEN '⚠️  WARNING: Home view returns 0 rows'
    ELSE '✅ Home view has ' || view_count || ' rows'
  END as status
FROM view_check;

-- 2. Check snapshot availability
\echo ''
\echo '2. Checking snapshot data availability...'
WITH snapshot_check AS (
  SELECT 
    COUNT(*) FILTER (WHERE snapshot_date >= NOW() - INTERVAL '72 hours') as recent_72h,
    COUNT(*) FILTER (WHERE snapshot_date >= NOW() - INTERVAL '30 days') as recent_30d,
    COUNT(*) as total_snapshots
  FROM snapshots
)
SELECT 
  '📊 Snapshots - Total: ' || total_snapshots || 
  ', Last 72h: ' || recent_72h || 
  ', Last 30d: ' || recent_30d as snapshot_status
FROM snapshot_check;

-- If view is empty but snapshots exist, check joins
WITH empty_view_check AS (
  SELECT 
    (SELECT COUNT(*) FROM public.public_v_home_news) as view_count,
    (SELECT COUNT(*) FROM snapshots WHERE snapshot_date >= NOW() - INTERVAL '30 days') as snapshot_count
)
SELECT 
  CASE 
    WHEN view_count = 0 AND snapshot_count > 0 THEN 
      E'❌ ERROR: View is empty but snapshots exist!\n   Check: news_trends ↔ stories ↔ snapshots joins'
    ELSE NULL
  END as join_issue
FROM empty_view_check
WHERE view_count = 0 AND snapshot_count > 0;

-- 3. Check for duplicate IDs
\echo ''
\echo '3. Checking for duplicate story IDs...'
WITH duplicates AS (
  SELECT id, COUNT(*) as cnt
  FROM public.public_v_home_news
  GROUP BY id
  HAVING COUNT(*) > 1
)
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ No duplicate IDs found'
    ELSE '❌ ERROR: Found ' || COUNT(*) || ' duplicate IDs'
  END as duplicate_status,
  CASE 
    WHEN COUNT(*) > 0 THEN string_agg(id::text || ' (' || cnt || 'x)', ', ')
    ELSE NULL
  END as duplicate_ids
FROM duplicates;

-- 4. Check column contract
\echo ''
\echo '4. Checking column contract (26 columns expected)...'
WITH column_check AS (
  SELECT 
    array_agg(column_name ORDER BY ordinal_position) as actual_columns,
    COUNT(*) as column_count
  FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'public_v_home_news'
),
expected AS (
  SELECT ARRAY[
    'id', 'title', 'summary', 'summary_en', 'category', 'platform',
    'channel', 'published_at', 'source_url', 'image_url', 'ai_prompt',
    'popularity_score', 'rank', 'is_top3', 'views', 'likes', 'comments',
    'growth_rate_value', 'growth_rate_label', 'ai_opinion', 'score_details',
    'video_id', 'external_id', 'platform_mentions', 'keywords', 'updated_at'
  ] as expected_columns
)
SELECT 
  CASE 
    WHEN c.actual_columns = e.expected_columns THEN '✅ All 26 columns present and in correct order'
    WHEN c.column_count != 26 THEN '❌ ERROR: Expected 26 columns, found ' || c.column_count
    ELSE '❌ ERROR: Column mismatch detected'
  END as column_status,
  CASE 
    WHEN c.actual_columns != e.expected_columns THEN 
      'Missing: ' || array_to_string(
        ARRAY(SELECT unnest(e.expected_columns) EXCEPT SELECT unnest(c.actual_columns)), 
        ', '
      )
    ELSE NULL
  END as missing_columns,
  CASE 
    WHEN c.actual_columns != e.expected_columns THEN 
      'Unexpected: ' || array_to_string(
        ARRAY(SELECT unnest(c.actual_columns) EXCEPT SELECT unnest(e.expected_columns)), 
        ', '
      )
    ELSE NULL
  END as unexpected_columns
FROM column_check c, expected e;

-- 5. Check Top-3 image/prompt policy
\echo ''
\echo '5. Checking Top-3 image/prompt policy enforcement...'
WITH policy_check AS (
  SELECT 
    COUNT(*) FILTER (WHERE NOT is_top3 AND image_url IS NOT NULL) as non_top3_with_images,
    COUNT(*) FILTER (WHERE NOT is_top3 AND ai_prompt IS NOT NULL) as non_top3_with_prompts,
    COUNT(*) FILTER (WHERE is_top3 AND image_url IS NULL) as top3_without_images,
    COUNT(*) FILTER (WHERE is_top3) as total_top3
  FROM public.public_v_home_news
)
SELECT 
  CASE 
    WHEN non_top3_with_images = 0 AND non_top3_with_prompts = 0 THEN '✅ Top-3 policy correctly enforced'
    ELSE '❌ POLICY VIOLATION: ' || 
         CASE WHEN non_top3_with_images > 0 THEN non_top3_with_images || ' non-Top3 items have images ' ELSE '' END ||
         CASE WHEN non_top3_with_prompts > 0 THEN non_top3_with_prompts || ' non-Top3 items have prompts' ELSE '' END
  END as policy_status,
  'Top-3 items: ' || total_top3 || 
  CASE WHEN top3_without_images > 0 THEN ' (⚠️  ' || top3_without_images || ' missing images)' ELSE '' END as top3_info
FROM policy_check;

-- 6. Check data types
\echo ''
\echo '6. Checking critical data types...'
WITH type_check AS (
  SELECT 
    data_type,
    column_name
  FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'public_v_home_news'
    AND column_name IN ('growth_rate_value', 'growth_rate_label', 'views', 'likes', 'comments')
)
SELECT 
  column_name || ': ' || 
  CASE 
    WHEN column_name = 'growth_rate_value' AND data_type = 'numeric' THEN '✅ numeric'
    WHEN column_name = 'growth_rate_label' AND data_type = 'text' THEN '✅ text'
    WHEN column_name IN ('views', 'likes', 'comments') AND data_type = 'bigint' THEN '✅ bigint'
    ELSE '❌ ERROR: Expected ' || 
         CASE column_name 
           WHEN 'growth_rate_value' THEN 'numeric'
           WHEN 'growth_rate_label' THEN 'text'
           ELSE 'bigint'
         END || ', got ' || data_type
  END as type_status
FROM type_check
ORDER BY column_name;

-- 7. Sample data quality
\echo ''
\echo '7. Checking sample data quality...'
WITH sample_data AS (
  SELECT * FROM public.public_v_home_news LIMIT 5
)
SELECT 
  '🔍 Sample item: ' || 
  COALESCE(LEFT(title, 50), '(no title)') || '...' as title,
  'Rank: ' || rank || ', Top-3: ' || is_top3 || 
  ', Score: ' || ROUND(popularity_score::numeric, 2) || 
  ', Views: ' || views as metrics,
  CASE 
    WHEN is_top3 AND image_url IS NOT NULL THEN '✅ Has image'
    WHEN is_top3 AND image_url IS NULL THEN '⚠️  Top-3 missing image'
    WHEN NOT is_top3 AND image_url IS NULL THEN '✅ No image (correct)'
    ELSE '❌ Non-Top3 has image!'
  END as image_status
FROM sample_data
ORDER BY rank
LIMIT 5;

-- 8. Check system meta values
\echo ''
\echo '8. Checking system metadata...'
SELECT 
  key || ': ' || COALESCE(value, '(not set)') as meta_value
FROM public.public_v_system_meta
WHERE key IN ('home_limit', 'top3_max', 'home_freshness_policy', 'home_columns_hash')
ORDER BY key;

\echo ''
\echo '========================================='
\echo 'INTEGRITY CHECK COMPLETE'
\echo '========================================='
