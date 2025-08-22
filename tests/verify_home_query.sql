-- Verification query for Home page data
-- This query simulates what the Home page should fetch
-- Run this directly in Supabase to verify data availability

-- IMPORTANT: This query does NOT join ai_images table
-- Images are accessed via ai_image_url field directly

-- Get today's date in YYYY-MM-DD format (adjust timezone as needed)
-- Note: Replace CURRENT_DATE with actual date if testing specific day
WITH today_filter AS (
  SELECT CURRENT_DATE::text as today_date
)
SELECT 
  n.id,
  n.video_id,
  n.title,
  n.popularity_score_precise,
  n.view_count,
  n.published_date,
  n.date,
  n.ai_image_url,
  -- Verification flags
  CASE WHEN n.ai_image_url IS NOT NULL THEN 'YES' ELSE 'NO' END as has_ai_image,
  ROW_NUMBER() OVER (ORDER BY 
    n.popularity_score_precise DESC,
    n.view_count DESC,
    n.published_date DESC,
    n.title ASC
  ) as expected_rank
FROM 
  news_trends n,
  today_filter tf
WHERE 
  n.date = tf.today_date
  AND n.popularity_score_precise IS NOT NULL
ORDER BY 
  n.popularity_score_precise DESC,
  n.view_count DESC,
  n.published_date DESC,
  n.title ASC
LIMIT 20;

-- Additional verification: Check if we have today's data
SELECT 
  COUNT(*) as total_today_items,
  MIN(popularity_score_precise) as min_score,
  MAX(popularity_score_precise) as max_score,
  COUNT(CASE WHEN ai_image_url IS NOT NULL THEN 1 END) as items_with_images
FROM news_trends
WHERE date = CURRENT_DATE;
