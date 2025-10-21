/**
 * Unify Home View with Web View Count + Compatibility Alias
 * Date: 2025-10-06
 * Purpose: Fix view name drift (home_feed_v1 vs public_v_home_news) and add web_view_count to canonical view
 * Security: DEFINER view, read-only, Plan-B compliant
 * 
 * IDEMPOTENT: Safe to run multiple times
 * 
 * Decision: home_feed_v1 is CANONICAL, public_v_home_news is ALIAS
 * Rationale: HOME_VIEW constant in codebase points to home_feed_v1
 * 
 * DATA MODEL:
 * - news_trends has rank, popularity_score, ai_opinion, score_details directly populated
 * - view_count in news_trends stores site telemetry tracking (incremented via /api/telemetry/view)
 * - like_count, comment_count, etc. from YouTube are also in news_trends
 * - No snapshots join needed (deprecated pattern; news_trends is source of truth)
 */

-- ============================================================================
-- CANONICAL VIEW: public.home_feed_v1 (extends public_v_home_news with web_view_count)
-- ============================================================================

DROP VIEW IF EXISTS public.home_feed_v1 CASCADE;

CREATE VIEW public.home_feed_v1
WITH (security_barrier = true, security_invoker = false)
AS
SELECT 
  -- All 26 columns from existing view (explicitly listed for type safety)
  v.id,
  v.title,
  v.summary,
  v.summary_en,
  v.category,
  v.platform,
  v.channel,
  v.published_at,
  v.source_url,
  v.image_url,
  v.ai_prompt,
  v.popularity_score,
  v."rank",
  v.is_top3,
  v.views,
  v.likes,
  v.comments,
  v.growth_rate_value,
  v.growth_rate_label,
  v.ai_opinion,
  v.score_details,
  v.video_id,
  v.external_id,
  v.platform_mentions,
  v.keywords,
  v.updated_at,
  
  -- NEW: Web view count from site tracking (telemetry) (column 27)
  -- Fetch from news_trends.view_count which is incremented by /api/telemetry/view
  COALESCE(
    CASE 
      WHEN nt.view_count ~ '^[0-9]+$' THEN nt.view_count::integer
      WHEN nt.view_count ~ '[0-9]+' THEN REGEXP_REPLACE(nt.view_count, '[^0-9]', '', 'g')::integer
      ELSE 0
    END,
    0
  ) AS web_view_count
  
FROM public.public_v_home_news v
JOIN news_trends nt ON nt.id::text = v.id
ORDER BY v."rank" ASC NULLS LAST, v.popularity_score DESC NULLS LAST;

-- Grant SELECT to anon and authenticated (Plan-B security)
GRANT SELECT ON public.home_feed_v1 TO anon;
GRANT SELECT ON public.home_feed_v1 TO authenticated;

-- ============================================================================
-- NOTE: public.public_v_home_news stays as-is (26 columns)
-- home_feed_v1 extends it with web_view_count (27 columns total)
-- Both views remain accessible for backwards compatibility
-- ============================================================================

-- ============================================================================
-- SYSTEM METADATA: Record unified view version
-- ============================================================================

INSERT INTO public.system_meta (key, value, updated_at)
VALUES (
  'home_view_version',
  '2025-10-06_unified_web_view_count',
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;

-- Record canonical view name
INSERT INTO public.system_meta (key, value, updated_at)
VALUES (
  'home_view_canonical',
  'home_feed_v1',
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;
