-- =============================================
-- TrendSiam Weekly Public View Migration
-- Ensures analysis field is available for Additional Analysis feature
-- =============================================

-- Drop the view if it exists to recreate with analysis field
DROP VIEW IF EXISTS weekly_public_view;

-- Create/update weekly_public_view with analysis field mapped from ai_opinion
CREATE VIEW weekly_public_view AS
SELECT 
  id,
  title,
  summary,
  summary_en,
  platform,
  popularity_score,
  popularity_score_precise,
  date,
  category,
  ai_image_url,
  ai_image_prompt,
  
  -- Original metadata fields
  video_id,
  channel,
  view_count,
  published_date,
  description,
  duration,
  like_count,
  comment_count,
  reason,
  
  -- View details metadata
  raw_view,
  growth_rate,
  platform_mentions,
  keywords,
  ai_opinion,
  score_details,
  
  -- Map ai_opinion to analysis for Additional Analysis feature
  CASE 
    WHEN ai_opinion IS NOT NULL AND ai_opinion != '' AND ai_opinion != 'No analysis available'
    THEN ai_opinion
    ELSE NULL
  END as analysis,
  
  -- System fields
  created_at,
  updated_at
FROM news_trends
WHERE 
  -- Only show recent trends (last 30 days for flexibility)
  created_at >= NOW() - INTERVAL '30 days'
  -- Exclude items with invalid data
  AND title IS NOT NULL 
  AND title != ''
  AND popularity_score IS NOT NULL;

-- Ensure proper RLS policy for public read access via service role
-- The existing RLS on news_trends should automatically apply to the view

-- Add comment for documentation
COMMENT ON VIEW weekly_public_view IS 'Public view for weekly trending news with analysis field mapped from ai_opinion. Used by TrendSiam frontend APIs.';

-- Create index on the view's base table for performance if not exists
CREATE INDEX IF NOT EXISTS idx_news_trends_analysis_lookup 
ON news_trends(created_at DESC, popularity_score_precise DESC) 
WHERE ai_opinion IS NOT NULL;

-- Verify the view works
SELECT 
  'weekly_public_view_verification' as test,
  COUNT(*) as total_rows,
  COUNT(analysis) as rows_with_analysis,
  COUNT(ai_opinion) as rows_with_ai_opinion
FROM weekly_public_view;
