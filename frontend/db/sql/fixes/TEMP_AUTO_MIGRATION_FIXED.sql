-- ============================================================================
-- AUTOMATED HOME VIEW MIGRATION (No Manual Steps)
-- ============================================================================
-- Date: 2025-10-06
-- Purpose: Unify home views with web_view_count, eliminate drift
-- Security: DEFINER, Plan-B compliant, idempotent
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- CANONICAL VIEW: public.home_feed_v1 (27 columns including web_view_count)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.home_feed_v1
WITH (security_barrier = true, security_invoker = false)
AS
SELECT 
  nt.id,
  nt.title,
  nt.summary,
  nt.summary_en,
  nt.category,
  nt.platform,
  nt.channel,
  nt.published_at,
  nt.source_url,
  -- Top-3 image policy
  CASE WHEN nt.rank <= 3 THEN COALESCE(ai.image_url, nt.ai_image_url) ELSE NULL END AS image_url,
  CASE WHEN nt.rank <= 3 THEN COALESCE(ai.ai_prompt, nt.ai_image_prompt) ELSE NULL END AS ai_prompt,
  -- Scoring
  nt.popularity_score,
  nt.rank,
  (nt.rank <= 3) AS is_top3,
  -- YouTube metrics from snapshots
  COALESCE(s.view_count::bigint, 0) AS views,
  COALESCE(s.like_count::bigint, 0) AS likes,
  COALESCE(s.comment_count::bigint, 0) AS comments,
  -- Growth rate
  COALESCE(s.growth_rate_value, 0) AS growth_rate_value,
  COALESCE(s.growth_rate_label, 'Stable') AS growth_rate_label,
  -- Analysis
  s.ai_opinion,
  s.score_details,
  -- Identifiers
  nt.video_id,
  nt.external_id,
  -- Cross-platform
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
    -- Parse growth rate value
    CASE 
      WHEN growth_rate ~ '^\d+(\.\d+)?'THEN CAST(growth_rate AS NUMERIC)
      WHEN growth_rate ~ '\d+' THEN CAST(REGEXP_REPLACE(growth_rate, '[^0-9.]', '', 'g') AS NUMERIC)
      ELSE NULL
    END AS growth_rate_value,
    -- Derive growth rate label
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

-- ----------------------------------------------------------------------------
-- ALIAS VIEW: public.public_v_home_news → home_feed_v1
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.public_v_home_news AS
SELECT * FROM public.home_feed_v1;

-- ----------------------------------------------------------------------------
-- GRANTS (Plan-B security)
-- ----------------------------------------------------------------------------

GRANT SELECT ON public.home_feed_v1 TO anon;
GRANT SELECT ON public.home_feed_v1 TO authenticated;
GRANT SELECT ON public.public_v_home_news TO anon;
GRANT SELECT ON public.public_v_home_news TO authenticated;

-- ----------------------------------------------------------------------------
-- SYSTEM METADATA
-- ----------------------------------------------------------------------------

INSERT INTO public.system_meta (key, value, updated_at)
VALUES ('home_view_version', '2025-10-06_unified_web_view_count', NOW())
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

INSERT INTO public.system_meta (key, value, updated_at)
VALUES ('home_view_canonical', 'home_feed_v1', NOW())
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

COMMIT;

-- ============================================================================
-- VERIFICATION (information_schema only, no column SELECTs)
-- ============================================================================

-- Check 1: Column counts
SELECT 
  table_name AS view_name,
  COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('home_feed_v1', 'public_v_home_news')
GROUP BY table_name
ORDER BY table_name;

-- Check 2: web_view_count presence
SELECT 
  table_name AS view_name,
  BOOL_OR(column_name = 'web_view_count') AS has_web_view_count
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('home_feed_v1', 'public_v_home_news')
GROUP BY table_name
ORDER BY table_name;

-- Check 3: Row count (no specific columns referenced)
SELECT COUNT(*) AS total_rows FROM public.home_feed_v1;

-- Check 4: System metadata
SELECT key, value, updated_at
FROM public.system_meta
WHERE key IN ('home_view_version', 'home_view_canonical')
ORDER BY key;
