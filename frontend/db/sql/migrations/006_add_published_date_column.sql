-- Migration 006: Add published_date column to Home Views
-- Date: 2025-10-21
-- Purpose: Restore published_date column that was missing after Migration 005
-- Risk: MEDIUM - Drops and recreates views (brief unavailability during transaction)
-- Idempotent: Yes - DROP IF EXISTS + CREATE
-- Rollback: Re-run migration 005 or restore from backup

-- CONTEXT:
-- Migration 005 recreated views with published_at but OMITTED published_date.
-- Base table news_trends has BOTH columns:
--   - published_at: timestamp with time zone (original publish time)
--   - published_date: timestamp with time zone (processed/normalized date)
-- Frontend expects published_date (12 files reference it in types/components).
-- This migration adds published_date back to both views.

BEGIN;

-- Set statement timeout to prevent long-running queries
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

-- =====================================================
-- DROP EXISTING VIEWS (CASCADE to handle dependencies)
-- =====================================================

DROP VIEW IF EXISTS public.v_home_news CASCADE;
DROP VIEW IF EXISTS public.public_v_home_news CASCADE;

-- =====================================================
-- RECREATE public_v_home_news WITH BOTH published_at AND published_date
-- =====================================================

CREATE VIEW public.public_v_home_news
WITH (security_invoker = false, security_barrier = true)
AS
WITH thai_today AS (
    SELECT DATE(NOW() AT TIME ZONE 'Asia/Bangkok') AS today
),
today_items AS (
    SELECT
        nt.id::TEXT AS id,
        nt.title,
        nt.summary,
        COALESCE(st.summary_en, nt.summary_en) AS summary_en,
        nt.category,
        CASE WHEN LOWER(nt.platform) = 'youtube' THEN 'YouTube' ELSE nt.platform END AS platform,
        nt.channel,
        COALESCE(st.publish_time, nt.published_date) AS published_at,
        nt.published_date,  -- RESTORED: Original published_date column
        COALESCE(nt.date, DATE(nt.created_at AT TIME ZONE 'Asia/Bangkok')) AS snapshot_date,
        CASE
            WHEN LOWER(nt.platform) = 'youtube' AND nt.external_id IS NOT NULL THEN 'https://www.youtube.com/watch?v=' || nt.external_id
            WHEN LOWER(nt.platform) = 'youtube' AND nt.video_id IS NOT NULL THEN 'https://www.youtube.com/watch?v=' || nt.video_id
            ELSE nt.source_url
        END AS source_url,
        img.image_url AS ai_generated_image,
        nt.ai_image_url AS platform_thumbnail,
        COALESCE(img.ai_prompt, st.ai_image_prompt, nt.ai_image_prompt) AS ai_prompt,
        nt.popularity_score,
        nt.popularity_score_precise,
        ROW_NUMBER() OVER (ORDER BY nt.popularity_score_precise DESC NULLS LAST, nt.id) AS rank,
        COALESCE(CASE WHEN nt.view_count ~ '^[0-9]+$' THEN nt.view_count::BIGINT WHEN nt.view_count ~ '[0-9]+' THEN REGEXP_REPLACE(nt.view_count, '[^0-9]', '', 'g')::BIGINT ELSE NULL END, 0) AS video_views,
        COALESCE(CASE WHEN nt.like_count ~ '^[0-9]+$' THEN nt.like_count::BIGINT ELSE NULL END, 0) AS likes,
        COALESCE(CASE WHEN nt.comment_count ~ '^[0-9]+$' THEN nt.comment_count::BIGINT ELSE NULL END, 0) AS comments,
        CASE WHEN nt.growth_rate ~ '^-?\d+(\.\d+)?%?$' THEN REPLACE(TRIM(nt.growth_rate), '%', '')::NUMERIC ELSE NULL END AS growth_rate_value,
        CASE
            WHEN nt.growth_rate ~ '^-?\d+(\.\d+)?%?$' THEN
                CASE
                    WHEN REPLACE(TRIM(nt.growth_rate), '%', '')::NUMERIC >= 1000000 THEN 'Viral (>1M/day)'
                    WHEN REPLACE(TRIM(nt.growth_rate), '%', '')::NUMERIC >= 100000 THEN 'High (>100K/day)'
                    WHEN REPLACE(TRIM(nt.growth_rate), '%', '')::NUMERIC >= 10000 THEN 'Moderate (>10K/day)'
                    WHEN REPLACE(TRIM(nt.growth_rate), '%', '')::NUMERIC > 0 THEN 'Growing'
                    ELSE 'Stable'
                END
            WHEN nt.growth_rate ~ 'Viral|viral' THEN 'Viral (>1M/day)'
            WHEN nt.growth_rate ~ 'High|high' THEN 'High (>100K/day)'
            ELSE 'Growing'
        END AS growth_rate_label,
        nt.ai_opinion,
        nt.score_details,
        nt.video_id,
        nt.external_id,
        nt.platform_mentions,
        nt.keywords,
        nt.updated_at,
        1 AS priority
    FROM news_trends nt
    CROSS JOIN thai_today tt
    LEFT JOIN stories st ON st.story_id::TEXT = nt.id::TEXT
    LEFT JOIN public_v_ai_images_latest img ON img.story_id::TEXT = st.story_id::TEXT
    WHERE LOWER(nt.platform) = 'youtube'
        AND nt.title IS NOT NULL
        AND nt.title <> ''
        AND COALESCE(nt.date, DATE(nt.created_at AT TIME ZONE 'Asia/Bangkok')) = tt.today
),
fallback_items AS (
    SELECT
        nt.id::TEXT AS id,
        nt.title,
        nt.summary,
        COALESCE(st.summary_en, nt.summary_en) AS summary_en,
        nt.category,
        CASE WHEN LOWER(nt.platform) = 'youtube' THEN 'YouTube' ELSE nt.platform END AS platform,
        nt.channel,
        COALESCE(st.publish_time, nt.published_date) AS published_at,
        nt.published_date,  -- RESTORED: Original published_date column
        COALESCE(nt.date, DATE(nt.created_at AT TIME ZONE 'Asia/Bangkok')) AS snapshot_date,
        CASE
            WHEN LOWER(nt.platform) = 'youtube' AND nt.external_id IS NOT NULL THEN 'https://www.youtube.com/watch?v=' || nt.external_id
            WHEN LOWER(nt.platform) = 'youtube' AND nt.video_id IS NOT NULL THEN 'https://www.youtube.com/watch?v=' || nt.video_id
            ELSE nt.source_url
        END AS source_url,
        img.image_url AS ai_generated_image,
        nt.ai_image_url AS platform_thumbnail,
        COALESCE(img.ai_prompt, st.ai_image_prompt, nt.ai_image_prompt) AS ai_prompt,
        nt.popularity_score,
        nt.popularity_score_precise,
        ROW_NUMBER() OVER (ORDER BY COALESCE(nt.date, DATE(nt.created_at AT TIME ZONE 'Asia/Bangkok')) DESC, nt.popularity_score_precise DESC NULLS LAST, nt.id) AS rank,
        COALESCE(CASE WHEN nt.view_count ~ '^[0-9]+$' THEN nt.view_count::BIGINT WHEN nt.view_count ~ '[0-9]+' THEN REGEXP_REPLACE(nt.view_count, '[^0-9]', '', 'g')::BIGINT ELSE NULL END, 0) AS video_views,
        COALESCE(CASE WHEN nt.like_count ~ '^[0-9]+$' THEN nt.like_count::BIGINT ELSE NULL END, 0) AS likes,
        COALESCE(CASE WHEN nt.comment_count ~ '^[0-9]+$' THEN nt.comment_count::BIGINT ELSE NULL END, 0) AS comments,
        CASE WHEN nt.growth_rate ~ '^-?\d+(\.\d+)?%?$' THEN REPLACE(TRIM(nt.growth_rate), '%', '')::NUMERIC ELSE NULL END AS growth_rate_value,
        CASE
            WHEN nt.growth_rate ~ '^-?\d+(\.\d+)?%?$' THEN
                CASE
                    WHEN REPLACE(TRIM(nt.growth_rate), '%', '')::NUMERIC >= 1000000 THEN 'Viral (>1M/day)'
                    WHEN REPLACE(TRIM(nt.growth_rate), '%', '')::NUMERIC >= 100000 THEN 'High (>100K/day)'
                    WHEN REPLACE(TRIM(nt.growth_rate), '%', '')::NUMERIC >= 10000 THEN 'Moderate (>10K/day)'
                    WHEN REPLACE(TRIM(nt.growth_rate), '%', '')::NUMERIC > 0 THEN 'Growing'
                    ELSE 'Stable'
                END
            WHEN nt.growth_rate ~ 'Viral|viral' THEN 'Viral (>1M/day)'
            WHEN nt.growth_rate ~ 'High|high' THEN 'High (>100K/day)'
            ELSE 'Growing'
        END AS growth_rate_label,
        nt.ai_opinion,
        nt.score_details,
        nt.video_id,
        nt.external_id,
        nt.platform_mentions,
        nt.keywords,
        nt.updated_at,
        2 AS priority
    FROM news_trends nt
    CROSS JOIN thai_today tt
    LEFT JOIN stories st ON st.story_id::TEXT = nt.id::TEXT
    LEFT JOIN public_v_ai_images_latest img ON img.story_id::TEXT = st.story_id::TEXT
    WHERE LOWER(nt.platform) = 'youtube'
        AND nt.title IS NOT NULL
        AND nt.title <> ''
        AND COALESCE(nt.date, DATE(nt.created_at AT TIME ZONE 'Asia/Bangkok')) < tt.today
        AND COALESCE(nt.date, DATE(nt.created_at AT TIME ZONE 'Asia/Bangkok')) >= tt.today - INTERVAL '60 days'
        AND (SELECT COUNT(*) FROM today_items) < 20
),
combined_items AS (
    SELECT * FROM today_items
    UNION ALL
    SELECT * FROM fallback_items
)
SELECT
    id,
    title,
    summary,
    summary_en,
    category,
    platform,
    channel,
    published_at,
    published_date,  -- RESTORED: Now exposed in final SELECT
    snapshot_date,
    source_url,
    ai_generated_image,
    platform_thumbnail,
    ai_prompt,
    popularity_score,
    popularity_score_precise,
    ROW_NUMBER() OVER (ORDER BY priority, rank) AS rank,
    video_views,
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
FROM combined_items
ORDER BY priority, rank;

