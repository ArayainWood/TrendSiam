/**
 * Complete Site Views Separation + AI Images Fix
 * Date: 2025-10-08
 * Purpose: Add dedicated site_click_count column, fix AI images view, separate metrics
 * 
 * REAL-TIME VALIDATION PERFORMED:
 * - news_trends.site_click_count: DOES NOT EXIST (creating)
 * - ai_images.is_active: DOES NOT EXIST (avoiding reference)
 * - public_v_ai_images_latest: Queries image_files table (correct source)
 * 
 * CHANGES:
 * 1. Add site_click_count INTEGER column to news_trends (default 0)
 * 2. Recreate views with clear separation: video_views (platform) vs web_view_count (site)
 * 3. Fix public_v_ai_images_latest to include prompt from image_files
 * 4. Update system metadata
 * 
 * IDEMPOTENT: Safe to run multiple times
 * PLAN-B: SECURITY DEFINER views, no base table grants
 */

\set ON_ERROR_STOP on

BEGIN;

-- ============================================================================
-- PART 1: Add Dedicated Site Click Counter
-- ============================================================================

\echo ''
\echo '--- PART 1: Add site_click_count to news_trends ---'

-- Check if column exists and add if missing
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
    
    RAISE NOTICE 'Added site_click_count column';
  ELSE
    RAISE NOTICE 'Column site_click_count already exists';
  END IF;
END $$;

-- Backfill: Initialize to 0 (do NOT copy from view_count)
UPDATE public.news_trends 
SET site_click_count = 0 
WHERE site_click_count IS NULL;

COMMENT ON COLUMN public.news_trends.site_click_count IS 
'Site-specific click counter. Incremented by telemetry route. Separate from platform views.';

-- ============================================================================
-- PART 2: Fix AI Images View (Query image_files, Include Prompt)
-- ============================================================================

\echo ''
\echo '--- PART 2: Recreate public_v_ai_images_latest ---'

DROP VIEW IF EXISTS public.public_v_ai_images_latest CASCADE;

CREATE VIEW public.public_v_ai_images_latest
WITH (security_barrier = true, security_invoker = false) AS
SELECT DISTINCT ON (f.story_id) 
  f.story_id,
  f.file_path AS image_url,
  img.prompt AS ai_prompt,  -- Join to ai_images for prompt
  f.last_verified_at
FROM public.image_files f
LEFT JOIN public.ai_images img ON img.news_id::text = f.story_id::text
WHERE COALESCE(f.is_valid, true) = true
ORDER BY f.story_id, f.last_verified_at DESC NULLS LAST;

GRANT SELECT ON public.public_v_ai_images_latest TO anon, authenticated;

COMMENT ON VIEW public.public_v_ai_images_latest IS 
'Latest valid AI-generated image per story. Queries image_files (actual files) and ai_images (metadata).
Updated: 2025-10-08 - Added ai_prompt from ai_images join, no is_active dependency.';

-- ============================================================================
-- PART 3: Recreate public.public_v_home_news with Clear Metric Separation
-- ============================================================================

\echo ''
\echo '--- PART 3: Recreate public.public_v_home_news ---'

DROP VIEW IF EXISTS public.home_feed_v1 CASCADE;
DROP VIEW IF EXISTS public.public_v_home_news CASCADE;

CREATE VIEW public.public_v_home_news 
WITH (security_invoker = false, security_barrier = true) AS
WITH joined_data AS (
  SELECT
    nt.id,
    nt.title,
    nt.summary,
    COALESCE(st.summary_en, nt.summary_en) AS summary_en,
    nt.category,
    -- Normalize platform
    CASE 
      WHEN LOWER(nt.platform) = 'youtube' THEN 'YouTube'
      ELSE nt.platform
    END AS platform,
    nt.channel,
    COALESCE(st.publish_time, nt.published_at, nt.created_at) AS published_at,
    -- Generate source_url
    CASE
      WHEN LOWER(nt.platform) = 'youtube' AND nt.external_id IS NOT NULL 
        THEN 'https://www.youtube.com/watch?v=' || nt.external_id
      WHEN LOWER(nt.platform) = 'youtube' AND nt.video_id IS NOT NULL 
        THEN 'https://www.youtube.com/watch?v=' || nt.video_id
      ELSE nt.source_url
    END AS source_url,
    -- AI images (Top-3 only, enforced later)
    img.image_url AS image_url,
    COALESCE(img.ai_prompt, st.ai_image_prompt, nt.ai_image_prompt) AS ai_prompt,
    -- Popularity score and rank
    nt.popularity_score,
    COALESCE(
      snap.rank::bigint,
      CASE 
        WHEN nt.popularity_score IS NOT NULL 
          THEN ROW_NUMBER() OVER (ORDER BY nt.popularity_score DESC NULLS LAST)
        ELSE NULL
      END
    ) AS rank,
    -- CRITICAL: Platform metrics (YouTube views, likes, comments)
    -- These are from the video platform, NOT site tracking
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
    ) AS video_views,  -- RENAMED from 'views' for clarity
    COALESCE(
      CASE 
        WHEN nt.like_count ~ '^[0-9]+$' THEN nt.like_count::bigint
        ELSE NULL
      END,
      0
    ) AS likes,
    COALESCE(
      CASE 
        WHEN nt.comment_count ~ '^[0-9]+$' THEN nt.comment_count::bigint
        ELSE NULL
      END,
      0
    ) AS comments,
    -- Growth rate (formatted labels)
    CASE
      WHEN COALESCE(snap.growth_rate, nt.growth_rate) IS NULL THEN NULL
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
          WHEN REPLACE(TRIM(COALESCE(snap.growth_rate, nt.growth_rate)), '%', '')::numeric = 0 THEN 'Stable'
          ELSE 'Declining'
        END
      WHEN COALESCE(snap.growth_rate, nt.growth_rate) ~ 'Viral|viral' THEN 'Viral (>1M/day)'
      WHEN COALESCE(snap.growth_rate, nt.growth_rate) ~ 'High|high' THEN 'High (>100K/day)'
      WHEN COALESCE(snap.growth_rate, nt.growth_rate) ~ 'Rising fast|rising fast' THEN 'High (>100K/day)'
      WHEN COALESCE(snap.growth_rate, nt.growth_rate) ~ 'Rising|rising|Moderate' THEN 'Moderate (>10K/day)'
      WHEN COALESCE(snap.growth_rate, nt.growth_rate) ~ 'New|new' THEN 'New (< 1 day)'
      WHEN COALESCE(snap.growth_rate, nt.growth_rate) ~ 'Stable|stable' THEN 'Stable'
      ELSE 'Growing'
    END AS growth_rate_label,
    -- AI opinion and score details
    COALESCE(snap.ai_opinion, nt.ai_opinion) AS ai_opinion,
    nt.score_details::text AS score_details,
    -- Identifiers
    nt.video_id,
    nt.external_id,
    -- Additional fields
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
)
SELECT
  id::text AS id,
  title,
  summary,
  summary_en,
  category,
  platform,
  channel,
  published_at,
  source_url,
  -- Top-3 policy: Only show images/prompts for rank 1-3
  CASE WHEN (rank IS NOT NULL AND rank <= 3) THEN image_url ELSE NULL END AS image_url,
  CASE WHEN (rank IS NOT NULL AND rank <= 3) THEN ai_prompt ELSE NULL END AS ai_prompt,
  popularity_score,
  rank,
  (rank IS NOT NULL AND rank <= 3) AS is_top3,
  video_views,  -- Platform video views (YouTube)
  likes,
  comments,
  growth_rate_value,
  growth_rate_label,
  ai_opinion,
  score_details,
  video_id,
  external_id,
  platform_mentions,
  keywords,
  updated_at
