-- Check auxiliary fields for today's top stories
-- This helps identify which supplementary fields are missing from news_trends

WITH today AS (
  SELECT *
  FROM news_trends
  WHERE date = (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok')
  ORDER BY popularity_score_precise DESC, view_count DESC, published_date DESC, title ASC
  LIMIT 10
)
SELECT
  video_id,
  title,
  -- Primary fields
  popularity_score_precise,
  view_count,
  
  -- Auxiliary fields we're investigating
  ai_opinion,
  score_details,
  keywords,
  growth_rate,
  platform,
  platform_mentions,
  duration,
  channel,
  category,
  like_count,
  comment_count,
  published_date,
  summary,
  summary_en,
  
  -- Check for empty vs NULL
  CASE 
    WHEN ai_opinion IS NULL THEN 'NULL'
    WHEN ai_opinion = '' THEN 'EMPTY'
    WHEN ai_opinion = 'N/A' THEN 'N/A'
    ELSE 'HAS_VALUE'
  END AS ai_opinion_status,
  
  CASE 
    WHEN score_details IS NULL THEN 'NULL'
    WHEN score_details = '' THEN 'EMPTY'
    ELSE 'HAS_VALUE'
  END AS score_details_status,
  
  -- Timestamps
  created_at,
  updated_at
FROM today;

-- Summary statistics
SELECT 
  COUNT(*) AS total_today,
  COUNT(ai_opinion) AS with_ai_opinion,
  COUNT(score_details) AS with_score_details,
  COUNT(keywords) AS with_keywords,
  COUNT(growth_rate) AS with_growth_rate,
  COUNT(platform_mentions) AS with_platform_mentions
FROM news_trends
WHERE date = (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok');
