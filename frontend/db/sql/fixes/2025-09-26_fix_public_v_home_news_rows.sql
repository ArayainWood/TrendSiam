-- =========================================================
-- FIX HOME VIEW TO BE INDEPENDENT OF META TABLES
-- Date: 2025-09-26
--
-- Fixes zero rows issue by:
-- 1. Removing all dependencies on system_meta tables
-- 2. Using hardcoded defaults for config values
-- 3. Ensuring LEFT JOINs don't eliminate rows
-- 4. Matching exact column names expected by frontend
-- =========================================================

BEGIN;

-- =========================================
-- DROP AND RECREATE SIMPLIFIED VIEW
-- =========================================

DROP VIEW IF EXISTS public.public_v_home_news CASCADE;

-- Create view with no meta dependencies
CREATE VIEW public.public_v_home_news 
WITH (security_invoker = false, security_barrier = true) AS
WITH 
-- Use hardcoded defaults - no dependency on meta tables
config_defaults AS (
  SELECT 
    20 AS home_limit,
    3 AS top3_max,
    INTERVAL '72 hours' AS primary_window,
    INTERVAL '30 days' AS fallback_window
),

-- Get latest snapshot per story (if exists)
latest_snapshots AS (
  SELECT DISTINCT ON (s.story_id)
    s.story_id,
    s.snapshot_date,
    s.view_count AS snap_view_count,
    s.like_count AS snap_like_count,
    s.comment_count AS snap_comment_count,
    s.popularity_score AS snap_popularity_score,
    s.growth_rate AS snap_growth_rate
  FROM snapshots s
  ORDER BY s.story_id, s.snapshot_date DESC
),

-- Get all news items with optional snapshot data
all_items AS (
  SELECT
    nt.id,
    nt.title,
    nt.summary,
    nt.summary_en,
    nt.category,
    nt.platform,
    nt.channel,
    nt.published_at,
    nt.published_date,
    nt.source_url,
    nt.ai_image_url,
    nt.ai_image_prompt,
    nt.popularity_score,
    nt.view_count,
    nt.like_count,
    nt.comment_count,
    nt.growth_rate,
    nt.ai_opinion,
    nt.score_details,
    nt.video_id,
    nt.external_id,
    nt.platform_mentions,
    nt.keywords,
    nt.updated_at,
    nt.created_at,
    -- Optional snapshot data
    st.story_id,
    ls.snapshot_date,
    ls.snap_view_count,
    ls.snap_like_count,
    ls.snap_comment_count,
    ls.snap_popularity_score,
    ls.snap_growth_rate
  FROM news_trends nt
  LEFT JOIN stories st ON st.source_id = COALESCE(nt.video_id, nt.external_id)
  LEFT JOIN latest_snapshots ls ON ls.story_id = st.story_id
  WHERE nt.title IS NOT NULL 
    AND nt.title != ''
),

-- Add ranking based on popularity
ranked_items AS (
  SELECT
    ai.*,
    -- Use snapshot data if available, otherwise use news_trends data
    COALESCE(ai.snap_popularity_score, ai.popularity_score, 0) AS effective_popularity_score,
    COALESCE(ai.snap_view_count, ai.view_count, '0') AS effective_view_count,
    -- Calculate rank
    DENSE_RANK() OVER (
      ORDER BY 
        COALESCE(ai.snap_popularity_score, ai.popularity_score, 0) DESC,
        COALESCE(
          CASE 
            WHEN COALESCE(ai.snap_view_count, ai.view_count, '0') ~ '^[0-9]+$' 
            THEN COALESCE(ai.snap_view_count, ai.view_count, '0')::bigint
            ELSE 0
          END, 0
        ) DESC,
        COALESCE(ai.snapshot_date, ai.published_at, ai.created_at) DESC NULLS LAST,
        ai.id
    ) AS rank
  FROM all_items ai
),

-- Mark top 3 items
final_selection AS (
  SELECT
    ri.*,
    (ri.rank <= 3) AS is_top3
  FROM ranked_items ri
)

