-- =============================================
-- [weekly-db-fix] Canonical Weekly Public View for TrendSiam
-- =============================================
-- This view implements the specification requirements for end-to-end consistency:
-- - Uses security_invoker for proper RLS compliance
-- - Provides latest snapshot per story window function
-- - Stable ordering: popularity_score_precise DESC, id ASC
-- - Consistent image resolution (AI → snapshot → YouTube fallback)
-- - 7-day filtering consistent with server logic

-- Drop existing view if it exists  
DROP VIEW IF EXISTS public.weekly_public_view;

-- [weekly-db-fix] Stable "weekly_public_view" (security invoker)
CREATE OR REPLACE VIEW public.weekly_public_view
WITH (security_invoker = true) AS
WITH latest_snapshots AS (
  SELECT
    s.*,
    ROW_NUMBER() OVER (
      PARTITION BY s.story_id
      ORDER BY s.snapshot_date DESC, s.updated_at DESC NULLS LAST
    ) AS rn
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
  n.popularity_score_precise AS score,
  n.ai_image_url,
  n.ai_image_prompt,
  n.ai_opinion,
  
  -- [weekly-db-fix] Consistent display image resolution with fallback chain
  COALESCE(
    NULLIF(n.ai_image_url, ''),
    NULLIF(ls.image_url, ''),
    CASE WHEN n.video_id IS NOT NULL AND n.video_id != ''
      THEN 'https://i.ytimg.com/vi/'||n.video_id||'/hqdefault.jpg'
    END
  ) AS display_image_url,
  
  -- Metrics from canonical source with snapshot fallback
  COALESCE(n.view_count, ls.view_count, '0') AS view_count,
  COALESCE(n.like_count, ls.like_count, '0') AS like_count,
  COALESCE(n.comment_count, ls.comment_count, '0') AS comment_count,
  
  -- System fields
  n.updated_at,
  n.created_at,
  n.date,
  n.description,
  n.channel,
  n.data_source,
  n.fetched_at,
  
  -- [weekly-db-fix] Analysis field for UI consumption
  CASE 
    WHEN n.ai_opinion IS NOT NULL AND n.ai_opinion != '' AND n.ai_opinion != 'No analysis available'
    THEN n.ai_opinion
    ELSE NULL
  END AS analysis

FROM public.news_trends n
LEFT JOIN latest_snapshots ls ON ls.story_id = n.video_id AND ls.rn = 1
WHERE 
  -- [weekly-db-fix] 7-day window filtering (matches fetchWeeklyCanon logic)
  (n.published_date >= NOW() - INTERVAL '7 days')
  OR (n.created_at >= NOW() - INTERVAL '7 days')
  
  -- Data quality filters
  AND n.title IS NOT NULL 
  AND n.title != ''
  AND n.popularity_score_precise IS NOT NULL
  
-- [weekly-db-fix] Stable ordering consistent with server sort logic
ORDER BY n.popularity_score_precise DESC, n.id ASC;

-- Grant proper permissions for authenticated and anonymous access
GRANT SELECT ON public.weekly_public_view TO authenticated;
GRANT SELECT ON public.weekly_public_view TO anon;

-- Add documentation comment
COMMENT ON VIEW public.weekly_public_view IS 
'[weekly-db-fix] Canonical security invoker view for weekly trending news. Provides stable ordering, image resolution, 7-day filtering, and latest snapshot metrics. Used by Next.js API routes for consistent data access between pipeline and UI.';

-- Create performance indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_news_trends_weekly_performance 
ON public.news_trends(popularity_score_precise DESC, id ASC) 
WHERE (published_date >= NOW() - INTERVAL '7 days' OR created_at >= NOW() - INTERVAL '7 days')
  AND title IS NOT NULL 
  AND title != ''
  AND popularity_score_precise IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_snapshots_story_latest 
ON public.snapshots(story_id, snapshot_date DESC, updated_at DESC) 
WHERE story_id IS NOT NULL;

-- Verification query (can be run manually to test)
/*
SELECT 
  'weekly_public_view_verification' AS test,
  COUNT(*) AS total_rows,
  COUNT(display_image_url) AS rows_with_display_image,
  COUNT(analysis) AS rows_with_analysis,
  MAX(score) AS max_score,
  MIN(score) AS min_score
FROM public.weekly_public_view
LIMIT 1;
*/
