/**
 * Real-Time Check: Current home_feed_v1 State
 * Date: 2025-10-08
 */

\echo '========================================='
\echo 'CURRENT home_feed_v1 STATE'
\echo '========================================='
\echo ''

-- Check all columns in order
\echo '--- ALL columns in home_feed_v1 ---'
SELECT 
  column_name,
  data_type,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'home_feed_v1'
ORDER BY ordinal_position;

\echo ''

-- Check specifically for views/video_views
\echo '--- Check views columns existence ---'
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'home_feed_v1' AND column_name = 'views'
  ) THEN 'EXISTS' ELSE 'MISSING' END AS views_column,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'home_feed_v1' AND column_name = 'video_views'
  ) THEN 'EXISTS' ELSE 'MISSING' END AS video_views_column;

\echo ''
\echo '========================================='

