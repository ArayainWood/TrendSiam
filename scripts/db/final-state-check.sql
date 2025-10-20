/**
 * Final State Check - All Columns and Data
 * Date: 2025-10-08
 */

\echo '========================================='
\echo 'FINAL STATE VERIFICATION'
\echo '========================================='
\echo ''

-- Check all expected columns exist
\echo '--- Column Inventory ---'
SELECT column_name, data_type, ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'home_feed_v1'
  AND column_name IN (
    'video_views', 'views', 'web_view_count', 
    'likes', 'comments', 'growth_rate_value', 'growth_rate_label'
  )
ORDER BY ordinal_position;

\echo ''
\echo '--- Top-5 Data (All Metrics) ---'
SELECT 
  rank,
  LEFT(title, 30) AS title,
  video_views,
  views,
  web_view_count,
  likes,
  comments,
  growth_rate_label
FROM public.home_feed_v1
ORDER BY rank ASC NULLS LAST
LIMIT 5;

\echo ''
\echo '--- Engagement Rates (Top-3) ---'
SELECT 
  rank,
  video_views,
  likes,
  comments,
  ROUND((likes::numeric / NULLIF(video_views, 0) * 100)::numeric, 2) AS like_rate_pct,
  ROUND((comments::numeric / NULLIF(video_views, 0) * 100)::numeric, 2) AS comment_rate_pct
FROM public.home_feed_v1
WHERE rank <= 3
ORDER BY rank;

\echo ''
\echo '========================================='

