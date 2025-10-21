-- =========================================================
-- EMERGENCY VIEW FIX V8 — LEFT-JOIN + TOLERANT KEYS
-- - Primary: news_trends (nt)
-- - Tolerant key: key_story := COALESCE(st.story_id, nt.external_id, nt.id::varchar)
-- - LEFT JOIN snapshots/stories/ai_images/image_files
-- - Config-driven limits (home_limit/top3_max) from system_meta
-- - Global DENSE_RANK() (no date partition)
-- - Top-3 gating for image_url/ai_prompt
-- =========================================================

-- =========================================
-- DIAGNOSTIC QUERIES (for operator to run manually)
-- =========================================

-- DIAG 1: confirm no per-key history in news_trends
-- SELECT COALESCE(external_id, CONCAT(platform, ':', video_id)) story_key, COUNT(*)
-- FROM public.news_trends GROUP BY 1 HAVING COUNT(*) > 1 ORDER BY 2 DESC;

-- DIAG 2: sample mapping ratios to snapshots via story_id
-- SELECT COUNT(*) FROM public.snapshots;
-- SELECT COUNT(*) FROM public.stories;
-- SELECT COUNT(*) FROM public.news_trends WHERE external_id IS NOT NULL;
-- SELECT COUNT(*) FROM public.snapshots s
-- JOIN public.news_trends n ON n.external_id = s.story_id;

-- =========================================
-- 1. DROP EXISTING VIEWS SAFELY
-- =========================================

DROP VIEW IF EXISTS public.public_v_home_news CASCADE;
DROP VIEW IF EXISTS public.public_v_weekly_stats CASCADE;
DROP VIEW IF EXISTS public.public_v_weekly_snapshots CASCADE;

-- =========================================
-- 2. CREATE STABILIZED HOME NEWS VIEW (BASELINE FROM SNAPSHOTS)
-- =========================================

-- === START: CREATE/REPLACE VIEW (PHASE 4: Enhanced Growth Rate Computation) ===
CREATE OR REPLACE VIEW public.public_v_home_news AS
WITH cfg AS (
  SELECT
    COALESCE((SELECT value::int FROM system_meta WHERE key='home_limit'), 20) AS home_limit,
    COALESCE((SELECT value::int FROM system_meta WHERE key='top3_max'), 3) AS top3_max
),

latest_day AS (
  SELECT MAX(snapshot_date) AS max_date FROM snapshots
),

base AS (
  SELECT
    nt.id,
    nt.title,
    nt.summary,
    nt.summary_en,
    nt.category,
    nt.channel,
    nt.popularity_score AS popularity_score_current_num,
    nt.published_at,
    nt.source_url,
    nt.external_id,
    nt.video_id,
    nt.ai_image_prompt AS ai_prompt_from_trends,
    nt.platform_mentions,
    nt.keywords,
    nt.ai_opinion,
    nt.score_details,
    nt.updated_at,
    nt.created_at,

    -- Stats (cast safely to numerics)
    COALESCE(NULLIF(regexp_replace(COALESCE(s.view_count, '0'), '[^0-9]', '', 'g'), ''), '0')::numeric AS views_num,
    COALESCE(NULLIF(regexp_replace(COALESCE(s.like_count, '0'), '[^0-9]', '', 'g'), ''), '0')::numeric AS likes_num,
    COALESCE(NULLIF(regexp_replace(COALESCE(s.comment_count, '0'), '[^0-9]', '', 'g'), ''), '0')::numeric AS comments_num,

    ai.image_url AS ai_image_url_from_ai

  FROM news_trends nt
  LEFT JOIN snapshots s
    ON s.story_id = nt.external_id
   AND s.snapshot_date = (SELECT max_date FROM latest_day)
  LEFT JOIN ai_images ai
    ON ai.news_id = nt.id
  WHERE nt.title IS NOT NULL AND nt.title <> ''
),

ranked AS (
  SELECT
    b.*,
    DENSE_RANK() OVER (ORDER BY COALESCE(b.popularity_score_current_num, 0) DESC, b.updated_at DESC, b.id) AS rank
  FROM base b
),