-- Set ownership and permissions
ALTER VIEW public.public_v_home_news OWNER TO postgres;
REVOKE ALL ON public.public_v_home_news FROM PUBLIC;
GRANT SELECT ON public.public_v_home_news TO anon, authenticated, service_role;

-- Update comment
COMMENT ON VIEW public.public_v_home_news IS
'Home feed view with full precision popularity score and published_date.
Updated: 2025-10-21 to restore published_date column (Migration 006).
Security: DEFINER mode (postgres privileges), read-only for anon/authenticated.
Contract: 29 columns (includes published_at AND published_date).';

-- =====================================================
-- RECREATE v_home_news ALIAS TO PASS THROUGH ALL COLUMNS
-- =====================================================

CREATE VIEW public.v_home_news AS
SELECT * FROM public.public_v_home_news;

ALTER VIEW public.v_home_news OWNER TO postgres;
REVOKE ALL ON public.v_home_news FROM PUBLIC;
GRANT SELECT ON public.v_home_news TO anon, authenticated, service_role;

COMMENT ON VIEW public.v_home_news IS
'Alias to public_v_home_news for backward compatibility.
Updated: 2025-10-21 to pass through published_date (Migration 006).
Contract: 29 columns (includes published_at AND published_date).';

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
    primary_col_count INTEGER;
    alias_col_count INTEGER;
    has_published_at_primary BOOLEAN;
    has_published_date_primary BOOLEAN;
    has_published_at_alias BOOLEAN;
    has_published_date_alias BOOLEAN;
    has_precise_primary BOOLEAN;
    has_precise_alias BOOLEAN;
    anon_can_read_primary BOOLEAN;
    anon_can_read_alias BOOLEAN;
