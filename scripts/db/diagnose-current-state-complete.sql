/**
 * Complete Current State Diagnosis
 * Date: 2025-10-08
 * Purpose: Diagnose views data, images, and schema for fixes
 */

\echo '========================================='
\echo 'COMPLETE STATE DIAGNOSIS'
\echo '========================================='
\echo ''

-- ============================================================================
-- PART 1: Check Video Views Data
-- ============================================================================
\echo '--- PART 1: Video Views in home_feed_v1 (Top-5) ---'
SELECT 
  id,
  LEFT(title, 35) AS title,
  rank,
  is_top3,
  video_views,
  views,
  web_view_count,
  likes,
  comments
FROM public.home_feed_v1
ORDER BY rank ASC NULLS LAST
LIMIT 5;

\echo ''

-- ============================================================================
-- PART 2: AI Images Availability
-- ============================================================================
\echo '--- PART 2: AI Images Sources ---'
SELECT 'ai_images' AS table_name, COUNT(*) AS row_count FROM ai_images
UNION ALL
SELECT 'image_files' AS table_name, COUNT(*) AS row_count FROM image_files;

\echo ''
\echo '--- PART 3: AI Images Latest View Data ---'
SELECT 
  story_id,
  LEFT(image_url, 60) AS image_url_preview,
  ai_prompt IS NOT NULL AS has_prompt
FROM public.public_v_ai_images_latest
LIMIT 5;

\echo ''

-- ============================================================================
-- PART 4: Top-3 Image Status in home_feed_v1
-- ============================================================================
\echo '--- PART 4: Top-3 Image Status ---'
SELECT 
  id,
  LEFT(title, 35) AS title,
  rank,
  is_top3,
  image_url IS NOT NULL AS has_ai_image,
  ai_prompt IS NOT NULL AS has_prompt,
  LEFT(image_url, 60) AS image_preview
FROM public.home_feed_v1
WHERE is_top3 = true
ORDER BY rank;

\echo ''

-- ============================================================================
-- PART 5: Platform Thumbnail Availability (Fallback Source)
-- ============================================================================
\echo '--- PART 5: Platform Thumbnails (news_trends) ---'
SELECT 
  id,
  LEFT(title, 35) AS title,
  ai_image_url IS NOT NULL AS has_platform_image,
  LEFT(ai_image_url, 60) AS platform_image_preview
FROM news_trends
WHERE title IS NOT NULL
ORDER BY popularity_score DESC NULLS LAST
LIMIT 3;

\echo ''
\echo '========================================='
\echo 'END DIAGNOSIS'
\echo '========================================='

