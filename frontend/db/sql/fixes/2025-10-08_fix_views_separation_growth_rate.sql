/**
 * Fix Views Separation and Growth Rate Formatting
 * Date: 2025-10-08
 * Purpose: Separate video views from web views; format growth rate properly
 * 
 * ISSUES FIXED:
 * 1. Views confusion: video views (platform metric) mixed with web views (site tracking)
 * 2. Growth rate: showing raw numbers instead of formatted labels
 * 
 * SOLUTION:
 * - views column: platform video views from snapshots/news_trends (YouTube views)
 * - web_view_count column: site tracking from telemetry (card clicks)
 * - growth_rate_label: human-readable format derived from growth_rate_value
 * 
 * Note: ai_images table is empty (0 rows), so image_url will be NULL for all stories
 * until AI images are generated. This is expected.
 * 
 * IDEMPOTENT: Safe to run multiple times
 */

\set ON_ERROR_STOP on

BEGIN;

-- ============================================================================
-- PART 1: Recreate public_v_home_news with Proper Views Separation
-- ============================================================================

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
    -- Normalize platform to 'YouTube' for consistency
    CASE 
      WHEN LOWER(nt.platform) = 'youtube' THEN 'YouTube'
      ELSE nt.platform
    END AS platform,
    nt.channel,
    COALESCE(st.publish_time, nt.published_at, nt.created_at) AS published_at,
    -- Generate source_url from video_id/external_id
    CASE
      WHEN LOWER(nt.platform) = 'youtube' AND nt.external_id IS NOT NULL 
        THEN 'https://www.youtube.com/watch?v=' || nt.external_id
      WHEN LOWER(nt.platform) = 'youtube' AND nt.video_id IS NOT NULL 
        THEN 'https://www.youtube.com/watch?v=' || nt.video_id
      ELSE nt.source_url
    END AS source_url,
    -- AI images (Top-3 only, enforced later) - currently NULL as ai_images table is empty
    img.image_url AS image_url,
    COALESCE(st.ai_image_prompt, nt.ai_image_prompt) AS ai_prompt,
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
    -- CRITICAL FIX: Separate video views (platform) from web views (site tracking)
    -- Video views: Platform metrics (YouTube views) from like_count field
    -- Web views will be added in home_feed_v1 from view_count (telemetry)
    COALESCE(
      CASE 
        WHEN nt.like_count ~ '^[0-9]+$' THEN nt.like_count::bigint
        ELSE NULL
      END,
      0
    ) AS views,  -- This is VIDEO VIEWS from platform (YouTube)
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
    -- Growth rate parsing from snapshots
    CASE
      WHEN COALESCE(snap.growth_rate, nt.growth_rate) IS NULL THEN NULL
      WHEN COALESCE(snap.growth_rate, nt.growth_rate) ~ '^-?\d+(\.\d+)?%?$'
        THEN REPLACE(TRIM(COALESCE(snap.growth_rate, nt.growth_rate)), '%', '')::numeric
      ELSE NULL
    END AS growth_rate_value,
    -- CRITICAL FIX: Format growth rate label properly
    CASE
      -- If we have a numeric growth_rate_value, format it
      WHEN COALESCE(snap.growth_rate, nt.growth_rate) ~ '^-?\d+(\.\d+)?%?$' THEN
        CASE
          WHEN REPLACE(TRIM(COALESCE(snap.growth_rate, nt.growth_rate)), '%', '')::numeric >= 1000000 THEN 'Viral (>1M/day)'
          WHEN REPLACE(TRIM(COALESCE(snap.growth_rate, nt.growth_rate)), '%', '')::numeric >= 100000 THEN 'High (>100K/day)'
          WHEN REPLACE(TRIM(COALESCE(snap.growth_rate, nt.growth_rate)), '%', '')::numeric >= 10000 THEN 'Moderate (>10K/day)'
          WHEN REPLACE(TRIM(COALESCE(snap.growth_rate, nt.growth_rate)), '%', '')::numeric > 0 THEN 'Growing'
          WHEN REPLACE(TRIM(COALESCE(snap.growth_rate, nt.growth_rate)), '%', '')::numeric = 0 THEN 'Stable'
          ELSE 'Declining'
        END
      -- If it's already a text label, keep it
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
    -- Additional fields (platform_mentions and keywords are TEXT, not numeric)
    COALESCE(snap.platform_mentions, nt.platform_mentions, 'Primary platform only') AS platform_mentions,
    nt.keywords,
    GREATEST(nt.updated_at, st.updated_at, snap.created_at, img.last_verified_at) AS updated_at
  FROM news_trends nt
  LEFT JOIN stories st ON st.story_id::text = nt.id::text
  LEFT JOIN public_v_latest_snapshots snap ON snap.story_id::text = st.story_id::text
  LEFT JOIN public_v_ai_images_latest img ON img.story_id::text = st.story_id::text
  WHERE LOWER(nt.platform) = 'youtube'  -- Case-insensitive filter
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
  views,  -- VIDEO VIEWS (platform/YouTube views)
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

