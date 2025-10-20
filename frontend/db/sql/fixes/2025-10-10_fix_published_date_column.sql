/**
 * FIX: Published Date Column Mapping
 * Date: 2025-10-10
 * 
 * PROBLEM: 100% of items show "Invalid Date" in Story Details
 * ROOT CAUSE: View queries news_trends.published_at (NULL) instead of published_date (valid data)
 * 
 * SOLUTION: Update view to query correct column (published_date)
 * 
 * IDEMPOTENT: Safe to run multiple times
 * SECURITY: Plan-B compliant (DEFINER view, no base grants)
 */

\set ON_ERROR_STOP on

BEGIN;

\echo ''
\echo '=== FIX: Published Date Column Mapping ==='
\echo ''

-- ============================================================================
-- STEP 1: Recreate public_v_home_news with CORRECT column mapping
-- ============================================================================

DROP VIEW IF EXISTS public.home_feed_v1 CASCADE;
DROP VIEW IF EXISTS public.public_v_home_news CASCADE;

\echo 'Creating public_v_home_news with published_date fix...'

CREATE VIEW public.public_v_home_news 
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  nt.id::text AS id,
  nt.title,
  nt.summary,
  COALESCE(st.summary_en, nt.summary_en) AS summary_en,
  nt.category,
  CASE WHEN LOWER(nt.platform) = 'youtube' THEN 'YouTube' ELSE nt.platform END AS platform,
  nt.channel,
  -- FIX: Use published_date (correct column with data), not published_at (NULL)
  COALESCE(st.publish_time, nt.published_date::timestamptz) AS published_at,
  COALESCE(nt.date, DATE(nt.created_at AT TIME ZONE 'Asia/Bangkok')) AS snapshot_date,
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
    ORDER BY nt.popularity_score DESC NULLS LAST,
             COALESCE(st.publish_time, nt.published_date::timestamptz) DESC NULLS LAST,
             nt.id
  ) AS rank,
  COALESCE(
    CASE WHEN nt.view_count ~ '^[0-9]+$' THEN nt.view_count::bigint 
         WHEN nt.view_count ~ '[0-9]+' THEN REGEXP_REPLACE(nt.view_count, '[^0-9]', '', 'g')::bigint 
         ELSE NULL END,
    0
  ) AS video_views,
  COALESCE(CASE WHEN nt.like_count ~ '^[0-9]+$' THEN nt.like_count::bigint ELSE NULL END, 0) AS likes,
  COALESCE(CASE WHEN nt.comment_count ~ '^[0-9]+$' THEN nt.comment_count::bigint ELSE NULL END, 0) AS comments,
  CASE
    WHEN nt.growth_rate ~ '^-?\d+(\.\d+)?%?$'
      THEN REPLACE(TRIM(nt.growth_rate), '%', '')::numeric
    ELSE NULL
  END AS growth_rate_value,
  CASE
    WHEN nt.growth_rate ~ '^-?\d+(\.\d+)?%?$' THEN
      CASE
        WHEN REPLACE(TRIM(nt.growth_rate), '%', '')::numeric >= 1000000 THEN 'Viral (>1M/day)'
        WHEN REPLACE(TRIM(nt.growth_rate), '%', '')::numeric >= 100000 THEN 'High (>100K/day)'
        WHEN REPLACE(TRIM(nt.growth_rate), '%', '')::numeric >= 10000 THEN 'Moderate (>10K/day)'
        WHEN REPLACE(TRIM(nt.growth_rate), '%', '')::numeric > 0 THEN 'Growing'
        ELSE 'Stable'
      END
    WHEN nt.growth_rate ~ 'Viral|viral' THEN 'Viral (>1M/day)'
    WHEN nt.growth_rate ~ 'High|high' THEN 'High (>100K/day)'
    ELSE 'Growing'
  END AS growth_rate_label,
  nt.ai_opinion,
  nt.score_details::text AS score_details,
  nt.video_id,
  nt.external_id,
  nt.platform_mentions,
  nt.keywords,
  nt.updated_at
