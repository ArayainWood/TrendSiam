-- =========================================================
-- REPAIR PUBLIC_V_HOME_NEWS - Complete Contract Fix
-- Date: 2025-09-17
-- 
-- This migration repairs the home view to match the exact
-- contract expected by the frontend, with resilient date
-- filtering and proper column aliasing.
--
-- Contract: 26 columns expected by mapNews.ts (includes additional
-- columns beyond the 21 in db_schema_inventory.mb)
-- Security: SECURITY INVOKER, anon read-only access
-- Policy: Top-3 only for images/prompts
-- 
-- Update: Added safe numeric parsing for growth_rate using LATERAL
-- to handle text values like "12.5%", "N/A", "" etc.
-- =========================================================

-- =========================================
-- 1. DROP EXISTING VIEWS SAFELY
-- =========================================

DROP VIEW IF EXISTS public.public_v_home_news CASCADE;
DROP VIEW IF EXISTS public.v_home_news CASCADE; -- Clean up old naming

-- =========================================
-- 2. CREATE CONTRACT-COMPLIANT HOME NEWS VIEW
-- =========================================

CREATE OR REPLACE VIEW public.public_v_home_news 
WITH (security_invoker = true) AS
WITH cfg AS (
  -- Read configuration from system_meta with defaults
  SELECT
    COALESCE((SELECT value::int FROM system_meta WHERE key='home_limit'), 20) AS home_limit,
    COALESCE((SELECT value::int FROM system_meta WHERE key='top3_max'), 3) AS top3_max
),

-- Get items with resilient date filtering
base_items AS (
  SELECT
    nt.*,
    -- Compute effective date for filtering
    COALESCE(
      nt.published_at,
      nt.published_date,
      nt.updated_at,
      nt.created_at
    ) AS effective_date
  FROM news_trends nt
  WHERE nt.title IS NOT NULL 
    AND nt.title != ''
),

-- Apply resilient freshness filter with fallback
filtered_items AS (
  SELECT * FROM base_items
  WHERE 
    -- Primary: last 48 hours in Thai timezone
    effective_date >= (NOW() AT TIME ZONE 'Asia/Bangkok' - INTERVAL '48 hours')
  
  UNION ALL
  
  -- Fallback: if no items in 48h, get last 7 days
  SELECT * FROM base_items
  WHERE NOT EXISTS (
    SELECT 1 FROM base_items 
    WHERE effective_date >= (NOW() AT TIME ZONE 'Asia/Bangkok' - INTERVAL '48 hours')
  )
  AND effective_date >= (NOW() AT TIME ZONE 'Asia/Bangkok' - INTERVAL '7 days')
),

-- Rank items by popularity
ranked AS (
  SELECT
    fi.*,
    -- Deterministic ranking
    DENSE_RANK() OVER (
      ORDER BY 
        COALESCE(fi.popularity_score, 0) DESC,
        COALESCE(
          CASE 
            WHEN fi.view_count ~ '^[0-9]+$' THEN fi.view_count::bigint
            ELSE 0
          END, 0
        ) DESC,
        fi.effective_date DESC NULLS LAST,
        fi.id  -- Stable tiebreaker
    ) AS rank
  FROM filtered_items fi
),

-- Apply limits and prepare final selection
final_selection AS (
  SELECT
    r.*,
    -- Determine Top-3 status
    (r.rank <= (SELECT top3_max FROM cfg)) AS is_top3
  FROM ranked r
  CROSS JOIN cfg
  WHERE r.rank <= (SELECT home_limit FROM cfg)
)

