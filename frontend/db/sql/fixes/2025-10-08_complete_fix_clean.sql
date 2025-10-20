/**
 * Complete Fix: Video Views + Top-3 Images + Zero LSP Errors
 * Date: 2025-10-08 v3 (Clean, LSP-friendly)
 * 
 * FIXES:
 * 1. Ensure videoViews mapping works for Story Details
 * 2. Add Top-3 image fallback to platform thumbnails (news_trends.ai_image_url)
 * 3. Zero LSP errors (simple SQL, no advanced CTEs in view definitions)
 * 
 * IDEMPOTENT: Safe to run multiple times
 */

\set ON_ERROR_STOP on

BEGIN;

-- Add site_click_count if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'news_trends'
      AND column_name = 'site_click_count'
  ) THEN
    ALTER TABLE public.news_trends 
      ADD COLUMN site_click_count INTEGER DEFAULT 0 NOT NULL;
  END IF;
END $$;

UPDATE public.news_trends 
SET site_click_count = 0 
WHERE site_click_count IS NULL;

-- ============================================================================
-- Fix AI Images View (Query image_files + ai_images)
-- ============================================================================

DROP VIEW IF EXISTS public.public_v_ai_images_latest CASCADE;

CREATE VIEW public.public_v_ai_images_latest
WITH (security_barrier = true, security_invoker = false) AS
SELECT DISTINCT ON (f.story_id) 
  f.story_id,
  f.file_path AS image_url,
  img.prompt AS ai_prompt,
  f.last_verified_at
FROM public.image_files f
LEFT JOIN public.ai_images img ON img.news_id::text = f.story_id::text
WHERE COALESCE(f.is_valid, true) = true
ORDER BY f.story_id, f.last_verified_at DESC NULLS LAST;

GRANT SELECT ON public.public_v_ai_images_latest TO anon, authenticated;

-- ============================================================================
-- Recreate public_v_home_news (26 columns, platform metrics)
-- ============================================================================

DROP VIEW IF EXISTS public.home_feed_v1 CASCADE;
DROP VIEW IF EXISTS public.public_v_home_news CASCADE;

CREATE VIEW public.public_v_home_news 
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  nt.id::text AS id,
  nt.title,
  nt.summary,
  COALESCE(st.summary_en, nt.summary_en) AS summary_en,
  nt.category,
  CASE 
    WHEN LOWER(nt.platform) = 'youtube' THEN 'YouTube'
    ELSE nt.platform
  END AS platform,
  nt.channel,
  COALESCE(st.publish_time, nt.published_at, nt.created_at) AS published_at,
  CASE
    WHEN LOWER(nt.platform) = 'youtube' AND nt.external_id IS NOT NULL 
      THEN 'https://www.youtube.com/watch?v=' || nt.external_id
    WHEN LOWER(nt.platform) = 'youtube' AND nt.video_id IS NOT NULL 
      THEN 'https://www.youtube.com/watch?v=' || nt.video_id
    ELSE nt.source_url
  END AS source_url,
  -- AI images (will be filtered to Top-3 only in home_feed_v1)
  img.image_url AS ai_generated_image,
  nt.ai_image_url AS platform_thumbnail,
  COALESCE(img.ai_prompt, st.ai_image_prompt, nt.ai_image_prompt) AS ai_prompt,
  nt.popularity_score,
  COALESCE(
    snap.rank::bigint,
    ROW_NUMBER() OVER (ORDER BY nt.popularity_score DESC NULLS LAST)
  ) AS rank,
  -- Platform video views (YouTube)
  COALESCE(
    CASE 
      WHEN snap.view_count ~ '^[0-9]+$' THEN snap.view_count::bigint
      WHEN snap.view_count ~ '[0-9]+' THEN REGEXP_REPLACE(snap.view_count, '[^0-9]', '', 'g')::bigint
      ELSE NULL
    END,
    CASE 
      WHEN nt.view_count ~ '^[0-9]+$' THEN nt.view_count::bigint
      WHEN nt.view_count ~ '[0-9]+' THEN REGEXP_REPLACE(nt.view_count, '[^0-9]', '', 'g')::bigint
      ELSE NULL
    END,
    0
  ) AS video_views,
  COALESCE(
    CASE WHEN nt.like_count ~ '^[0-9]+$' THEN nt.like_count::bigint ELSE NULL END,
    0
  ) AS likes,
  COALESCE(
    CASE WHEN nt.comment_count ~ '^[0-9]+$' THEN nt.comment_count::bigint ELSE NULL END,
    0
  ) AS comments,
  -- Growth rate
  CASE
    WHEN COALESCE(snap.growth_rate, nt.growth_rate) ~ '^-?\d+(\.\d+)?%?$'
      THEN REPLACE(TRIM(COALESCE(snap.growth_rate, nt.growth_rate)), '%', '')::numeric
    ELSE NULL
  END AS growth_rate_value,
  CASE
    WHEN COALESCE(snap.growth_rate, nt.growth_rate) ~ '^-?\d+(\.\d+)?%?$' THEN
      CASE
        WHEN REPLACE(TRIM(COALESCE(snap.growth_rate, nt.growth_rate)), '%', '')::numeric >= 1000000 THEN 'Viral (>1M/day)'
        WHEN REPLACE(TRIM(COALESCE(snap.growth_rate, nt.growth_rate)), '%', '')::numeric >= 100000 THEN 'High (>100K/day)'
        WHEN REPLACE(TRIM(COALESCE(snap.growth_rate, nt.growth_rate)), '%', '')::numeric >= 10000 THEN 'Moderate (>10K/day)'
        WHEN REPLACE(TRIM(COALESCE(snap.growth_rate, nt.growth_rate)), '%', '')::numeric > 0 THEN 'Growing'
        ELSE 'Stable'
      END
    WHEN COALESCE(snap.growth_rate, nt.growth_rate) ~ 'Viral|viral' THEN 'Viral (>1M/day)'
    WHEN COALESCE(snap.growth_rate, nt.growth_rate) ~ 'High|high' THEN 'High (>100K/day)'
    ELSE 'Growing'
  END AS growth_rate_label,
  COALESCE(snap.ai_opinion, nt.ai_opinion) AS ai_opinion,
  nt.score_details::text AS score_details,
  nt.video_id,
  nt.external_id,
  COALESCE(snap.platform_mentions, nt.platform_mentions, 'Primary platform only') AS platform_mentions,
  nt.keywords,
  GREATEST(nt.updated_at, st.updated_at, snap.created_at, img.last_verified_at) AS updated_at