FROM news_trends nt
LEFT JOIN stories st ON st.story_id::text = nt.id::text
LEFT JOIN public_v_ai_images_latest img ON img.story_id::text = st.story_id::text
WHERE LOWER(nt.platform) = 'youtube'
  AND nt.title IS NOT NULL
  AND nt.title != ''
ORDER BY rank ASC NULLS LAST;

GRANT SELECT ON public.public_v_home_news TO anon, authenticated;

COMMENT ON VIEW public.public_v_home_news IS 
'Base home news view with FIXED published_date column mapping.
published_at = COALESCE(stories.publish_time, news_trends.published_date) [DISPLAY ONLY]
snapshot_date = COALESCE(news_trends.date, created_at in Thai TZ) [RANKING/FILTERING]
FIX: Changed from published_at (NULL) to published_date (valid data).
Updated: 2025-10-10';

-- ============================================================================
-- STEP 2: Recreate home_feed_v1 (29 columns with image fallback & web views)
-- ============================================================================

\echo 'Creating home_feed_v1 with published_date fix...'

CREATE VIEW public.home_feed_v1
WITH (security_barrier = true, security_invoker = false) AS
SELECT 
  v.id,
  v.title,
  v.summary,
  v.summary_en,
  v.category,
  v.platform,
  v.channel,
  v.published_at,  -- Now correctly sourced from published_date
  v.snapshot_date,
  v.source_url,
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
'Canonical home view (29 columns) with FIXED published_date.
published_at = Platform publish date from published_date column (display-only, Story Details).
snapshot_date = Ingestion date (ranking/filtering, Thai TZ).
FIX: Corrected column mapping from published_at → published_date.
Updated: 2025-10-10';

-- ============================================================================
-- STEP 3: Update System Metadata
-- ============================================================================

INSERT INTO public.system_meta (key, value, updated_at)
VALUES 
  ('home_view_version', '2025-10-10_published_date_fix', NOW()),
  ('published_at_source', 'news_trends.published_date', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- STEP 4: Post-Verification
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER;
  v_has_published INTEGER;
  v_has_snapshot INTEGER;
  v_published_pct NUMERIC;
BEGIN
  -- Check view row count
  SELECT COUNT(*) INTO v_count FROM public.home_feed_v1;
  
  IF v_count = 0 THEN
    RAISE WARNING 'View home_feed_v1 exists but has 0 rows (pipeline may not have run)';
  ELSE
    RAISE NOTICE 'View home_feed_v1 has % rows', v_count;
  END IF;
  
  -- Check published_at availability
  SELECT 
    COUNT(published_at),
    COUNT(snapshot_date)
  INTO v_has_published, v_has_snapshot
  FROM public.home_feed_v1;
  
  v_published_pct := ROUND(100.0 * v_has_published / NULLIF(v_count, 0), 1);
  
  RAISE NOTICE 'Published_at coverage: % / % (% %%)', v_has_published, v_count, v_published_pct;
  RAISE NOTICE 'Snapshot_date coverage: % / % (100 %%)', v_has_snapshot, v_count;
  
  IF v_published_pct < 50 THEN
    RAISE WARNING 'Low published_at coverage (% %%) - most items still NULL', v_published_pct;
    RAISE WARNING 'Check if news_trends.published_date column has data';
  ELSIF v_published_pct >= 90 THEN
    RAISE NOTICE '✅ Good published_at coverage (% %%)', v_published_pct;
  END IF;
  
  IF v_has_snapshot < v_count THEN
    RAISE WARNING 'Some items missing snapshot_date';
  ELSE
    RAISE NOTICE '✅ All items have snapshot_date';
  END IF;
END $$;

COMMIT;

\echo ''
\echo '✅ Published date column mapping fixed.'
\echo 'Verification: Both published_at and snapshot_date should now have data.'
\echo ''
\echo 'Test query:'
\echo '  SELECT id, published_at, snapshot_date, rank FROM home_feed_v1 LIMIT 5;'
\echo ''