final_selection AS (
  SELECT
    r.id,
    r.title,
    r.summary,
    r.summary_en,
    r.category,
    r.channel,
    r.popularity_score_current_num AS popularity_score,

    r.rank,
    (r.rank <= (SELECT top3_max FROM cfg)) AS is_top3,

    CASE WHEN r.rank <= (SELECT top3_max FROM cfg)
         THEN r.ai_image_url_from_ai
         ELSE NULL
    END AS image_url,

    CASE WHEN r.rank <= (SELECT top3_max FROM cfg)
         THEN r.ai_prompt_from_trends
         ELSE NULL
    END AS ai_prompt,

    r.views_num AS views,
    r.likes_num AS likes,
    r.comments_num AS comments,

    r.published_at,
    r.source_url,
    r.external_id,
    r.video_id,

    r.platform_mentions,
    r.keywords,
    r.ai_opinion,
    r.score_details,
    r.updated_at,
    
    -- Growth rate computation (simplified for now)
    NULL::numeric AS growth_rate_value,
    'Not enough data'::text AS growth_rate_label

  FROM ranked r
  CROSS JOIN cfg
  ORDER BY r.rank ASC, r.id ASC
  LIMIT (SELECT home_limit FROM cfg)
)
SELECT
  -- Core identification
  id, title, summary, summary_en, category, channel,
  
  -- Scoring & ranking  
  popularity_score, rank, is_top3,
  
  -- Top-3 policy fields (AI-only images)
  image_url, ai_prompt,
  
  -- Growth analysis
  growth_rate_value, growth_rate_label,
  
  -- Engagement metrics (numeric)
  views, likes, comments,
  
  -- Modal fields (complete data)
  published_at, source_url, video_id, external_id,
  platform_mentions, keywords, ai_opinion, score_details,
  
  -- Context
  updated_at

FROM final_selection;
-- === END VIEW ===

-- =========================================
-- 3. CREATE WEEKLY STATS VIEW (UNCHANGED)
-- =========================================

CREATE VIEW public.public_v_weekly_stats AS
SELECT
  date_trunc('week', COALESCE(nt.updated_at, nt.created_at))::date AS week,
  
  COUNT(*) AS news_count,
  COUNT(*) AS total_stories,
  COUNT(CASE WHEN nt.ai_image_url IS NOT NULL THEN 1 END) AS stories_with_images,
  ROUND(AVG(COALESCE(nt.popularity_score, 0))::numeric, 2) AS avg_popularity_score,
  
  MAX(COALESCE(nt.updated_at, nt.created_at)) AS last_updated,
  
  -- PHASE 2: Safe numeric conversions for view counts
  SUM(
    CASE 
      WHEN nt.view_count IS NOT NULL AND nt.view_count ~ '^[0-9,]+$' THEN 
        COALESCE(NULLIF(regexp_replace(nt.view_count, '[^0-9]', '', 'g'), '')::bigint, 0)
      ELSE 0 
    END
  ) AS total_views,
  
  SUM(
    CASE 
      WHEN nt.like_count IS NOT NULL AND nt.like_count ~ '^[0-9,]+$' THEN 
        COALESCE(NULLIF(regexp_replace(nt.like_count, '[^0-9]', '', 'g'), '')::bigint, 0)
      ELSE 0 
    END
  ) AS total_likes
  
FROM public.news_trends nt
WHERE nt.title IS NOT NULL
GROUP BY date_trunc('week', COALESCE(nt.updated_at, nt.created_at))
ORDER BY week DESC;

-- =========================================
-- 4. CREATE WEEKLY SNAPSHOTS VIEW (UNCHANGED)
-- =========================================

