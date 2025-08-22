-- [weekly-db-fix] Create/Update weekly_public_view with SECURITY INVOKER
-- This fixes the Security Definer warning and ensures proper 7-day filtering
-- with stable ordering and image resolution

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.weekly_public_view;

-- [weekly-db-fix] Create view with SECURITY INVOKER 
CREATE VIEW public.weekly_public_view
WITH (security_invoker = true)
AS
WITH latest_snapshots AS (
  -- Get most recent snapshot per story for up-to-date metrics
  SELECT s.*, ROW_NUMBER() OVER (
    PARTITION BY s.story_id 
    ORDER BY s.snapshot_date DESC, s.updated_at DESC NULLS LAST
  ) as rn
  FROM public.snapshots s
  WHERE s.story_id IS NOT NULL
)
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
  n.ai_image_url,
  n.ai_image_prompt,
  n.ai_opinion,
  n.description,
  n.channel,
  n.view_count,
  n.like_count,
  n.comment_count,
  n.date,
  n.created_at,
  n.updated_at,
  n.data_source,
  n.fetched_at,
  -- [weekly-db-fix] Pre-resolved display image with fallback chain
  COALESCE(
    NULLIF(n.ai_image_url, ''),
    NULLIF(ls.image_url, ''), -- Use image from latest snapshot if AI image is missing
    CASE WHEN n.video_id IS NOT NULL AND n.video_id != ''
         THEN 'https://i.ytimg.com/vi/'||n.video_id||'/hqdefault.jpg'
         END
  ) as display_image_url,
  -- [weekly-db-fix] Include analysis field derived from ai_opinion
  CASE 
    WHEN n.ai_opinion IS NOT NULL AND n.ai_opinion != '' AND n.ai_opinion != 'No analysis available'
    THEN n.ai_opinion
    ELSE NULL
  END as analysis
FROM public.news_trends n
LEFT JOIN latest_snapshots ls ON ls.story_id = n.video_id AND ls.rn = 1
WHERE 
  -- [weekly-db-fix] 7-day window filtering
  (n.published_date >= NOW() - INTERVAL '7 days' OR n.created_at >= NOW() - INTERVAL '7 days')
  AND n.title IS NOT NULL 
  AND n.title != ''
  AND n.popularity_score_precise IS NOT NULL
-- [weekly-db-fix] Stable ordering consistent with server logic
ORDER BY n.popularity_score_precise DESC, n.id ASC;

-- Grant appropriate permissions
GRANT SELECT ON public.weekly_public_view TO authenticated;
GRANT SELECT ON public.weekly_public_view TO anon;

-- Add comment explaining the view purpose
COMMENT ON VIEW public.weekly_public_view IS 
'[weekly-db-fix] Security invoker view for weekly trending news data with stable ordering, image resolution, and 7-day filtering. Used by Next.js API routes for consistent data access.';
