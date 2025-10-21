/**
 * Verify Backward Compatibility Fix
 * Date: 2025-10-08
 */

\echo '========================================='
\echo 'BACKWARD COMPATIBILITY VERIFICATION'
\echo '========================================='
\echo ''

-- Test 1: Column existence
\echo '--- TEST 1: Column Existence ---'
SELECT 
  column_name,
  data_type,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'home_feed_v1'
  AND column_name IN ('views', 'video_views', 'web_view_count')
ORDER BY ordinal_position;

\echo ''

-- Test 2: Sample data - check all three columns work
\echo '--- TEST 2: Sample Data (All Metrics) ---'
SELECT 
  id,
  LEFT(title, 35) AS title,
  rank,
  video_views AS platform_youtube,
  views AS legacy_for_api,
  web_view_count AS site_clicks,
  video_views = views AS backward_compat_ok
FROM public.home_feed_v1
WHERE rank <= 3
ORDER BY rank;

\echo ''

-- Test 3: Count check
\echo '--- TEST 3: Row Count ---'
SELECT COUNT(*) AS total_rows FROM public.home_feed_v1;

\echo ''
\echo '========================================='
\echo 'If backward_compat_ok = true for all rows,'
\echo 'then legacy API code will work correctly.'
\echo '========================================='