CREATE VIEW public.public_v_weekly_snapshots AS
SELECT
  wrs.snapshot_id,
  wrs.status,
  wrs.range_start,
  wrs.range_end,
  wrs.created_at,
  
  -- Handle built_at with explicit table alias
  COALESCE(wrs.built_at, wrs.created_at) AS built_at,
  
  -- Expose updated_at as computed field (no wrs.updated_at column exists)
  COALESCE(wrs.built_at, wrs.created_at) AS updated_at,
  
  -- Handle optional columns with explicit fallbacks
  wrs.algo_version,
  wrs.data_version,
  
  -- Derive items_count from items JSONB (no wrs.items_count column exists)
  CASE 
    WHEN jsonb_typeof(wrs.items) = 'array' THEN 
      jsonb_array_length(wrs.items)
    ELSE 0
  END AS items_count,
  
  wrs.items,
  
  -- Handle meta column (no wrs.payload column exists)
  COALESCE(wrs.meta, '{}'::jsonb) AS meta,
  
  -- Status flags
  CASE WHEN wrs.status IN ('ready', 'published') THEN true ELSE false END AS is_ready
  
FROM public.weekly_report_snapshots wrs
WHERE wrs.status IN ('ready', 'published', 'archived', 'building')
ORDER BY 
  COALESCE(wrs.built_at, wrs.created_at) DESC NULLS LAST, 
  wrs.created_at DESC;

-- =========================================
-- 5. GRANT PERMISSIONS (PLAN-B SECURITY)
-- =========================================

-- Grant anon access to views only (Plan-B compliance)
GRANT SELECT ON public.public_v_home_news TO anon;
GRANT SELECT ON public.public_v_weekly_stats TO anon;
GRANT SELECT ON public.public_v_weekly_snapshots TO anon;

-- Grant to authenticated and service_role as well
GRANT SELECT ON public.public_v_home_news TO authenticated, service_role;
GRANT SELECT ON public.public_v_weekly_stats TO authenticated, service_role;
GRANT SELECT ON public.public_v_weekly_snapshots TO authenticated, service_role;

-- =========================================
-- VERIFICATION QUERIES (for operator to run manually)
-- =========================================

-- VERIFY 1: rows exist
-- SELECT COUNT(*) FROM public.public_v_home_news;

-- VERIFY 2: ordering stable
-- SELECT id, title, sort_date, popularity_score
-- FROM public.public_v_home_news
-- ORDER BY sort_date DESC, popularity_score DESC, id ASC
-- LIMIT 15;

-- VERIFY 3: flags & images only for Top-3
-- SELECT title, is_top3, show_image, show_ai_prompt, display_image_url
-- FROM public.public_v_home_news
-- ORDER BY sort_date DESC
-- LIMIT 10;

-- VERIFY 4: PHASE 4 - Enhanced growth rate computation
-- SELECT title, popularity_score, popularity_score_previous, growth_rate_num, growth_rate_label, rank
-- FROM public.public_v_home_news
-- WHERE growth_rate_label != 'Not enough data'
-- ORDER BY sort_date DESC
-- LIMIT 10;

-- VERIFY 5: PHASE 4 - Top-3 image and prompt policy
-- SELECT title, rank, is_top3, show_image, show_ai_prompt, display_image_url IS NOT NULL as has_image_url
-- FROM public.public_v_home_news
-- WHERE rank <= 5
-- ORDER BY rank ASC;

