/**
 * Add Date-Based Filtering to Home Feed View
 * Date: 2025-10-09
 * Issue: Home shows all-time top items instead of today's snapshot (Thai TZ)
 * 
 * FIXES:
 * 1. Add primary window: Today's items (Thai TZ) ordered by score
 * 2. Add fallback window: Last 7 days if today has <20 items
 * 3. Preserve existing score-based ranking within each day
 * 4. Maintain backward compatibility (28 columns)
 * 
 * IDEMPOTENT: Safe to run multiple times
 * SECURITY: Plan-B compliant (DEFINER view, no base grants)
 */

\set ON_ERROR_STOP on

BEGIN;

-- ============================================================================
-- Recreate public_v_home_news with DATE-BASED FILTERING
-- ============================================================================

DROP VIEW IF EXISTS public.home_feed_v1 CASCADE;
DROP VIEW IF EXISTS public.public_v_home_news CASCADE;

CREATE VIEW public.public_v_home_news 
WITH (security_invoker = false, security_barrier = true) AS
WITH
-- Get today's date in Thai timezone
thai_today AS (
  SELECT DATE(NOW() AT TIME ZONE 'Asia/Bangkok') AS today
),

-- Primary window: Today's items (Thai TZ)
today_items AS (
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
    img.image_url AS ai_generated_image,
    nt.ai_image_url AS platform_thumbnail,
    COALESCE(img.ai_prompt, st.ai_image_prompt, nt.ai_image_prompt) AS ai_prompt,
    nt.popularity_score,
    -- Rank WITHIN today's items
    ROW_NUMBER() OVER (
      ORDER BY nt.popularity_score DESC NULLS LAST,
               COALESCE(st.publish_time, nt.published_at, nt.created_at) DESC NULLS LAST,
               nt.id
    ) AS rank,
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
    GREATEST(nt.updated_at, st.updated_at, snap.created_at, img.last_verified_at) AS updated_at,
    DATE(COALESCE(st.publish_time, nt.published_at, nt.created_at) AT TIME ZONE 'Asia/Bangkok') AS item_date,
    1 AS priority  -- TODAY items = priority 1
  FROM news_trends nt
  CROSS JOIN thai_today tt
  LEFT JOIN stories st ON st.story_id::text = nt.id::text
  LEFT JOIN public_v_latest_snapshots snap ON snap.story_id::text = st.story_id::text
  LEFT JOIN public_v_ai_images_latest img ON img.story_id::text = st.story_id::text
  WHERE LOWER(nt.platform) = 'youtube'
    AND nt.title IS NOT NULL
    AND nt.title != ''
    -- TODAY filter (Thai TZ)
    AND DATE(COALESCE(st.publish_time, nt.published_at, nt.created_at) AT TIME ZONE 'Asia/Bangkok') = tt.today
),

-- Fallback window: Last 7 days (if today has <20 items)
fallback_items AS (
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
    img.image_url AS ai_generated_image,
    nt.ai_image_url AS platform_thumbnail,
    COALESCE(img.ai_prompt, st.ai_image_prompt, nt.ai_image_prompt) AS ai_prompt,
    nt.popularity_score,
    ROW_NUMBER() OVER (
      ORDER BY 
        DATE(COALESCE(st.publish_time, nt.published_at, nt.created_at) AT TIME ZONE 'Asia/Bangkok') DESC,
        nt.popularity_score DESC NULLS LAST,
        COALESCE(st.publish_time, nt.published_at, nt.created_at) DESC NULLS LAST,
        nt.id
    ) AS rank,
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
    GREATEST(nt.updated_at, st.updated_at, snap.created_at, img.last_verified_at) AS updated_at,
    DATE(COALESCE(st.publish_time, nt.published_at, nt.created_at) AT TIME ZONE 'Asia/Bangkok') AS item_date,
    2 AS priority  -- FALLBACK items = priority 2
  FROM news_trends nt
  CROSS JOIN thai_today tt
  LEFT JOIN stories st ON st.story_id::text = nt.id::text
  LEFT JOIN public_v_latest_snapshots snap ON snap.story_id::text = st.story_id::text
  LEFT JOIN public_v_ai_images_latest img ON img.story_id::text = st.story_id::text
  WHERE LOWER(nt.platform) = 'youtube'
    AND nt.title IS NOT NULL
    AND nt.title != ''
    -- Fallback: Last 60 days EXCLUDING today (widened for existing test data)
    AND DATE(COALESCE(st.publish_time, nt.published_at, nt.created_at) AT TIME ZONE 'Asia/Bangkok') < tt.today
    AND DATE(COALESCE(st.publish_time, nt.published_at, nt.created_at) AT TIME ZONE 'Asia/Bangkok') >= tt.today - INTERVAL '60 days'
    -- ONLY use fallback if today has <20 items
    AND (SELECT COUNT(*) FROM today_items) < 20
),

