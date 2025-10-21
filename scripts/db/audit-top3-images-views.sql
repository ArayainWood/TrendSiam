/**
 * Audit Top-3 Images, Views Separation, and Growth Rate
 * Date: 2025-10-08
 * Purpose: Diagnose missing AI images, views confusion, and growth rate issues
 */

SET client_min_messages TO NOTICE;

\echo '========================================='
\echo 'TOP-3 IMAGES & VIEWS SEPARATION AUDIT'
\echo '========================================='
\echo ''

-- ============================================================================
-- PART 1: Column Inventory for home_feed_v1
-- ============================================================================
\echo '--- PART 1: home_feed_v1 Columns ---'
SELECT 
  column_name,
  data_type,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'home_feed_v1'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- PART 2: Top-3 Stories with Image/Prompt Check
-- ============================================================================
\echo '--- PART 2: Top-3 Stories (is_top3=true) ---'
SELECT 
  id,
  LEFT(title, 50) AS title,
  rank,
  is_top3,
  image_url IS NOT NULL AS has_image,
  ai_prompt IS NOT NULL AS has_prompt,
  views,
  web_view_count,
  LEFT(image_url, 80) AS image_url_preview
FROM public.home_feed_v1
WHERE is_top3 = true
ORDER BY rank;

\echo ''

-- ============================================================================
-- PART 3: Views Separation Check
-- ============================================================================
\echo '--- PART 3: Views Columns (video vs web) ---'
SELECT 
  'home_feed_v1' AS view_name,
  COUNT(*) AS total_rows,
  COUNT(CASE WHEN views > 0 THEN 1 END) AS rows_with_video_views,
  COUNT(CASE WHEN web_view_count > 0 THEN 1 END) AS rows_with_web_views,
  MAX(views) AS max_video_views,
  MAX(web_view_count) AS max_web_views
FROM public.home_feed_v1;

\echo ''

-- ============================================================================
-- PART 4: Sample Row with All View Fields
-- ============================================================================
\echo '--- PART 4: Sample Row (views separation) ---'
SELECT 
  id,
  LEFT(title, 40) AS title,
  rank,
  views AS video_views,
  web_view_count AS site_views,
  growth_rate_value,
  growth_rate_label
FROM public.home_feed_v1
ORDER BY rank ASC
LIMIT 1;

\echo ''

-- ============================================================================
-- PART 5: Growth Rate Values Check
-- ============================================================================
\echo '--- PART 5: Growth Rate Distribution ---'
SELECT 
  growth_rate_label,
  COUNT(*) AS count,
  MIN(growth_rate_value) AS min_value,
  MAX(growth_rate_value) AS max_value,
  AVG(growth_rate_value) AS avg_value
FROM public.home_feed_v1
WHERE growth_rate_label IS NOT NULL
GROUP BY growth_rate_label
ORDER BY count DESC;

\echo ''

-- ============================================================================
-- PART 6: AI Images View Check
-- ============================================================================
\echo '--- PART 6: public_v_ai_images_latest Columns ---'
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'public_v_ai_images_latest'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- PART 7: AI Images Data Availability
-- ============================================================================
\echo '--- PART 7: AI Images Count by Story ---'
SELECT 
  COUNT(DISTINCT story_id) AS stories_with_images,
  COUNT(*) AS total_image_records
FROM public.public_v_ai_images_latest;

\echo ''

-- ============================================================================
-- PART 8: Check news_trends view_count Source
-- ============================================================================
\echo '--- PART 8: news_trends view_count (telemetry source) ---'
SELECT 
  id,
  LEFT(title, 40) AS title,
  view_count AS telemetry_count_text,
  CASE 
    WHEN view_count ~ '^[0-9]+$' THEN view_count::bigint
    ELSE NULL
  END AS telemetry_count_numeric
FROM news_trends
WHERE title IS NOT NULL
ORDER BY 
  CASE 
    WHEN view_count ~ '^[0-9]+$' THEN view_count::bigint
    ELSE 0
  END DESC
LIMIT 3;

\echo ''
\echo '========================================='
\echo 'END OF AUDIT'
\echo '========================================='