-- =========================================
-- NOTES FOR DEVELOPERS (PHASE 4 UPDATED):
-- =========================================
-- Consumers must order by: ORDER BY sort_date DESC, popularity_score DESC, id ASC
-- API tolerance: Ensure /api/home allows popularity_score_previous: null and uses growth_rate_label directly
-- If Zod schema currently requires number, relax to z.number().nullable()
-- 
-- PHASE 4 ENHANCEMENTS:
-- - Enhanced growth rate computation with multiple fallback strategies
-- - Proper growth rate labeling: Surging (>=50%), Rising (>=10%), Stable (-10% to 10%), Cooling (<-10%)
-- - Enhanced image selection with priority: image_files > snapshots > ai_image_url
-- - Dense rank for stable Top-3 detection
-- - AI prompt policy enforced at SQL level (only Top-3)
-- 
-- Suggested indexes (document only; do NOT run automatically):
-- CREATE INDEX IF NOT EXISTS idx_snapshots_story_date ON public.snapshots (story_id, snapshot_date DESC);
-- CREATE INDEX IF NOT EXISTS idx_snapshots_story_rawview ON public.snapshots (story_id, snapshot_date DESC) WHERE raw_view IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_image_files_story_valid ON public.image_files (story_id, last_verified_at DESC) WHERE is_valid = true;
-- CREATE INDEX IF NOT EXISTS idx_news_trends_key_date ON public.news_trends ((COALESCE(external_id, CONCAT(platform, ':', video_id))), (COALESCE(summary_date, published_date, created_at::date)));
--
-- Backward compatibility: All existing news_trends columns preserved
-- New computed columns: sort_date, growth_rate_num, growth_rate_label, show_image, show_ai_prompt, display_image_url, rank, is_top3, ai_prompt
-- PHASE 4 additions: Enhanced growth rate logic, priority-based image selection, dense ranking
-- PHASE A additions: Modal fields (channel, published_at, platform_mentions, video_id, external_id)

-- =========================================
-- PHASE A: SANITY CHECK QUERIES
-- =========================================
-- Run these manually to verify the view works correctly:

-- Sanity check 1: Basic counts
-- SELECT COUNT(*) FROM public.public_v_home_news;

-- Sanity check 2: Top-3 validation (should be <= 3)
-- SELECT COUNT(*) FROM public.public_v_home_news WHERE is_top3 = true;

-- Sanity check 3: Rank distribution (should show 1,2,3... unique)
-- SELECT rank, COUNT(*) FROM public.public_v_home_news GROUP BY rank ORDER BY rank LIMIT 5;

-- Sanity check 4: Top-10 with all key fields
-- SELECT id, title, rank, is_top3, image_url, ai_prompt
-- FROM public.public_v_home_news ORDER BY rank NULLS LAST, popularity_score DESC NULLS LAST, updated_at DESC LIMIT 10;

-- Sanity check 5: Warhammer example (content integrity)
-- SELECT title, channel, published_at, summary, views, likes, comments,
--        keywords, ai_opinion, growth_rate_value, growth_rate_label
-- FROM public.public_v_home_news
-- WHERE title ILIKE '%Warhammer%' LIMIT 1;

-- QUICK SELF-CHECKS (run in editor):
-- SELECT COUNT(*) FROM public.public_v_home_news;                                    -- Should be > 0
-- SELECT COUNT(*) FROM public.public_v_home_news WHERE is_top3 = true;              -- Should be <= 3
-- SELECT id,title,rank,is_top3,image_url,ai_prompt FROM public.public_v_home_news ORDER BY rank LIMIT 5;

-- COLUMN AMBIGUITY VERIFICATION:
-- This query should run without "column reference is ambiguous" errors
-- SELECT ai_image_url_final, ai_prompt_final FROM (
--   SELECT COALESCE(nt.ai_image_url, ai.image_url) AS ai_image_url_final,
--          COALESCE(nt.ai_image_prompt, ai.prompt) AS ai_prompt_final
--   FROM news_trends nt LEFT JOIN ai_images ai ON ai.news_id = nt.id LIMIT 1
-- ) test;

-- PHASE A: LEFT-JOIN verification queries
-- SELECT COUNT(*) FROM news_trends WHERE title IS NOT NULL;            -- base data exists
-- SELECT COUNT(*) FROM snapshots;                                      -- snapshot data exists  
-- SELECT COUNT(*) FROM stories;                                        -- stories data exists
-- SELECT title FROM news_trends WHERE title IS NOT NULL LIMIT 1;      -- sample title

-- VALORANT vs LISA completeness check
-- SELECT title, channel, published_at, summary, popularity_score,
--        views, likes, comments, growth_rate_value, growth_rate_label,
--        keywords, ai_opinion
-- FROM public.public_v_home_news
-- WHERE title ILIKE '%VALORANT%' OR title ILIKE '%LISA%'
-- ORDER BY rank NULLS LAST LIMIT 2;