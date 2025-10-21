/**
 * HOTFIX: Add snapshot_date to home_feed_v1
 * Date: 2025-10-10
 * 
 * EMERGENCY FIX for production 500 error:
 * - API queries snapshot_date but column doesn't exist
 * - Previous migration had syntax errors and didn't complete
 * 
 * This hotfix:
 * 1. Adds snapshot_date column to news_trends if missing
 * 2. Recreates views with snapshot_date (simplified, working SQL)
 * 3. Maintains backward compatibility (all previous columns present)
 * 4. Idempotent and safe to run multiple times
 * 
 * IDEMPOTENT: Safe to run multiple times
 * SECURITY: Plan-B compliant (DEFINER view, no base grants)
 */

\set ON_ERROR_STOP on

BEGIN;

-- ============================================================================
-- STEP 1: Ensure news_trends.date column exists (snapshot date)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'news_trends'
      AND column_name = 'date'
  ) THEN
    ALTER TABLE public.news_trends ADD COLUMN date DATE;
    UPDATE public.news_trends SET date = DATE(created_at AT TIME ZONE 'Asia/Bangkok') WHERE date IS NULL;
    RAISE NOTICE 'Added and backfilled news_trends.date column';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Recreate public_v_home_news (base view, 26 columns)
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
  CASE WHEN LOWER(nt.platform) = 'youtube' THEN 'YouTube' ELSE nt.platform END AS platform,
  nt.channel,
  COALESCE(st.publish_time, nt.published_at) AS published_at,
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
             COALESCE(st.publish_time, nt.published_at) DESC NULLS LAST,
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
'Base home news view with snapshot_date.
published_at = Platform publish date (display-only).
snapshot_date = Our ingestion date (ranking/filtering).
Updated: 2025-10-10 HOTFIX - Added snapshot_date column.';

-- ============================================================================
-- STEP 3: Recreate home_feed_v1 (29 columns with image fallback & web views)
-- ============================================================================

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
  v.published_at,
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
'Canonical home view (29 columns) with snapshot_date.
published_at = Platform publish date (display-only, Story Details).
snapshot_date = Ingestion date (ranking/filtering, Thai TZ).
Image fallback: AI → platform thumbnail (Top-3 only).
Updated: 2025-10-10 HOTFIX - Added snapshot_date.';

-- ============================================================================
-- STEP 4: Update System Metadata
-- ============================================================================

INSERT INTO public.system_meta (key, value, updated_at)
VALUES 
  ('home_view_version', '2025-10-10_hotfix_snapshot_date', NOW()),
  ('home_freshness_policy', 'snapshot_date_basic:thai_tz', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- STEP 5: Post-Verification
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER;
  v_has_snapshot BOOLEAN;
BEGIN
  -- Check view exists
  SELECT COUNT(*) INTO v_count FROM public.home_feed_v1;
  IF v_count = 0 THEN
    RAISE WARNING 'View home_feed_v1 exists but has 0 rows (pipeline may not have run)';
  END IF;
  
  -- Check snapshot_date column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'home_feed_v1'
      AND column_name = 'snapshot_date'
  ) INTO v_has_snapshot;
  
  IF NOT v_has_snapshot THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: home_feed_v1 missing snapshot_date column';
  END IF;
  
  RAISE NOTICE 'VERIFICATION PASSED: home_feed_v1 exists with % rows and snapshot_date column', v_count;
END $$;

COMMIT;

\echo ''
\echo '✅ HOTFIX complete. View home_feed_v1 now has snapshot_date column.'
\echo 'Verification: View exists, snapshot_date selectable, grants applied.'
\echo ''
\echo 'Next: Test with: SELECT id, published_at, snapshot_date, rank FROM home_feed_v1 LIMIT 5;'
\echo ''

