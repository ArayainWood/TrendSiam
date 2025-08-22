-- Check Top 3 AI images for today's batch
-- This query verifies if the Top 3 items have ai_image_url populated

-- Get today's top 3 stories based on the exact ordering used by the Home page
WITH today_top3 AS (
  SELECT 
    id,
    video_id,
    title,
    popularity_score_precise,
    view_count,
    published_date,
    date,
    ai_image_url,
    image_status,
    image_updated_at,
    ROW_NUMBER() OVER (
      ORDER BY 
        popularity_score_precise DESC,
        view_count DESC,
        published_date DESC,
        title ASC
    ) AS rank
  FROM news_trends
  WHERE date = CURRENT_DATE AT TIME ZONE 'Asia/Bangkok'
    AND popularity_score_precise IS NOT NULL
  ORDER BY 
    popularity_score_precise DESC,
    view_count DESC,
    published_date DESC,
    title ASC
  LIMIT 3
)
SELECT 
  rank,
  video_id,
  title,
  popularity_score_precise,
  CASE 
    WHEN ai_image_url IS NOT NULL AND ai_image_url != '' THEN 'YES'
    ELSE 'NO'
  END AS has_ai_image,
  ai_image_url,
  image_status,
  image_updated_at
FROM today_top3
ORDER BY rank;

-- Summary statistics
SELECT 
  COUNT(*) AS total_today,
  COUNT(CASE WHEN ai_image_url IS NOT NULL AND ai_image_url != '' THEN 1 END) AS with_images,
  COUNT(CASE WHEN image_status = 'ready' THEN 1 END) AS images_ready
FROM news_trends
WHERE date = CURRENT_DATE AT TIME ZONE 'Asia/Bangkok';

-- Check for any recent image generation attempts
SELECT 
  video_id,
  title,
  ai_image_url,
  image_status,
  image_updated_at,
  updated_at
FROM news_trends
WHERE image_updated_at IS NOT NULL
  AND image_updated_at >= NOW() - INTERVAL '1 day'
ORDER BY image_updated_at DESC
LIMIT 10;