-- Final output with exact column names and types
SELECT
  -- 1. id
  fs.id::text AS id,
  
  -- 2. title
  fs.title::text AS title,
  
  -- 3. summary
  fs.summary::text AS summary,
  
  -- 4. summary_en
  COALESCE(fs.summary_en, fs.summary)::text AS summary_en,
  
  -- 5. category
  COALESCE(fs.category, 'General')::text AS category,
  
  -- 6. platform
  COALESCE(fs.platform, 
    CASE 
      WHEN fs.video_id IS NOT NULL OR fs.external_id LIKE 'YT%' THEN 'YouTube'
      WHEN fs.external_id LIKE 'TT%' THEN 'TikTok'
      WHEN fs.external_id LIKE 'IG%' THEN 'Instagram'
      WHEN fs.external_id LIKE 'FB%' THEN 'Facebook'
      WHEN fs.external_id LIKE 'X%' OR fs.external_id LIKE 'TW%' THEN 'X'
      ELSE 'Social'
    END
  )::text AS platform,
  
  -- 7. channel
  COALESCE(fs.channel, 'Unknown')::text AS channel,
  
  -- 8. published_at
  COALESCE(fs.published_at, fs.published_date, fs.created_at)::timestamptz AS published_at,
  
  -- 9. source_url (NEVER NULL)
  COALESCE(
    NULLIF(fs.source_url, ''),
    CASE 
      WHEN fs.video_id IS NOT NULL AND fs.video_id != '' 
      THEN 'https://www.youtube.com/watch?v=' || fs.video_id
      WHEN fs.external_id IS NOT NULL AND fs.external_id != '' 
      THEN 'https://www.youtube.com/watch?v=' || fs.external_id
      ELSE 'https://trendsiam.com/story/' || fs.id
    END
  )::text AS source_url,
  
  -- 10. image_url (NULL except for Top-3)
  CASE 
    WHEN fs.is_top3 THEN fs.ai_image_url
    ELSE NULL
  END::text AS image_url,
  
  -- 11. ai_prompt (NULL except for Top-3)
  CASE 
    WHEN fs.is_top3 THEN fs.ai_image_prompt
    ELSE NULL
  END::text AS ai_prompt,
  
  -- 12. popularity_score
  fs.effective_popularity_score::numeric AS popularity_score,
  
  -- 13. rank
  fs.rank::integer AS rank,
  
  -- 14. is_top3
  fs.is_top3::boolean AS is_top3,
  
  -- 15. views (convert safely to bigint)
  COALESCE(
    CASE 
      WHEN fs.effective_view_count ~ '^[0-9]+$' THEN fs.effective_view_count::bigint
      WHEN fs.effective_view_count IS NOT NULL THEN 
        NULLIF(regexp_replace(fs.effective_view_count, '[^0-9]', '', 'g'), '')::bigint
      ELSE 0
    END,
    0
  )::bigint AS views,
  
  -- 16. likes (convert safely to bigint)
  COALESCE(
    CASE 
      WHEN COALESCE(fs.snap_like_count, fs.like_count, '0') ~ '^[0-9]+$' 
      THEN COALESCE(fs.snap_like_count, fs.like_count, '0')::bigint
      ELSE NULLIF(
        regexp_replace(COALESCE(fs.snap_like_count, fs.like_count, '0'), '[^0-9]', '', 'g'), 
        ''
      )::bigint
    END,
    0
  )::bigint AS likes,
  
  -- 17. comments (convert safely to bigint)
  COALESCE(
    CASE 
      WHEN COALESCE(fs.snap_comment_count, fs.comment_count, '0') ~ '^[0-9]+$' 
      THEN COALESCE(fs.snap_comment_count, fs.comment_count, '0')::bigint
      ELSE NULLIF(
        regexp_replace(COALESCE(fs.snap_comment_count, fs.comment_count, '0'), '[^0-9]', '', 'g'), 
        ''
      )::bigint
    END,
    0
  )::bigint AS comments,
  
  -- 18. growth_rate_value (safe numeric conversion)
  COALESCE(
    NULLIF(
      regexp_replace(
        COALESCE(fs.snap_growth_rate, fs.growth_rate, '0')::text,
        '[^0-9.\-]+',
        '',
        'g'
      ),
      ''
    )::numeric,
    0
  )::numeric AS growth_rate_value,
  
  -- 19. growth_rate_label (derived from value)
  CASE
    WHEN COALESCE(
      NULLIF(
        regexp_replace(
          COALESCE(fs.snap_growth_rate, fs.growth_rate, '0')::text,
          '[^0-9.\-]+',
          '',
          'g'
        ),
        ''
      )::numeric,
      0
    ) >= 0.35 THEN 'Spike'
    WHEN COALESCE(
      NULLIF(
        regexp_replace(
          COALESCE(fs.snap_growth_rate, fs.growth_rate, '0')::text,
          '[^0-9.\-]+',
          '',
          'g'
        ),
        ''
      )::numeric,
      0
    ) >= 0.10 THEN 'Rising'
    WHEN COALESCE(
      NULLIF(
        regexp_replace(
          COALESCE(fs.snap_growth_rate, fs.growth_rate, '0')::text,
          '[^0-9.\-]+',
          '',
          'g'
        ),
        ''
      )::numeric,
      0
    ) >= -0.10 THEN 'Stable'
    ELSE 'Cooling'
  END::text AS growth_rate_label,
  
  -- 20. ai_opinion
  fs.ai_opinion::text AS ai_opinion,
  
  -- 21. score_details (safe JSON handling)
  CASE 
    WHEN fs.score_details IS NULL THEN NULL::jsonb
    WHEN fs.score_details::text = '' THEN NULL::jsonb
    WHEN fs.score_details::text ~ '^[\{\[].*[\}\]]$' THEN fs.score_details::jsonb
    ELSE NULL::jsonb
  END AS score_details,
  
  -- 22. video_id
  fs.video_id::text AS video_id,
  
  -- 23. external_id
  fs.external_id::text AS external_id,
  
  -- 24. platform_mentions
  CASE
  WHEN fs.platform_mentions IS NULL OR btrim(fs.platform_mentions) = '' THEN 0
  WHEN fs.platform_mentions ~ '^\s*\d+\s*$' THEN btrim(fs.platform_mentions)::integer
  ELSE 0
