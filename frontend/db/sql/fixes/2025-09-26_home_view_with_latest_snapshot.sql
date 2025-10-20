-- =========================================================
-- RESTORE HOME VIEW WITH FULL DATA (26-COLUMN CONTRACT)
-- Date: 2025-09-26
--
-- Fixes missing English summaries, analysis & scores by:
-- 1. Properly joining stories, news_trends, snapshots
-- 2. Getting ai_opinion, score_details from news_trends
-- 3. Getting latest popularity_score from snapshots
-- 4. Maintaining all 26 columns with correct types
-- =========================================================

BEGIN;

-- =========================================
-- DROP AND RECREATE WITH PROPER JOINS
-- =========================================

DROP VIEW IF EXISTS public.public_v_home_news CASCADE;

-- Check if AI images view exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' AND viewname = 'public_v_ai_images_latest'
  ) THEN
    -- Create a simple bridge view if it doesn't exist
    CREATE VIEW public.public_v_ai_images_latest AS
    SELECT DISTINCT ON (news_id)
      news_id,
      image_url,
      prompt,
      created_at
    FROM ai_images
    WHERE is_active = true
    ORDER BY news_id, created_at DESC;
    
    GRANT SELECT ON public.public_v_ai_images_latest TO anon, authenticated;
  END IF;
END $$;

-- Create the main home view
CREATE VIEW public.public_v_home_news 
WITH (security_invoker = false, security_barrier = true) AS
WITH 
-- Get latest snapshot per story
latest_snapshots AS (
  SELECT DISTINCT ON (s.story_id)
    s.story_id,
    s.snapshot_date,
    s.view_count AS snap_view_count,
    s.like_count AS snap_like_count,
    s.comment_count AS snap_comment_count,
    s.popularity_score AS snap_popularity_score,
    s.rank AS snap_rank,
    s.growth_rate AS snap_growth_rate
  FROM snapshots s
  ORDER BY s.story_id, s.snapshot_date DESC
),

-- Main data assembly
base_data AS (
  SELECT
    -- Use news_trends as primary source (it has the analysis fields)
    nt.id,
    nt.title,
    nt.summary,
    nt.summary_en,
    nt.description,
    nt.category,
    nt.platform,
    nt.channel,
    nt.video_id,
    nt.external_id,
    nt.published_at,
    nt.published_date,
    nt.source_url,
    nt.view_count,
    nt.like_count,
    nt.comment_count,
    nt.growth_rate,
    nt.ai_image_url,
    nt.ai_image_prompt,
    nt.platform_mentions,
    nt.keywords,
    nt.ai_opinion,      -- This comes from news_trends
    nt.score_details,   -- This comes from news_trends
    nt.popularity_score AS nt_popularity_score,
    nt.created_at,
    nt.updated_at,
    -- Join with stories for additional data
    st.story_id,
    st.summary_en AS st_summary_en,
    -- Join with latest snapshots
    ls.snapshot_date,
    ls.snap_view_count,
    ls.snap_like_count,
    ls.snap_comment_count,
    ls.snap_popularity_score,
    ls.snap_rank,
    ls.snap_growth_rate
  FROM news_trends nt
  LEFT JOIN stories st ON st.source_id = COALESCE(nt.video_id, nt.external_id)
  LEFT JOIN latest_snapshots ls ON ls.story_id = st.story_id
  WHERE nt.title IS NOT NULL 
    AND nt.title != ''
),

-- Add ranking
ranked_data AS (
  SELECT
    bd.*,
    -- Use snapshot popularity if available, otherwise news_trends
    COALESCE(bd.snap_popularity_score, bd.nt_popularity_score, 0) AS effective_popularity_score,
    -- Calculate rank if not in snapshot
    COALESCE(
      bd.snap_rank::integer,
      DENSE_RANK() OVER (
        ORDER BY 
          COALESCE(bd.snap_popularity_score, bd.nt_popularity_score, 0) DESC,
          COALESCE(bd.published_at, bd.published_date, bd.created_at) DESC,
          bd.id
      )
    ) AS calculated_rank
  FROM base_data bd
),

-- Mark top 3 and join AI images
final_data AS (
  SELECT
    rd.*,
    (rd.calculated_rank <= 3) AS is_top3,
    ai.image_url AS ai_latest_image_url,
    ai.prompt AS ai_latest_prompt
  FROM ranked_data rd
  LEFT JOIN public.public_v_ai_images_latest ai ON ai.news_id = rd.id
)