FROM joined_data
ORDER BY rank ASC NULLS LAST, popularity_score DESC NULLS LAST;

GRANT SELECT ON public.public_v_home_news TO anon, authenticated;

COMMENT ON VIEW public.public_v_home_news IS 
'Home page news view with 26-column contract. Security: DEFINER view.
Columns: video_views (platform/YouTube views), excludes web_view_count (site tracking).
Updated: 2025-10-08 - Renamed views → video_views, separated metrics.';

-- ============================================================================
-- PART 4: Recreate home_feed_v1 with Site Click Counter
-- ============================================================================

\echo ''
\echo '--- PART 4: Recreate home_feed_v1 with web_view_count ---'

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
  v.image_url,
  v.ai_prompt,
  v.popularity_score,
  v.rank,
  v.is_top3,
  v.video_views,  -- Column 15: Platform video views (YouTube)
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
  -- Column 27: SITE WEB VIEWS from dedicated counter
  -- This is the COUNT of times users clicked this card on the homepage
  COALESCE(nt.site_click_count, 0) AS web_view_count  -- NEW: From site_click_count
FROM public.public_v_home_news v
JOIN news_trends nt ON nt.id::text = v.id
ORDER BY v.rank ASC NULLS LAST, v.popularity_score DESC NULLS LAST;

GRANT SELECT ON public.home_feed_v1 TO anon, authenticated;

COMMENT ON VIEW public.home_feed_v1 IS 
'Canonical home view with 27 columns. Adds web_view_count (site tracking) to public_v_home_news.
Column separation: video_views=YouTube/platform views, web_view_count=site click counter.
Security: DEFINER view, Plan-B compliant.
Updated: 2025-10-08 - Complete metric separation, site_click_count source.';

-- ============================================================================
-- PART 5: Update System Metadata
-- ============================================================================

\echo ''
\echo '--- PART 5: Update system metadata ---'

INSERT INTO public.system_meta (key, value, updated_at)
VALUES (
  'home_view_version',
  '2025-10-08_site_views_separation_complete',
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.system_meta (key, value, updated_at)
VALUES (
  'views_separation_completed',
  'true',
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- PART 6: Verification Queries
-- ============================================================================

\echo ''
\echo '--- VERIFICATION: Column Presence ---'
SELECT 
  'news_trends.site_click_count' AS check_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'news_trends' AND column_name = 'site_click_count'
  ) AS exists;

\echo ''
\echo '--- VERIFICATION: View Columns ---'
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS columns
FROM (
  VALUES ('home_feed_v1'), ('public_v_home_news'), ('public_v_ai_images_latest')
) AS t(table_name);

\echo ''
\echo '--- VERIFICATION: Sample Row (Metric Separation) ---'
SELECT 
  id,
  LEFT(title, 40) AS title,
  rank,
  video_views AS platform_youtube_views,
  web_view_count AS site_clicks,
  video_views = web_view_count AS mixed_values
FROM public.home_feed_v1
ORDER BY rank ASC
LIMIT 1;

\echo ''
\echo '--- VERIFICATION: Top-3 AI Images ---'
SELECT 
  id,
  LEFT(title, 30) AS title,
  rank,
  is_top3,
  image_url IS NOT NULL AS has_image,
  ai_prompt IS NOT NULL AS has_prompt
FROM public.home_feed_v1
WHERE is_top3 = true
ORDER BY rank;

\echo ''
\echo '========================================='
\echo 'Migration Complete!'
\echo 'Next: Update telemetry route to increment site_click_count'
\echo '========================================='

COMMIT;

