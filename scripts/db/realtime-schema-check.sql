/**
 * Real-Time Schema Validation
 * Date: 2025-10-08
 * Purpose: Validate actual DB state before making changes
 */

SET client_min_messages TO NOTICE;

\echo '========================================='
\echo 'REAL-TIME DATABASE SCHEMA VALIDATION'
\echo '========================================='
\echo ''

-- ============================================================================
-- PART 1: news_trends Table Schema (Telemetry Target)
-- ============================================================================
\echo '--- PART 1: news_trends Columns ---'
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'news_trends'
  AND column_name IN ('view_count', 'site_click_count', 'web_view_count')
ORDER BY column_name;

\echo ''

-- ============================================================================
-- PART 2: ai_images Table Schema (NO ASSUMPTIONS)
-- ============================================================================
\echo '--- PART 2: ai_images Actual Columns ---'
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'ai_images'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- PART 3: ai_images Row Count and Sample
-- ============================================================================
\echo '--- PART 3: ai_images Data Availability ---'
SELECT COUNT(*) AS total_rows FROM ai_images;

\echo ''
\echo '--- Sample ai_images rows (if any) ---'
SELECT 
  id,
  news_id,
  LEFT(image_url, 60) AS image_url_preview,
  LEFT(prompt, 50) AS prompt_preview,
  model,
  created_at
FROM ai_images
ORDER BY created_at DESC
LIMIT 5;

\echo ''

-- ============================================================================
-- PART 4: Current View Definitions
-- ============================================================================
\echo '--- PART 4: public_v_ai_images_latest Definition ---'
SELECT definition
FROM pg_views
WHERE schemaname = 'public' AND viewname = 'public_v_ai_images_latest';

\echo ''

-- ============================================================================
-- PART 5: home_feed_v1 Columns (Current State)
-- ============================================================================
\echo '--- PART 5: home_feed_v1 Current Columns ---'
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'home_feed_v1'
  AND column_name IN ('views', 'video_views', 'web_view_count', 'site_click_count')
ORDER BY column_name;

\echo ''

-- ============================================================================
-- PART 6: Sample Data - Views Values
-- ============================================================================
\echo '--- PART 6: Sample Views Data (Top-3) ---'
SELECT 
  id,
  LEFT(title, 40) AS title,
  rank,
  is_top3,
  views,
  web_view_count
FROM public.home_feed_v1
WHERE rank <= 3
ORDER BY rank;

\echo ''
\echo '========================================='
\echo 'END OF REAL-TIME VALIDATION'
\echo '========================================='