SELECT
  -- All columns expected by mapNews.ts
  
  -- 1. id
  fs.id::text AS id,
  
  -- 2. title
  fs.title::text AS title,
  
  -- 3. summary
  fs.summary::text AS summary,
  
  -- 4. summary_en
  COALESCE(fs.summary_en, fs.summary)::text AS summary_en,
  
  -- 5. category
  fs.category::text AS category,
  
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
  fs.channel::text AS channel,
  
  -- 8. published_at
  COALESCE(fs.published_at, fs.published_date, fs.updated_at)::timestamptz AS published_at,
  
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
  COALESCE(fs.popularity_score, 0)::numeric AS popularity_score,
  
  -- 13. rank
  fs.rank::integer AS rank,
  
  -- 14. is_top3
  fs.is_top3::boolean AS is_top3,
  
  -- 15. views (aliased from view_count)
  COALESCE(
    CASE 
      WHEN fs.view_count ~ '^[0-9]+$' THEN fs.view_count::bigint
      ELSE NULLIF(regexp_replace(COALESCE(fs.view_count, '0'), '[^0-9]', '', 'g'), '')::bigint
    END,
    0
  )::bigint AS views,
  
  -- 16. likes (aliased from like_count)
  COALESCE(
    CASE 
      WHEN fs.like_count ~ '^[0-9]+$' THEN fs.like_count::bigint
      ELSE NULLIF(regexp_replace(COALESCE(fs.like_count, '0'), '[^0-9]', '', 'g'), '')::bigint
    END,
    0
  )::bigint AS likes,
  
  -- 17. comments (aliased from comment_count)
  COALESCE(
    CASE 
      WHEN fs.comment_count ~ '^[0-9]+$' THEN fs.comment_count::bigint
      ELSE NULLIF(regexp_replace(COALESCE(fs.comment_count, '0'), '[^0-9]', '', 'g'), '')::bigint
    END,
    0
  )::bigint AS comments,
  
  -- 18. growth_rate_value (safe numeric)
  gr.gr_num AS growth_rate_value,
  
  -- 19. growth_rate_label (derived from the parsed numeric)
  CASE
    WHEN gr.gr_num IS NULL THEN 'Not enough data'
    WHEN gr.gr_num >= 0.35 THEN 'Spike'
    WHEN gr.gr_num >= 0.10 THEN 'Rising'
    WHEN gr.gr_num >= -0.10 THEN 'Stable'
    ELSE 'Cooling'
  END::text AS growth_rate_label,
  
  -- 20. ai_opinion
  fs.ai_opinion::text AS ai_opinion,
  
  -- 21. score_details
  CASE 
    WHEN fs.score_details IS NULL THEN NULL::jsonb
    WHEN fs.score_details::text = '' THEN NULL::jsonb
    WHEN jsonb_typeof(fs.score_details::jsonb) IS NOT NULL THEN fs.score_details::jsonb
    ELSE NULL::jsonb
  END AS score_details,
  
  -- Additional columns expected by mapNews.ts:
  
  -- 22. video_id
  fs.video_id::text AS video_id,
  
  -- 23. external_id
  fs.external_id::text AS external_id,
  
  -- 24. platform_mentions
  fs.platform_mentions::integer AS platform_mentions,
  
  -- 25. keywords
  fs.keywords::text AS keywords,
  
  -- 26. updated_at
  fs.updated_at::timestamptz AS updated_at

FROM final_selection fs
CROSS JOIN LATERAL (
  SELECT
    NULLIF(
      regexp_replace(
        COALESCE(fs.growth_rate::text, ''),
        '[^0-9.\-]+',      -- strip anything not digit/dot/minus
        '',
        'g'
      ),
      ''
    )::numeric AS gr_num
) gr
ORDER BY fs.rank ASC, fs.id ASC;

-- =========================================
-- 3. SET SECURITY AND PERMISSIONS
-- =========================================

-- Ensure SECURITY INVOKER (respects RLS)
ALTER VIEW public.public_v_home_news SET (security_invoker = on);

-- Grant read access following Plan-B security model
GRANT SELECT ON public.public_v_home_news TO anon;
GRANT SELECT ON public.public_v_home_news TO authenticated;
GRANT SELECT ON public.public_v_home_news TO service_role;

-- =========================================
-- 4. ADD DOCUMENTATION
-- =========================================

COMMENT ON VIEW public.public_v_home_news IS 
'Home page news view with 26-column contract expected by mapNews.ts. 
Implements: resilient date filtering (48h + 7d fallback), 
Top-3 image/prompt policy, timezone-aware freshness, 
deterministic ranking, Plan-B security model, and
safe numeric parsing for growth_rate field.
Updated: 2025-09-17';

-- =========================================
-- 5. VERIFICATION QUERIES
-- =========================================

-- Verify view exists and has data
DO $$
DECLARE
  v_count INTEGER;
  v_columns TEXT[];
  v_expected_columns TEXT[] := ARRAY[
    'id', 'title', 'summary', 'summary_en', 'category', 'platform',
    'channel', 'published_at', 'source_url', 'image_url', 'ai_prompt',
    'popularity_score', 'rank', 'is_top3', 'views', 'likes', 'comments',
    'growth_rate_value', 'growth_rate_label', 'ai_opinion', 'score_details',
    'video_id', 'external_id', 'platform_mentions', 'keywords', 'updated_at'
  ];
BEGIN
  -- Check row count
  SELECT COUNT(*) INTO v_count FROM public.public_v_home_news;
  RAISE NOTICE 'View has % rows', v_count;
  
  -- Check columns
  SELECT array_agg(column_name ORDER BY ordinal_position)
  INTO v_columns
  FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'public_v_home_news';
  
  -- Verify all expected columns exist
  IF v_columns IS DISTINCT FROM v_expected_columns THEN
    RAISE WARNING 'Column mismatch! Expected: %, Got: %', v_expected_columns, v_columns;
  ELSE
    RAISE NOTICE 'All 26 columns present and in correct order';
  END IF;
  
  -- Warn if no data
  IF v_count = 0 THEN
    RAISE WARNING 'View returns 0 rows - check if news_trends table has data';
  END IF;
END $$;