-- Final output with all 26 columns
SELECT
  -- 1. id
  fd.id::text AS id,
  
  -- 2. title
  fd.title::text AS title,
  
  -- 3. summary
  fd.summary::text AS summary,
  
  -- 4. summary_en (prefer stories, fallback to news_trends)
  COALESCE(fd.st_summary_en, fd.summary_en, fd.summary)::text AS summary_en,
  
  -- 5. category
  COALESCE(fd.category, 'General')::text AS category,
  
  -- 6. platform
  COALESCE(fd.platform, 
    CASE 
      WHEN fd.video_id IS NOT NULL OR fd.external_id LIKE 'YT%' THEN 'YouTube'
      WHEN fd.external_id LIKE 'TT%' THEN 'TikTok'
      WHEN fd.external_id LIKE 'IG%' THEN 'Instagram'
      WHEN fd.external_id LIKE 'FB%' THEN 'Facebook'
      WHEN fd.external_id LIKE 'X%' OR fd.external_id LIKE 'TW%' THEN 'X'
      ELSE 'Social'
    END
  )::text AS platform,
  
  -- 7. channel
  COALESCE(fd.channel, 'Unknown')::text AS channel,
  
  -- 8. published_at
  COALESCE(fd.published_at, fd.published_date, fd.created_at)::timestamptz AS published_at,
  
  -- 9. source_url (NEVER NULL)
  COALESCE(
    NULLIF(fd.source_url, ''),
    CASE 
      WHEN fd.video_id IS NOT NULL AND fd.video_id != '' 
      THEN 'https://www.youtube.com/watch?v=' || fd.video_id
      WHEN fd.external_id IS NOT NULL AND fd.external_id != '' 
      THEN 'https://www.youtube.com/watch?v=' || fd.external_id
      ELSE 'https://trendsiam.com/story/' || fd.id
    END
  )::text AS source_url,
  
  -- 10. image_url (NULL except for Top-3)
  CASE 
    WHEN fd.is_top3 THEN COALESCE(fd.ai_latest_image_url, fd.ai_image_url)
    ELSE NULL
  END::text AS image_url,
  
  -- 11. ai_prompt (NULL except for Top-3)
  CASE 
    WHEN fd.is_top3 THEN COALESCE(fd.ai_latest_prompt, fd.ai_image_prompt)
    ELSE NULL
  END::text AS ai_prompt,
  
  -- 12. popularity_score (from snapshot or news_trends)
  fd.effective_popularity_score::numeric AS popularity_score,
  
  -- 13. rank
  fd.calculated_rank::integer AS rank,
  
  -- 14. is_top3
  fd.is_top3::boolean AS is_top3,
  
  -- 15. views (prefer snapshot, fallback to news_trends)
  COALESCE(
    CASE 
      WHEN fd.snap_view_count ~ '^[0-9]+$' THEN fd.snap_view_count::bigint
      WHEN fd.snap_view_count IS NOT NULL THEN 
        NULLIF(regexp_replace(fd.snap_view_count, '[^0-9]', '', 'g'), '')::bigint
      WHEN fd.view_count ~ '^[0-9]+$' THEN fd.view_count::bigint
      ELSE NULLIF(regexp_replace(COALESCE(fd.view_count, '0'), '[^0-9]', '', 'g'), '')::bigint
    END,
    0
  )::bigint AS views,
  
  -- 16. likes
  COALESCE(
    CASE 
      WHEN fd.snap_like_count ~ '^[0-9]+$' THEN fd.snap_like_count::bigint
      WHEN fd.snap_like_count IS NOT NULL THEN 
        NULLIF(regexp_replace(fd.snap_like_count, '[^0-9]', '', 'g'), '')::bigint
      WHEN fd.like_count ~ '^[0-9]+$' THEN fd.like_count::bigint
      ELSE NULLIF(regexp_replace(COALESCE(fd.like_count, '0'), '[^0-9]', '', 'g'), '')::bigint
    END,
    0
  )::bigint AS likes,
  
  -- 17. comments
  COALESCE(
    CASE 
      WHEN fd.snap_comment_count ~ '^[0-9]+$' THEN fd.snap_comment_count::bigint
      WHEN fd.snap_comment_count IS NOT NULL THEN 
        NULLIF(regexp_replace(fd.snap_comment_count, '[^0-9]', '', 'g'), '')::bigint
      WHEN fd.comment_count ~ '^[0-9]+$' THEN fd.comment_count::bigint
      ELSE NULLIF(regexp_replace(COALESCE(fd.comment_count, '0'), '[^0-9]', '', 'g'), '')::bigint
    END,
    0
  )::bigint AS comments,
  
  -- 18. growth_rate_value (prefer snapshot, fallback to news_trends)
  COALESCE(
    NULLIF(
      regexp_replace(
        COALESCE(fd.snap_growth_rate, fd.growth_rate, '0')::text,
        '[^0-9.\-]+',
        '',
        'g'
      ),
      ''
    )::numeric,
    0
  )::numeric AS growth_rate_value,
  
  -- 19. growth_rate_label
  CASE
    WHEN COALESCE(
      NULLIF(
        regexp_replace(
          COALESCE(fd.snap_growth_rate, fd.growth_rate, '0')::text,
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
          COALESCE(fd.snap_growth_rate, fd.growth_rate, '0')::text,
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
          COALESCE(fd.snap_growth_rate, fd.growth_rate, '0')::text,
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
  
  -- 20. ai_opinion (from news_trends)
  fd.ai_opinion::text AS ai_opinion,
  
  -- 21. score_details (from news_trends, ensure valid JSON)
  CASE 
    WHEN fd.score_details IS NULL THEN NULL::jsonb
    WHEN fd.score_details::text = '' THEN NULL::jsonb
    WHEN fd.score_details::text ~ '^\s*\{.*\}\s*$' THEN fd.score_details::jsonb
    ELSE NULL::jsonb
  END AS score_details,
  
  -- 22. video_id
  fd.video_id::text AS video_id,
  
  -- 23. external_id
  fd.external_id::text AS external_id,
  
  -- 24. platform_mentions (safe integer conversion)
  CASE
    WHEN fd.platform_mentions IS NULL THEN 0
    WHEN fd.platform_mentions::text ~ '^\s*\d+\s*$' THEN fd.platform_mentions
    ELSE 0
  END::integer AS platform_mentions,
  
  -- 25. keywords
  fd.keywords::text AS keywords,
  
  -- 26. updated_at
  COALESCE(fd.updated_at, fd.created_at)::timestamptz AS updated_at

FROM final_data fd
ORDER BY fd.calculated_rank ASC, fd.id ASC;

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
REVOKE ALL ON ai_images FROM anon, authenticated;
REVOKE ALL ON system_meta FROM anon, authenticated;

-- =========================================
-- DOCUMENTATION
-- =========================================

COMMENT ON VIEW public.public_v_home_news IS 
'Home page news view with 26-column contract expected by mapNews.ts. 
Security: DEFINER view with NO dependencies on system_meta tables.
Features: Properly joins news_trends (for analysis), stories (for translations),
snapshots (for latest metrics), and AI images. Returns ai_opinion, score_details,
summary_en, and all required fields. Uses LEFT JOINs to preserve all rows.
Updated: 2025-09-26 - Restored missing analysis fields and English summaries';

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
  v_lisa_check RECORD;
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
  
  -- Quick LISA check
  SELECT 
    summary_en IS NOT NULL AS has_summary_en,
    ai_opinion IS NOT NULL AS has_ai_opinion,
    score_details IS NOT NULL AS has_score_details,
    popularity_score > 0 AS has_popularity_score
  INTO v_lisa_check
  FROM public.public_v_home_news
  WHERE title ILIKE '%LISA%'
  LIMIT 1;
  
  IF FOUND THEN
    RAISE NOTICE '✅ LISA item check:';
    RAISE NOTICE '   summary_en: %', CASE WHEN v_lisa_check.has_summary_en THEN 'present' ELSE 'missing' END;
    RAISE NOTICE '   ai_opinion: %', CASE WHEN v_lisa_check.has_ai_opinion THEN 'present' ELSE 'missing' END;
    RAISE NOTICE '   score_details: %', CASE WHEN v_lisa_check.has_score_details THEN 'present' ELSE 'missing' END;
    RAISE NOTICE '   popularity_score: %', CASE WHEN v_lisa_check.has_popularity_score THEN 'present' ELSE 'missing' END;
  END IF;
  
  -- Test base news_trends table has data
  SELECT COUNT(*) INTO v_count FROM news_trends WHERE title IS NOT NULL AND title != '';
  RAISE NOTICE 'Base news_trends table has % valid rows', v_count;
END $$;

COMMIT;
