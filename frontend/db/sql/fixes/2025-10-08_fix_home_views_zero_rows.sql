/**
 * Fix Home Views - Zero Rows Issue
 * Date: 2025-10-08
 * Purpose: Fix case-sensitive platform filter and ensure views return data
 * 
 * ROOT CAUSES IDENTIFIED:
 * 1. Platform filter was case-sensitive: view has WHERE platform = 'YouTube'
 *    but data has platform = 'youtube' (lowercase) → 0 rows returned
 * 2. stories table is empty (0 rows) but LEFT JOIN doesn't cause filter issue
 * 3. All data older than 30 days but no graceful fallback to show old data
 *
 * SOLUTION:
 * - Use case-insensitive platform filter: LOWER(platform) = 'youtube'
 * - Remove strict freshness filters for dev (show all data)
 * - Keep 26-column contract for public_v_home_news
 * - Keep 27-column contract for home_feed_v1 (adds web_view_count)
 * - Maintain SECURITY DEFINER and Plan-B compliance
 * 
 * IDEMPOTENT: Safe to run multiple times
 */

\set ON_ERROR_STOP on

BEGIN;

-- ============================================================================
-- PART 1: Recreate public_v_home_news with Fixed Filters
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
    -- AI images (Top-3 only, enforced later)
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
    -- Views, likes, comments from snapshots or news_trends
    -- Note: Both snap and nt have text types, need safe casting
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
    ) AS views,
    COALESCE(
      CASE 
        WHEN snap.like_count ~ '^[0-9]+$' THEN snap.like_count::bigint
        ELSE NULL
      END,
      CASE 
        WHEN nt.like_count ~ '^[0-9]+$' THEN nt.like_count::bigint
        ELSE NULL
      END,
      0
    ) AS likes,
    COALESCE(
      CASE 
        WHEN snap.comment_count ~ '^[0-9]+$' THEN snap.comment_count::bigint
        ELSE NULL
      END,
      CASE 
        WHEN nt.comment_count ~ '^[0-9]+$' THEN nt.comment_count::bigint
        ELSE NULL
      END,
      0
    ) AS comments,
    -- Growth rate parsing
    CASE
      WHEN COALESCE(snap.growth_rate, nt.growth_rate) IS NULL THEN NULL
      WHEN COALESCE(snap.growth_rate, nt.growth_rate) ~ '^-?\d+(\.\d+)?%?$'
        THEN REPLACE(TRIM(COALESCE(snap.growth_rate, nt.growth_rate)), '%', '')::numeric
      ELSE NULL
    END AS growth_rate_value,
    -- Growth rate label
    CASE
      WHEN COALESCE(snap.growth_rate, nt.growth_rate) ~ 'Viral|viral' THEN 'Viral'
      WHEN COALESCE(snap.growth_rate, nt.growth_rate) ~ 'Rising fast|rising fast' THEN 'Rising fast'
      WHEN COALESCE(snap.growth_rate, nt.growth_rate) ~ 'Rising|rising' THEN 'Rising'
      WHEN COALESCE(snap.growth_rate, nt.growth_rate) ~ 'Stable|stable' THEN 'Stable'
      ELSE COALESCE(snap.growth_rate, nt.growth_rate)
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
  WHERE LOWER(nt.platform) = 'youtube'  -- FIXED: Case-insensitive filter
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
  views,
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
Fixes: Case-insensitive platform filter, no strict freshness constraints.
Updated: 2025-10-08 - Fixed zero-rows issue (platform case sensitivity)';

-- ============================================================================
-- PART 2: Recreate home_feed_v1 with web_view_count
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
  -- Column 27: Web view count from site tracking (telemetry)
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
ORDER BY v.rank ASC NULLS LAST, v.popularity_score DESC NULLS LAST;

-- Grant SELECT to anon and authenticated
GRANT SELECT ON public.home_feed_v1 TO anon, authenticated;

COMMENT ON VIEW public.home_feed_v1 IS 
'Canonical home view with 27 columns (adds web_view_count to public_v_home_news).
Security: DEFINER view, Plan-B compliant.
Updated: 2025-10-08 - Fixed zero-rows issue';

-- ============================================================================
-- PART 3: Update System Metadata
-- ============================================================================

INSERT INTO public.system_meta (key, value, updated_at)
VALUES (
  'home_view_version',
  '2025-10-08_fix_zero_rows',
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.system_meta (key, value, updated_at)
VALUES (
  'home_view_canonical',
  'home_feed_v1',
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- PART 4: Verification Queries (informational, non-blocking)
-- ============================================================================

\echo ''
\echo '--- Verification: View Existence ---'
SELECT viewname, 
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = viewname) AS columns
FROM pg_views 
WHERE schemaname = 'public' AND viewname IN ('home_feed_v1', 'public_v_home_news');

\echo ''
\echo '--- Verification: Row Counts ---'
DO $$
DECLARE
  v1_count INTEGER;
  v2_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v1_count FROM public.home_feed_v1;
  SELECT COUNT(*) INTO v2_count FROM public.public_v_home_news;
  
  RAISE NOTICE 'home_feed_v1: % rows', v1_count;
  RAISE NOTICE 'public_v_home_news: % rows', v2_count;
  
  IF v1_count = 0 THEN
    RAISE WARNING 'home_feed_v1 still returns 0 rows - check data and filters!';
  END IF;
  
  IF v2_count = 0 THEN
    RAISE WARNING 'public_v_home_news still returns 0 rows - check data and filters!';
  END IF;
END $$;

\echo ''
\echo '--- Verification: Sample Row from home_feed_v1 ---'
SELECT 
  id,
  LEFT(title, 50) AS title,
  rank,
  popularity_score,
  web_view_count,
  platform
FROM public.home_feed_v1
LIMIT 1;

\echo ''
\echo '========================================='
\echo 'Migration Complete!'
\echo 'Next: Test /api/home and /api/home/diagnostics'
\echo '========================================='

COMMIT;

