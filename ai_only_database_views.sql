-- AI-Only Database Views Update
-- This removes all external thumbnail generation from database views
-- and ensures only AI-generated images are used

-- Update weekly_public_view to use AI images only
DROP VIEW IF EXISTS weekly_public_view CASCADE;
CREATE VIEW weekly_public_view
WITH (security_invoker = true) AS
SELECT 
  n.id,
  n.video_id,
  n.title,
  n.summary,
  n.summary_en,
  n.platform,
  n.popularity_score,
  n.popularity_score_precise,
  n.date as published_date,
  n.category,
  n.ai_image_url,
  n.ai_image_prompt,
  -- Only use AI images - no external thumbnails
  n.ai_image_url as display_image_url,
  n.channel,
  n.view_count,
  n.description,
  n.duration,
  n.like_count,
  n.comment_count,
  n.reason,
  n.raw_view,
  n.growth_rate,
  n.platform_mentions,
  n.keywords,
  n.ai_opinion,
  n.score_details,
  n.created_at,
  n.updated_at,
  -- Add analysis field from ai_opinion
  CASE 
    WHEN n.ai_opinion IS NOT NULL AND n.ai_opinion != ''
    THEN json_build_object('text', n.ai_opinion)
    ELSE NULL
  END as analysis
FROM news_trends n
WHERE n.published_date >= (CURRENT_DATE - INTERVAL '7 days')
ORDER BY n.popularity_score_precise DESC NULLS LAST, n.id ASC;

-- Grant permissions
GRANT SELECT ON weekly_public_view TO anon;
GRANT SELECT ON weekly_public_view TO authenticated;

-- Update any other views that might use external thumbnails
-- This ensures consistent AI-only behavior across the entire database
