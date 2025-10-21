-- =========================================================
-- RECREATE HOME VIEW AS DEFINER VIEW
-- Date: 2025-09-23
--
-- Changes public_v_home_news from security_invoker to 
-- definer security. This allows anon to read the view
-- without needing permissions on base tables.
--
-- Maintains exact 26-column contract and all existing logic.
-- =========================================================

BEGIN;

-- =========================================
-- DROP AND RECREATE AS DEFINER VIEW
-- =========================================

DROP VIEW IF EXISTS public.public_v_home_news CASCADE;

-- Create as definer view (security_invoker = false, with security_barrier for extra safety)
CREATE VIEW public.public_v_home_news 
WITH (security_invoker = false, security_barrier = true) AS
WITH cfg AS (
  -- Read configuration from system_meta with defaults
  SELECT
    COALESCE((SELECT value::int FROM system_meta WHERE key='home_limit'), 20) AS home_limit,
    COALESCE((SELECT value::int FROM system_meta WHERE key='top3_max'), 3) AS top3_max
),

-- Get latest snapshot per story
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

-- Join news_trends with stories and latest snapshots
snapshot_items AS (
  SELECT
    nt.*,
    ls.snapshot_date,
    ls.snap_view_count,
    ls.snap_like_count,
    ls.snap_comment_count,
    ls.snap_popularity_score,
    ls.snap_growth_rate,
    -- Use snapshot data if available, otherwise fall back to news_trends
    COALESCE(ls.snap_popularity_score, nt.popularity_score, 0) AS effective_popularity_score,
    COALESCE(ls.snap_view_count, nt.view_count) AS effective_view_count,
    COALESCE(ls.snap_growth_rate, nt.growth_rate) AS effective_growth_rate
  FROM news_trends nt
  LEFT JOIN stories st ON st.source_id = COALESCE(nt.video_id, nt.external_id)
  LEFT JOIN latest_snapshots ls ON ls.story_id = st.story_id
  WHERE nt.title IS NOT NULL 
    AND nt.title != ''
),

-- Apply snapshot-based freshness filter
filtered_items AS (
  -- Primary: stories with snapshots in last 72 hours
  SELECT * FROM snapshot_items
  WHERE snapshot_date >= (NOW() AT TIME ZONE 'Asia/Bangkok' - INTERVAL '72 hours')
  
  UNION ALL
  
  -- Fallback: if no items in 72h, get stories with snapshots in last 30 days
  SELECT * FROM snapshot_items
  WHERE NOT EXISTS (
    SELECT 1 FROM snapshot_items 
    WHERE snapshot_date >= (NOW() AT TIME ZONE 'Asia/Bangkok' - INTERVAL '72 hours')
  )
  AND snapshot_date >= (NOW() AT TIME ZONE 'Asia/Bangkok' - INTERVAL '30 days')
),