FROM news_trends nt
LEFT JOIN stories st ON st.story_id::text = nt.id::text
LEFT JOIN public_v_latest_snapshots snap ON snap.story_id::text = st.story_id::text
LEFT JOIN public_v_ai_images_latest img ON img.story_id::text = st.story_id::text
WHERE LOWER(nt.platform) = 'youtube'
  AND nt.title IS NOT NULL
  AND nt.title != ''
ORDER BY rank ASC NULLS LAST;

GRANT SELECT ON public.public_v_home_news TO anon, authenticated;

-- ============================================================================
-- Recreate home_feed_v1 (28 columns with backward compat + image fallback)
-- ============================================================================

CREATE VIEW public.home_feed_v1
WITH (security_barrier = true, security_invoker = false)
AS
SELECT 
  v.id,
  v.title,
  v.summary,
  v.summary_en,
  v.category,
  v.platform,
  v.channel,
  v.published_at,
  v.source_url,
  -- Image with fallback: AI image (Top-3 only) or platform thumbnail
  CASE 
    WHEN v.rank <= 3 AND v.ai_generated_image IS NOT NULL THEN v.ai_generated_image
    WHEN v.rank <= 3 AND v.platform_thumbnail IS NOT NULL THEN v.platform_thumbnail
    ELSE NULL
  END AS image_url,
  CASE WHEN v.rank <= 3 THEN v.ai_prompt ELSE NULL END AS ai_prompt,
  v.popularity_score,
  v.rank,
  (v.rank IS NOT NULL AND v.rank <= 3) AS is_top3,
  v.video_views,
  v.video_views AS views,
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
  COALESCE(nt.site_click_count, 0) AS web_view_count
FROM public.public_v_home_news v
JOIN news_trends nt ON nt.id::text = v.id
ORDER BY v.rank ASC NULLS LAST;

GRANT SELECT ON public.home_feed_v1 TO anon, authenticated;

COMMENT ON VIEW public.home_feed_v1 IS 
'Canonical home view (28 columns). Backward compatible with "views" alias.
Image fallback: AI (if available) → platform thumbnail (Top-3 only).
Updated: 2025-10-08 v3 - Clean SQL, LSP-friendly, zero errors.';

-- ============================================================================
-- Update System Metadata
-- ============================================================================

INSERT INTO public.system_meta (key, value, updated_at)
VALUES ('home_view_version', '2025-10-08_complete_fix_clean_v3', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 
  'Column Check' AS test,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'home_feed_v1' AND column_name = 'views') AS has_views,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'home_feed_v1' AND column_name = 'video_views') AS has_video_views,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'home_feed_v1' AND column_name = 'web_view_count') AS has_web_view_count;

SELECT 
  id,
  LEFT(title, 35) AS title,
  rank,
  is_top3,
  image_url IS NOT NULL AS has_image,
  video_views,
  views,
  web_view_count
FROM public.home_feed_v1
WHERE rank <= 3
ORDER BY rank;

COMMIT;

