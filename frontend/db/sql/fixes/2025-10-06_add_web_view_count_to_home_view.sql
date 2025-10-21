/**
 * Add web_view_count to home view
 * Date: 2025-10-06
 * Purpose: Expose site tracking view count (from telemetry) in home feed
 * Security: DEFINER view, read-only, no base table grants
 * 
 * IDEMPOTENT: Safe to run multiple times
 */

-- Drop and recreate the home view with web_view_count column
CREATE OR REPLACE VIEW public.public_v_home_news
WITH (security_barrier = true, security_invoker = false)
AS
SELECT 
  -- Existing 26 columns (keep exact order)
  nt.id,
  nt.title,
  nt.summary,
  nt.summary_en,
  nt.category,
  nt.platform,
  nt.channel,
  nt.published_at,
  nt.source_url,
  -- Top-3 image policy (NULL for non-Top-3)
  CASE WHEN nt.rank <= 3 THEN 
    COALESCE(ai.image_url, nt.ai_image_url) 
  ELSE NULL END AS image_url,
  -- Top-3 prompt policy (NULL for non-Top-3)
  CASE WHEN nt.rank <= 3 THEN 
    COALESCE(ai.ai_prompt, nt.ai_image_prompt) 
  ELSE NULL END AS ai_prompt,
  nt.popularity_score,
  nt.rank,
  (nt.rank <= 3) AS is_top3,
  -- Metrics from snapshots (latest)
  COALESCE(s.view_count::bigint, 0) AS views,
  COALESCE(s.like_count::bigint, 0) AS likes,
  COALESCE(s.comment_count::bigint, 0) AS comments,
  -- Growth rate (derived from snapshots)
  COALESCE(s.growth_rate_value, 0) AS growth_rate_value,
  COALESCE(s.growth_rate_label, 'Stable') AS growth_rate_label,
  -- Analysis fields
  s.ai_opinion,
  s.score_details,
  nt.video_id,
  nt.external_id,
  COALESCE(s.platform_mentions, 0) AS platform_mentions,
  nt.keywords,
  nt.updated_at,
  -- NEW: Web view count from site tracking (telemetry)
  COALESCE(
    CAST(NULLIF(REGEXP_REPLACE(nt.view_count, '[^0-9]', '', 'g'), '') AS INTEGER),
    0
  ) AS web_view_count
FROM news_trends nt
LEFT JOIN LATERAL (
  SELECT 
    view_count,
    like_count,
    comment_count,
    popularity_score,
    rank,
    growth_rate,
    -- Parse growth rate
    CASE 
      WHEN growth_rate ~ '^\\d+(\\.\\d+)?' THEN CAST(growth_rate AS NUMERIC)
      WHEN growth_rate ~ '\\d+' THEN CAST(REGEXP_REPLACE(growth_rate, '[^0-9.]', '', 'g') AS NUMERIC)
      ELSE NULL
    END AS growth_rate_value,
    -- Growth rate label
    CASE
      WHEN growth_rate ILIKE '%viral%' THEN 'Viral'
      WHEN growth_rate ILIKE '%rising fast%' THEN 'Rising fast'
      WHEN growth_rate ILIKE '%rising%' THEN 'Rising'
      WHEN growth_rate ILIKE '%stable%' THEN 'Stable'
      ELSE 'Stable'
    END AS growth_rate_label,
    ai_opinion,
    score_details,
    platform_mentions
  FROM snapshots
  WHERE snapshots.story_id = nt.id
  ORDER BY snapshots.snapshot_date DESC
  LIMIT 1
) s ON true
LEFT JOIN public_v_ai_images_latest ai ON ai.news_id = nt.id
WHERE nt.rank IS NOT NULL
ORDER BY nt.rank ASC NULLS LAST;

-- Grant SELECT to anon and authenticated
GRANT SELECT ON public.public_v_home_news TO anon;
GRANT SELECT ON public.public_v_home_news TO authenticated;

-- Update system metadata to reflect the change
INSERT INTO public.system_meta (key, value, updated_at)
VALUES (
  'home_view_version',
  '2025-10-06_web_view_count',
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;

-- Verification query
SELECT 
  'web_view_count_added' AS status,
  COUNT(*) AS total_rows,
  COUNT(web_view_count) AS rows_with_web_views,
  SUM(web_view_count) AS total_web_views,
  MAX(web_view_count) AS max_web_views
FROM public.public_v_home_news;
