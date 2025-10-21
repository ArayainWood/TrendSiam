-- =========================================================
-- SCHEMA INSPECTION FOR HOME VIEW FIX
-- Date: 2025-09-26
--
-- Inspect table structures to understand data sources
-- =========================================================

-- 1. List columns for relevant tables
\echo '========== TABLE SCHEMAS =========='

\echo '\n--- STORIES TABLE ---'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'stories'
ORDER BY ordinal_position;

\echo '\n--- SNAPSHOTS TABLE ---'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'snapshots'
ORDER BY ordinal_position;

\echo '\n--- NEWS_TRENDS TABLE ---'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'news_trends'
ORDER BY ordinal_position;

\echo '\n--- AI_IMAGES TABLE ---'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'ai_images'
ORDER BY ordinal_position;

-- 2. Count records in each table
\echo '\n========== RECORD COUNTS =========='
SELECT 'stories' AS table_name, COUNT(*) AS count FROM stories
UNION ALL
SELECT 'snapshots', COUNT(*) FROM snapshots
UNION ALL
SELECT 'news_trends', COUNT(*) FROM news_trends
UNION ALL
SELECT 'ai_images', COUNT(*) FROM ai_images;

-- 3. Check if public_v_ai_images_latest exists
\echo '\n========== EXISTING VIEWS =========='
SELECT viewname 
FROM pg_views 
WHERE schemaname = 'public' 
  AND viewname IN ('public_v_home_news', 'public_v_ai_images_latest', 'public_v_system_meta')
ORDER BY viewname;

-- 4. Sample data to understand relationships
\echo '\n========== SAMPLE LISA DATA =========='

-- Check stories for LISA
\echo '\n--- LISA in stories ---'
SELECT story_id, title, summary_en, platform, channel, category
FROM stories 
WHERE title ILIKE '%LISA%' OR channel ILIKE '%LISA%'
LIMIT 3;

-- Check snapshots for LISA
\echo '\n--- LISA in snapshots (with analysis) ---'
SELECT s.story_id, s.snapshot_date, s.popularity_score, s.ai_opinion, 
       LENGTH(s.score_details::text) AS score_details_length,
       s.growth_rate
FROM snapshots s
JOIN stories st ON st.story_id = s.story_id
WHERE st.title ILIKE '%LISA%' OR st.channel ILIKE '%LISA%'
ORDER BY s.snapshot_date DESC
LIMIT 3;

-- Check news_trends for LISA
\echo '\n--- LISA in news_trends ---'
SELECT id, title, summary_en, popularity_score, ai_opinion,
       LENGTH(score_details::text) AS score_details_length
FROM news_trends
WHERE title ILIKE '%LISA%' OR channel ILIKE '%LISA%'
LIMIT 3;

-- 5. Check snapshots columns for analysis fields
\echo '\n========== SNAPSHOTS ANALYSIS COLUMNS =========='
SELECT 
  COUNT(*) AS total_snapshots,
  COUNT(ai_opinion) AS has_ai_opinion,
  COUNT(score_details) AS has_score_details,
  COUNT(CASE WHEN score_details::text ~ '^\s*\{.*\}\s*$' THEN 1 END) AS valid_json_score_details
FROM snapshots
WHERE snapshot_date >= NOW() - INTERVAL '7 days';