-- Grant SELECT to anon and authenticated
GRANT SELECT ON public.public_v_home_news TO anon, authenticated;

COMMENT ON VIEW public.public_v_home_news IS 
'Home page news view with 26-column contract. Security: DEFINER view.
Fixes: Views separation (video vs web), growth rate formatting.
Updated: 2025-10-08 - Fixed views confusion and growth rate labels';

-- ============================================================================
-- PART 2: Recreate home_feed_v1 with web_view_count (SITE TRACKING)
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
  v.image_url,
  v.ai_prompt,
  v.popularity_score,
  v.rank,
  v.is_top3,
  v.views,  -- VIDEO VIEWS (YouTube/platform views)
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
  -- Column 27: SITE WEB VIEWS from telemetry tracking (card clicks)
  -- This is the COUNT of times users clicked this card on the homepage
  COALESCE(
    CASE 
      WHEN nt.view_count ~ '^[0-9]+$' THEN nt.view_count::integer
      WHEN nt.view_count ~ '[0-9]+' THEN REGEXP_REPLACE(nt.view_count, '[^0-9]', '', 'g')::integer
      ELSE 0
    END,
    0
  ) AS web_view_count  -- SITE VIEWS (homepage card clicks, telemetry)
FROM public.public_v_home_news v
JOIN news_trends nt ON nt.id::text = v.id
ORDER BY v.rank ASC NULLS LAST, v.popularity_score DESC NULLS LAST;

-- Grant SELECT to anon and authenticated
GRANT SELECT ON public.home_feed_v1 TO anon, authenticated;

COMMENT ON VIEW public.home_feed_v1 IS 
'Canonical home view with 27 columns (adds web_view_count to public_v_home_news).
Column separation: views=video/platform views, web_view_count=site tracking clicks.
Security: DEFINER view, Plan-B compliant.
Updated: 2025-10-08 - Fixed views separation and growth rate formatting';

-- ============================================================================
-- PART 3: Update System Metadata
-- ============================================================================

INSERT INTO public.system_meta (key, value, updated_at)
VALUES (
  'home_view_version',
  '2025-10-08_views_separation_growth_fix',
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- PART 4: Verification Queries
-- ============================================================================

\echo ''
\echo '--- Verification: View Existence & Columns ---'
SELECT 
  viewname,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = viewname) AS columns
FROM pg_views 
WHERE schemaname = 'public' AND viewname IN ('home_feed_v1', 'public_v_home_news');

\echo ''
\echo '--- Verification: Sample Row (Views Separation) ---'
SELECT 
  id,
  LEFT(title, 40) AS title,
  rank,
  views AS video_views_youtube,
  web_view_count AS site_views_clicks,
  growth_rate_value,
  growth_rate_label
FROM public.home_feed_v1
ORDER BY rank ASC
LIMIT 1;

\echo ''
\echo '--- Verification: Growth Rate Labels Distribution ---'
SELECT 
  growth_rate_label,
  COUNT(*) AS count
FROM public.home_feed_v1
GROUP BY growth_rate_label
ORDER BY count DESC
LIMIT 10;

\echo ''
\echo '========================================='
\echo 'Migration Complete!'
\echo 'Next: Check that views and web_view_count are DIFFERENT'
\echo '========================================='

COMMIT;