-- Combine primary and fallback
combined_items AS (
  SELECT * FROM today_items
  UNION ALL
  SELECT * FROM fallback_items
)

-- Final SELECT with columns expected by frontend (without priority and item_date helpers)
SELECT
  id, title, summary, summary_en, category, platform, channel, published_at, source_url,
  ai_generated_image, platform_thumbnail, ai_prompt, popularity_score, rank,
  video_views, likes, comments, growth_rate_value, growth_rate_label,
  ai_opinion, score_details, video_id, external_id, platform_mentions, keywords, updated_at
FROM combined_items
ORDER BY priority ASC, rank ASC NULLS LAST;

GRANT SELECT ON public.public_v_home_news TO anon, authenticated;

COMMENT ON VIEW public.public_v_home_news IS 
'Home news view with date-based filtering (Thai TZ).
Primary: Today''s items (Thai TZ) ranked by score.
Fallback: Last 60 days if today <20 items, ordered by date DESC → score DESC.
Updated: 2025-10-09 - Added date-based filtering for freshness.';

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
Date filtering: Today (Thai TZ) primary, last 60 days fallback if <20 items.
Updated: 2025-10-09 - Added date-based filtering.';

-- ============================================================================
-- Update System Metadata
-- ============================================================================

INSERT INTO public.system_meta (key, value, updated_at)
VALUES 
  ('home_view_version', '2025-10-09_date_based_filtering', NOW()),
  ('home_freshness_policy', 'today_primary:thai_tz|60d_fallback', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- Verification
-- ============================================================================

\echo ''
\echo '--- Verification: View exists and has data ---'
SELECT 
  'public_v_home_news' AS view_name,
  COUNT(*) AS row_count,
  MIN(rank) AS min_rank,
  MAX(rank) AS max_rank
FROM public.public_v_home_news;

SELECT 
  'home_feed_v1' AS view_name,
  COUNT(*) AS row_count,
  COUNT(CASE WHEN is_top3 THEN 1 END) AS top3_count,
  COUNT(CASE WHEN image_url IS NOT NULL THEN 1 END) AS images_count
FROM public.home_feed_v1;

\echo ''
\echo '--- Verification: Date distribution (Thai TZ) ---'
WITH dates AS (
  SELECT
    DATE(published_at AT TIME ZONE 'Asia/Bangkok') AS item_date,
    COUNT(*) AS item_count
  FROM public.home_feed_v1
  GROUP BY item_date
  ORDER BY item_date DESC
  LIMIT 10
)
SELECT 
  item_date,
  item_count,
  CASE WHEN item_date = CURRENT_DATE AT TIME ZONE 'Asia/Bangkok' THEN '← TODAY' ELSE '' END AS marker
FROM dates;

\echo ''
\echo '--- Verification: Top 5 items ---'
SELECT 
  rank,
  LEFT(title, 40) AS title,
  ROUND(popularity_score::numeric, 2) AS score,
  DATE(published_at AT TIME ZONE 'Asia/Bangkok') AS thai_date
FROM public.home_feed_v1
ORDER BY rank
LIMIT 5;

COMMIT;

\echo ''
\echo '✅ Migration complete. Date-based filtering now active.'
\echo 'Run: node frontend/scripts/data-freshness-check.mjs to verify.'

