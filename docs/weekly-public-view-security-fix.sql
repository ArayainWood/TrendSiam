-- =============================================
-- TrendSiam Weekly Public View Security Fix
-- [rank-img-investigation] Fix SECURITY DEFINER warning by using SECURITY INVOKER
-- =============================================

-- Drop the view if it exists to recreate with proper security mode
DROP VIEW IF EXISTS weekly_public_view;

-- [rank-img-investigation] Create view with SECURITY INVOKER (not DEFINER) to avoid security warnings
CREATE VIEW weekly_public_view
WITH (security_invoker = true)
AS
WITH latest_snapshots AS (
  -- Get the most recent snapshot per story for up-to-date metrics
  SELECT 
    n.*,
    ROW_NUMBER() OVER (
      PARTITION BY n.id 
      ORDER BY n.updated_at DESC NULLS LAST, n.created_at DESC
    ) as rn
  FROM news_trends n
  WHERE 
    -- [rank-img-investigation] 7-day window to match fetchWeeklyCanon logic
    (n.published_date >= NOW() - INTERVAL '7 days' 
     OR n.created_at >= NOW() - INTERVAL '7 days')
    -- Exclude invalid data
    AND n.title IS NOT NULL 
    AND n.title != ''
    AND n.popularity_score_precise IS NOT NULL
)
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
  
  -- [rank-img-investigation] Map ai_opinion to analysis for Additional Analysis feature
  CASE 
    WHEN ai_opinion IS NOT NULL AND ai_opinion != '' AND ai_opinion != 'No analysis available'
    THEN ai_opinion
    ELSE NULL
  END as analysis,
  
  -- [rank-img-investigation] Pre-resolved display image with priority fallback
  COALESCE(
    NULLIF(ai_image_url, ''),
    CASE 
      WHEN video_id IS NOT NULL AND video_id != ''
      THEN 'https://i.ytimg.com/vi/' || video_id || '/hqdefault.jpg'
      ELSE NULL
    END
  ) as display_image_url,
  
  -- System fields
  created_at,
  updated_at
FROM latest_snapshots
WHERE rn = 1  -- Only the most recent snapshot per story
ORDER BY popularity_score_precise DESC, id ASC;  -- [rank-img-investigation] Stable ordering

-- Add comment for documentation
COMMENT ON VIEW weekly_public_view IS '[rank-img-investigation] Public view for weekly trending news with SECURITY INVOKER, 7-day window, stable ordering, and pre-resolved images. Used by TrendSiam frontend APIs.';

-- [rank-img-investigation] Create optimized index for view performance
CREATE INDEX IF NOT EXISTS idx_news_trends_weekly_lookup 
ON news_trends(updated_at DESC, created_at DESC, popularity_score_precise DESC) 
WHERE (published_date >= NOW() - INTERVAL '7 days' OR created_at >= NOW() - INTERVAL '7 days')
  AND title IS NOT NULL 
  AND title != ''
  AND popularity_score_precise IS NOT NULL;

-- Verify the view works and has expected data
SELECT 
  'weekly_public_view_security_verification' as test,
  COUNT(*) as total_rows,
  COUNT(analysis) as rows_with_analysis,
  COUNT(display_image_url) as rows_with_images,
  MAX(updated_at) as most_recent_update
FROM weekly_public_view;