END AS platform_mentions,

  
  -- 25. keywords
  fs.keywords::text AS keywords,
  
  -- 26. updated_at
  COALESCE(fs.updated_at, fs.created_at)::timestamptz AS updated_at

FROM final_selection fs
ORDER BY fs.rank ASC, fs.id ASC;

-- =========================================
-- SET DEFINER SEMANTICS AND OWNERSHIP
-- =========================================

-- Force definer semantics
DO $$
BEGIN
  BEGIN
    ALTER VIEW public.public_v_home_news SET (security_invoker = false);
    RAISE NOTICE '✅ Set security_invoker = false on public_v_home_news';
  EXCEPTION
    WHEN undefined_object THEN
      RAISE NOTICE '⚠️  security_invoker not supported - using ownership model';
    WHEN OTHERS THEN
      RAISE NOTICE '⚠️  Could not set security_invoker: %', SQLERRM;
  END;
END $$;

-- Set owner to postgres
ALTER VIEW public.public_v_home_news OWNER TO postgres;

-- =========================================
-- SET PERMISSIONS
-- =========================================

-- Revoke all existing permissions first
REVOKE ALL ON public.public_v_home_news FROM PUBLIC;

-- Grant read access following Plan-B security model
GRANT SELECT ON public.public_v_home_news TO anon;
GRANT SELECT ON public.public_v_home_news TO authenticated;
GRANT SELECT ON public.public_v_home_news TO service_role;

-- Ensure base tables are NOT accessible
REVOKE ALL ON news_trends FROM anon, authenticated;
REVOKE ALL ON stories FROM anon, authenticated;
REVOKE ALL ON snapshots FROM anon, authenticated;
REVOKE ALL ON system_meta FROM anon, authenticated;

-- =========================================
-- DOCUMENTATION
-- =========================================

COMMENT ON VIEW public.public_v_home_news IS 
'Home page news view with 26-column contract expected by mapNews.ts. 
Security: DEFINER view with NO dependencies on system_meta tables.
Features: Returns all news_trends rows with title, uses LEFT JOINs only,
hardcoded config defaults (no meta lookups), snapshot data used when available,
Top-3 image/prompt policy enforced, safe type conversions for all numeric fields.
Updated: 2025-09-26 - Made independent of meta tables to fix zero rows issue';

-- =========================================
-- VERIFICATION
-- =========================================

DO $$
DECLARE
  v_count INTEGER;
  v_error TEXT;
  v_columns TEXT[];
  v_expected_columns TEXT[] := ARRAY[
    'id', 'title', 'summary', 'summary_en', 'category', 'platform',
    'channel', 'published_at', 'source_url', 'image_url', 'ai_prompt',
    'popularity_score', 'rank', 'is_top3', 'views', 'likes', 'comments',
    'growth_rate_value', 'growth_rate_label', 'ai_opinion', 'score_details',
    'video_id', 'external_id', 'platform_mentions', 'keywords', 'updated_at'
  ];
BEGIN
  -- Test view returns rows
  BEGIN
    SELECT COUNT(*) INTO v_count FROM public.public_v_home_news;
    IF v_count = 0 THEN
      RAISE WARNING '⚠️  View returns 0 rows - check if news_trends table has data';
    ELSE
      RAISE NOTICE '✅ View returns % rows', v_count;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    RAISE WARNING '❌ View query failed: %', v_error;
  END;
  
  -- Check that view does NOT reference system_meta
  IF EXISTS (
    SELECT 1 
    FROM pg_views 
    WHERE schemaname = 'public' 
      AND viewname = 'public_v_home_news'
      AND (definition LIKE '%system_meta%' OR definition LIKE '%public_v_system_meta%')
  ) THEN
    RAISE WARNING '❌ View still references system_meta tables!';
  ELSE
    RAISE NOTICE '✅ View has no system_meta dependencies';
  END IF;
  
  -- Check columns match expected
  SELECT array_agg(column_name ORDER BY ordinal_position)
  INTO v_columns
  FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'public_v_home_news';
  
  IF v_columns IS DISTINCT FROM v_expected_columns THEN
    RAISE WARNING 'Column mismatch! Expected: %, Got: %', v_expected_columns, v_columns;
  ELSE
    RAISE NOTICE '✅ All 26 columns present and in correct order';
  END IF;
  
  -- Test base news_trends table has data
  SELECT COUNT(*) INTO v_count FROM news_trends WHERE title IS NOT NULL AND title != '';
  RAISE NOTICE 'Base news_trends table has % valid rows', v_count;
END $$;

COMMIT;
