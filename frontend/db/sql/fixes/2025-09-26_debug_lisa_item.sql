-- =========================================================
-- DEBUG LISA ITEM DATA
-- Date: 2025-09-26
--
-- Targeted check for LISA items to ensure all fields populated
-- =========================================================

\echo '========== LISA ITEM CHECK =========='

-- 1. Check LISA in the view
\echo '\n--- LISA in public_v_home_news ---'
SELECT 
  id,
  title,
  platform,
  channel,
  -- Check key fields
  CASE WHEN summary_en IS NOT NULL THEN '✓ HAS' ELSE '✗ MISSING' END AS summary_en_status,
  CASE WHEN ai_opinion IS NOT NULL THEN '✓ HAS' ELSE '✗ MISSING' END AS ai_opinion_status,
  CASE WHEN score_details IS NOT NULL THEN '✓ HAS' ELSE '✗ MISSING' END AS score_details_status,
  popularity_score,
  rank,
  is_top3,
  views,
  likes,
  comments,
  growth_rate_value,
  growth_rate_label,
  CASE WHEN image_url IS NOT NULL THEN '✓ HAS' ELSE '✗ NULL' END AS image_status,
  updated_at
FROM public.public_v_home_news
WHERE title ILIKE '%LISA%' OR channel ILIKE '%LISA%'
ORDER BY rank
LIMIT 5;

-- 2. Show actual content for first LISA item
\echo '\n--- LISA Content Details ---'
SELECT 
  title,
  substring(summary, 1, 100) || '...' AS summary_preview,
  substring(summary_en, 1, 100) || '...' AS summary_en_preview,
  substring(ai_opinion, 1, 200) || '...' AS ai_opinion_preview,
  jsonb_pretty(score_details) AS score_details_formatted
FROM public.public_v_home_news
WHERE title ILIKE '%LISA%' OR channel ILIKE '%LISA%'
ORDER BY rank
LIMIT 1;

-- 3. Trace data sources for LISA
\echo '\n--- LISA Data Sources ---'

-- Check news_trends
\echo '\n[news_trends table]'
SELECT 
  id,
  title,
  CASE WHEN summary_en IS NOT NULL THEN '✓' ELSE '✗' END AS has_summary_en,
  CASE WHEN ai_opinion IS NOT NULL THEN '✓' ELSE '✗' END AS has_ai_opinion,
  CASE WHEN score_details IS NOT NULL THEN '✓' ELSE '✗' END AS has_score_details,
  popularity_score,
  created_at
FROM news_trends
WHERE title ILIKE '%LISA%'
LIMIT 3;

-- Check stories
\echo '\n[stories table]'
SELECT 
  story_id,
  source_id,
  title,
  CASE WHEN summary_en IS NOT NULL THEN '✓' ELSE '✗' END AS has_summary_en,
  platform,
  channel
FROM stories
WHERE title ILIKE '%LISA%'
LIMIT 3;

-- Check snapshots
\echo '\n[snapshots table]'
SELECT 
  s.story_id,
  s.snapshot_date,
  s.popularity_score,
  s.rank,
  s.view_count,
  s.growth_rate,
  st.title
FROM snapshots s
JOIN stories st ON st.story_id = s.story_id
WHERE st.title ILIKE '%LISA%'
ORDER BY s.snapshot_date DESC
LIMIT 3;

-- 4. Summary statistics
\echo '\n--- Summary Statistics ---'
WITH lisa_stats AS (
  SELECT 
    COUNT(*) AS total_lisa_items,
    COUNT(summary_en) AS with_summary_en,
    COUNT(ai_opinion) AS with_ai_opinion,
    COUNT(score_details) AS with_score_details,
    COUNT(CASE WHEN popularity_score > 0 THEN 1 END) AS with_popularity_score,
    COUNT(CASE WHEN is_top3 THEN 1 END) AS in_top3,
    COUNT(image_url) AS with_images
  FROM public.public_v_home_news
  WHERE title ILIKE '%LISA%' OR channel ILIKE '%LISA%'
)
SELECT 
  total_lisa_items,
  with_summary_en || '/' || total_lisa_items AS summary_en_coverage,
  with_ai_opinion || '/' || total_lisa_items AS ai_opinion_coverage,
  with_score_details || '/' || total_lisa_items AS score_details_coverage,
  with_popularity_score || '/' || total_lisa_items AS popularity_score_coverage,
  in_top3 || ' items' AS top3_count,
  with_images || ' items' AS image_count
FROM lisa_stats;

-- 5. Check for any errors in score_details JSON
\echo '\n--- Score Details Validation ---'
SELECT 
  id,
  title,
  CASE 
    WHEN score_details IS NULL THEN 'NULL'
    WHEN jsonb_typeof(score_details) = 'object' THEN 'Valid JSON'
    ELSE 'Invalid'
  END AS score_details_status,
  pg_typeof(score_details) AS score_details_type
FROM public.public_v_home_news
WHERE (title ILIKE '%LISA%' OR channel ILIKE '%LISA%')
  AND score_details IS NOT NULL
LIMIT 5;