BEGIN
    -- Check column counts
    SELECT COUNT(*) INTO primary_col_count
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'public_v_home_news';
    
    SELECT COUNT(*) INTO alias_col_count
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'v_home_news';
    
    IF primary_col_count <> alias_col_count THEN
        RAISE EXCEPTION 'Column count mismatch! public_v_home_news=%, v_home_news=%', 
            primary_col_count, alias_col_count;
    END IF;
    
    RAISE NOTICE 'Column count verified: % columns in both views', primary_col_count;
    
    -- Check published_at exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'public_v_home_news'
        AND column_name = 'published_at'
    ) INTO has_published_at_primary;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'v_home_news'
        AND column_name = 'published_at'
    ) INTO has_published_at_alias;
    
    -- Check published_date exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'public_v_home_news'
        AND column_name = 'published_date'
    ) INTO has_published_date_primary;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'v_home_news'
        AND column_name = 'published_date'
    ) INTO has_published_date_alias;
    
    -- Check popularity_score_precise exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'public_v_home_news'
        AND column_name = 'popularity_score_precise'
    ) INTO has_precise_primary;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'v_home_news'
        AND column_name = 'popularity_score_precise'
    ) INTO has_precise_alias;
    
    IF NOT has_published_at_primary OR NOT has_published_at_alias THEN
        RAISE EXCEPTION 'published_at missing!';
    END IF;
    
    IF NOT has_published_date_primary OR NOT has_published_date_alias THEN
        RAISE EXCEPTION 'published_date missing!';
    END IF;
    
    IF NOT has_precise_primary OR NOT has_precise_alias THEN
        RAISE EXCEPTION 'popularity_score_precise missing!';
    END IF;
    
    RAISE NOTICE 'All critical columns verified: published_at, published_date, popularity_score_precise';
    
    -- Check anon permissions (Plan-B compliance)
    SELECT has_table_privilege('anon', 'public.public_v_home_news', 'SELECT') INTO anon_can_read_primary;
    SELECT has_table_privilege('anon', 'public.v_home_news', 'SELECT') INTO anon_can_read_alias;
    
    IF NOT anon_can_read_primary THEN
        RAISE EXCEPTION 'Anon role cannot read public_v_home_news! Plan-B violation.';
    END IF;
    
    IF NOT anon_can_read_alias THEN
        RAISE EXCEPTION 'Anon role cannot read v_home_news! Plan-B violation.';
    END IF;
    
    RAISE NOTICE 'Plan-B compliance verified: anon can read both views';
    RAISE NOTICE 'Migration 006 verification passed. published_date restored successfully.';
END $$;

COMMIT;

