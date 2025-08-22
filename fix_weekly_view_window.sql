-- Fix weekly_public_view to show recently processed items
-- This ensures pipeline results appear immediately on homepage

DROP VIEW IF EXISTS public.weekly_public_view;

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
  n.popularity_score_precise,  -- Add explicit field for compatibility
  n.ai_image_url,
  n.ai_image_prompt,
  n.ai_opinion,
  
  -- Consistent display image resolution with fallback chain
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
  
  -- Analysis field for UI consumption
  CASE 
    WHEN n.ai_opinion IS NOT NULL AND n.ai_opinion != '' AND n.ai_opinion != 'No analysis available'
    THEN n.ai_opinion
    ELSE NULL
  END AS analysis

FROM public.news_trends n
LEFT JOIN latest_snapshots ls ON ls.story_id = n.video_id AND ls.rn = 1
WHERE 
  -- Modified filter: Show items updated in last 7 days OR published in last 30 days
  -- This ensures fresh pipeline runs appear immediately
  (n.updated_at >= NOW() - INTERVAL '7 days')
  OR (n.published_date >= NOW() - INTERVAL '30 days')
  
  -- Data quality filters
  AND n.title IS NOT NULL 
  AND n.title != ''
  AND n.popularity_score_precise IS NOT NULL
  
-- Stable ordering consistent with server sort logic
ORDER BY n.popularity_score_precise DESC, n.id ASC;

-- Grant proper permissions
GRANT SELECT ON public.weekly_public_view TO authenticated;
GRANT SELECT ON public.weekly_public_view TO anon;

-- Update comment
COMMENT ON VIEW public.weekly_public_view IS 
'Weekly trending view with expanded window to show recently processed items. Shows items updated in last 7 days OR published in last 30 days.';
