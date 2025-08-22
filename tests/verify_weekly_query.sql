-- Verification query for Weekly Report data
-- This query simulates what the Weekly Report page should fetch
-- Run this directly in Supabase to verify data availability

-- IMPORTANT: This query does NOT join ai_images table
-- Images are accessed via ai_image_url field directly

-- Get 7 days ago date
WITH date_filter AS (
  SELECT (CURRENT_DATE - INTERVAL '7 days')::timestamptz as seven_days_ago
)
SELECT 
  n.id,
  n.video_id,
  n.title,
  n.popularity_score_precise,
  n.view_count,
  n.published_date,
  n.date,
  n.category,
  n.ai_image_url,
  -- Verification flags
  CASE WHEN n.ai_image_url IS NOT NULL THEN 'YES' ELSE 'NO' END as has_ai_image,
  ROW_NUMBER() OVER (ORDER BY 
    n.popularity_score_precise DESC,
    n.id ASC  -- Stable tiebreaker
  ) as expected_rank
FROM 
  news_trends n,
  date_filter df
WHERE 
  n.published_date >= df.seven_days_ago
ORDER BY 
  n.popularity_score_precise DESC,
  n.id ASC
LIMIT 20;

-- Summary statistics for weekly report
WITH date_filter AS (
  SELECT (CURRENT_DATE - INTERVAL '7 days')::timestamptz as seven_days_ago
),
weekly_data AS (
  SELECT * FROM news_trends 
  WHERE published_date >= (SELECT seven_days_ago FROM date_filter)
)
SELECT 
  COUNT(*) as total_stories,
  COUNT(CASE WHEN summary IS NOT NULL THEN 1 END) as stories_with_summaries,
  COUNT(CASE WHEN ai_image_url IS NOT NULL THEN 1 END) as stories_with_images,
  ROUND(AVG(popularity_score), 2) as avg_score,
  COUNT(DISTINCT category) as unique_categories
FROM weekly_data;