-- Rank items by popularity (using snapshot data when available)
ranked AS (
  SELECT
    fi.*,
    -- Deterministic ranking using effective scores
    DENSE_RANK() OVER (
      ORDER BY 
        fi.effective_popularity_score DESC,
        COALESCE(
          CASE 
            WHEN fi.effective_view_count ~ '^[0-9]+$' THEN fi.effective_view_count::bigint
            ELSE 0
          END, 0
        ) DESC,
        fi.snapshot_date DESC NULLS LAST,
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
),

-- Join with AI images bridge view (NOT base table)
final_with_images AS (
  SELECT
    fs.*,
    ai_v.image_url AS ai_image_url_alt
  FROM final_selection fs
  LEFT JOIN LATERAL (
    SELECT v.image_url
    FROM public.public_v_ai_images_latest v
    WHERE v.news_id = fs.id
    LIMIT 1
  ) ai_v ON TRUE
)

SELECT
  -- All 26 columns expected by mapNews.ts (exact order matters)
  
  -- 1. id
  fw.id::text AS id,
  
  -- 2. title
  fw.title::text AS title,
  
  -- 3. summary
  fw.summary::text AS summary,
  
  -- 4. summary_en
  COALESCE(fw.summary_en, fw.summary)::text AS summary_en,
  
  -- 5. category
  fw.category::text AS category,
  
  -- 6. platform
  COALESCE(fw.platform, 
    CASE 
      WHEN fw.video_id IS NOT NULL OR fw.external_id LIKE 'YT%' THEN 'YouTube'
      WHEN fw.external_id LIKE 'TT%' THEN 'TikTok'
      WHEN fw.external_id LIKE 'IG%' THEN 'Instagram'
      WHEN fw.external_id LIKE 'FB%' THEN 'Facebook'
      WHEN fw.external_id LIKE 'X%' OR fw.external_id LIKE 'TW%' THEN 'X'
      ELSE 'Social'
    END
  )::text AS platform,
  
  -- 7. channel
  fw.channel::text AS channel,
  
  -- 8. published_at
  COALESCE(fw.published_at, fw.published_date, fw.updated_at)::timestamptz AS published_at,
  
  -- 9. source_url (NEVER NULL)
  COALESCE(
    NULLIF(fw.source_url, ''),
    CASE 
      WHEN fw.video_id IS NOT NULL AND fw.video_id != '' 
      THEN 'https://www.youtube.com/watch?v=' || fw.video_id
      WHEN fw.external_id IS NOT NULL AND fw.external_id != '' 
      THEN 'https://www.youtube.com/watch?v=' || fw.external_id
      ELSE 'https://trendsiam.com/story/' || fw.id
    END
  )::text AS source_url,
  
  -- 10. image_url (NULL except for Top-3, COALESCE with bridge view)
  CASE 
    WHEN fw.is_top3 THEN COALESCE(fw.ai_image_url_alt, fw.ai_image_url)
    ELSE NULL
  END::text AS image_url,
  
  -- 11. ai_prompt (NULL except for Top-3)
  CASE 
    WHEN fw.is_top3 THEN fw.ai_image_prompt
    ELSE NULL
  END::text AS ai_prompt,
  
  -- 12. popularity_score (from snapshot when available)
  fw.effective_popularity_score::numeric AS popularity_score,
  
  -- 13. rank
  fw.rank::integer AS rank,
  
  -- 14. is_top3
  fw.is_top3::boolean AS is_top3,
  
  -- 15. views (from snapshot when available)
  COALESCE(
    CASE 
      WHEN fw.snap_view_count ~ '^[0-9]+$' THEN fw.snap_view_count::bigint
      WHEN fw.snap_view_count IS NOT NULL THEN NULLIF(regexp_replace(fw.snap_view_count, '[^0-9]', '', 'g'), '')::bigint
      WHEN fw.view_count ~ '^[0-9]+$' THEN fw.view_count::bigint
      ELSE NULLIF(regexp_replace(COALESCE(fw.view_count, '0'), '[^0-9]', '', 'g'), '')::bigint
    END,
    0
  )::bigint AS views,
  
  -- 16. likes (from snapshot when available)
  COALESCE(
    CASE 
      WHEN fw.snap_like_count ~ '^[0-9]+$' THEN fw.snap_like_count::bigint
      WHEN fw.snap_like_count IS NOT NULL THEN NULLIF(regexp_replace(fw.snap_like_count, '[^0-9]', '', 'g'), '')::bigint
      WHEN fw.like_count ~ '^[0-9]+$' THEN fw.like_count::bigint
      ELSE NULLIF(regexp_replace(COALESCE(fw.like_count, '0'), '[^0-9]', '', 'g'), '')::bigint
    END,
    0
  )::bigint AS likes,
  
  -- 17. comments (from snapshot when available)
  COALESCE(
    CASE 
      WHEN fw.snap_comment_count ~ '^[0-9]+$' THEN fw.snap_comment_count::bigint
      WHEN fw.snap_comment_count IS NOT NULL THEN NULLIF(regexp_replace(fw.snap_comment_count, '[^0-9]', '', 'g'), '')::bigint
      WHEN fw.comment_count ~ '^[0-9]+$' THEN fw.comment_count::bigint
      ELSE NULLIF(regexp_replace(COALESCE(fw.comment_count, '0'), '[^0-9]', '', 'g'), '')::bigint
    END,
    0
  )::bigint AS comments,
  
  -- 18. growth_rate_value (safe numeric, from snapshot when available)
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
  fw.ai_opinion::text AS ai_opinion,
  
  -- 21. score_details
  CASE 
    WHEN fw.score_details IS NULL THEN NULL::jsonb
    WHEN fw.score_details::text = '' THEN NULL::jsonb
    WHEN jsonb_typeof(fw.score_details::jsonb) IS NOT NULL THEN fw.score_details::jsonb
    ELSE NULL::jsonb
  END AS score_details,
  
  -- Additional columns expected by mapNews.ts:
  
  -- 22. video_id
  fw.video_id::text AS video_id,
  
  -- 23. external_id
  fw.external_id::text AS external_id,
  
  -- 24. platform_mentions
  fw.platform_mentions::integer AS platform_mentions,
  
  -- 25. keywords
  fw.keywords::text AS keywords,
  
  -- 26. updated_at
  fw.updated_at::timestamptz AS updated_at

FROM final_with_images fw
CROSS JOIN LATERAL (
  SELECT
    NULLIF(
      regexp_replace(
        COALESCE(fw.effective_growth_rate::text, ''),
        '[^0-9.\-]+',      -- strip anything not digit/dot/minus
        '',
        'g'
      ),
      ''
    )::numeric AS gr_num
) gr
ORDER BY fw.rank ASC, fw.id ASC;

-- =========================================
-- SET PERMISSIONS
-- =========================================

-- Grant read access following Plan-B security model
GRANT SELECT ON public.public_v_home_news TO anon;
GRANT SELECT ON public.public_v_home_news TO authenticated;
GRANT SELECT ON public.public_v_home_news TO service_role;

-- =========================================
-- DOCUMENTATION
-- =========================================

COMMENT ON VIEW public.public_v_home_news IS 
'Home page news view with 26-column contract expected by mapNews.ts. 
Security: DEFINER view (not invoker) - anon can read without base table permissions.
Implements: snapshot-based freshness (72h primary, 30d fallback), 
latest snapshot per story determines inclusion and metrics,
Top-3 image/prompt policy enforced at view layer, 
deterministic ranking preserved, Plan-B security model,
safe numeric parsing for growth_rate field, and
bridge view join for ai_images (no direct base table access).
Updated: 2025-09-23 - Changed to definer security model';

-- =========================================
-- VERIFICATION
-- =========================================

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
END $$;

COMMIT;
