-- Fix for weekly_public_view to ensure proper ordering and no date filtering issues
-- This ensures the homepage shows the actual Top items by score

-- First, let's check what the current view is doing
SELECT 
    'Current Top-3 in news_trends' as source,
    id,
    title,
    popularity_score_precise,
    ai_image_url,
    published_date,
    updated_at
FROM news_trends
ORDER BY popularity_score_precise DESC
LIMIT 3;

-- Drop and recreate the view without restrictive date filters
DROP VIEW IF EXISTS public.weekly_public_view CASCADE;

CREATE OR REPLACE VIEW public.weekly_public_view
WITH (security_invoker = true) AS
SELECT 
  n.id,
  n.video_id,
  n.title,
  n.summary,
  n.summary_en,
  n.category,
  n.platform,
  n.published_date,
  n.popularity_score,
  n.popularity_score_precise,
  n.date,
  n.ai_image_url,
  n.ai_image_prompt,
  n.channel,
  n.view_count,
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
  n.description,
  n.duration,
  n.summary_date,
  -- Add rank based on ordering
  ROW_NUMBER() OVER (ORDER BY n.popularity_score_precise DESC, n.id ASC) as rank
FROM public.news_trends n
WHERE 
  -- Much wider window to ensure we don't exclude high-scoring items
  -- Show items updated in last 30 days OR published in last 60 days
  (n.updated_at >= NOW() - INTERVAL '30 days')
  OR (n.published_date >= NOW() - INTERVAL '60 days')
  OR (n.created_at >= NOW() - INTERVAL '30 days')
  
  -- Data quality filters
  AND n.title IS NOT NULL 
  AND n.title != ''
  AND n.popularity_score_precise IS NOT NULL
  
-- CRITICAL: Consistent ordering with pipeline
ORDER BY n.popularity_score_precise DESC, n.id ASC;

-- Grant permissions
GRANT SELECT ON public.weekly_public_view TO authenticated;
GRANT SELECT ON public.weekly_public_view TO anon;

-- Add comment
COMMENT ON VIEW public.weekly_public_view IS 
'Fixed weekly view with wider date window to ensure high-scoring items appear. Orders by popularity_score_precise DESC consistently.';

-- Verify the fix
SELECT 
    'Top-3 in weekly_public_view after fix' as source,
    id,
    title,
    popularity_score_precise,
    ai_image_url,
    rank
FROM weekly_public_view
LIMIT 3;
