-- =========================================================
-- EMERGENCY VIEW FIX V4 — COMPLETE HOME FLOW FIX
-- Fixed joins and correct column references
-- Day-scoped ranking with Asia/Bangkok timezone
-- Guarantees non-NULL source_url for every row
-- Top-3 policy for image_url/ai_prompt
-- Config-driven limits from system_meta
-- 
-- IMPORTANT: All columns referenced here MUST exist in schema inventory
-- Run 'npm run db:guard' before applying any changes
-- Only use columns listed in memory-bank/db_schema_inventory.mb
-- 
-- WARNING: Do NOT introduce thumbnail fields (thumbnail_url, youtube_thumbnail_url)
-- TrendSiam uses AI-generated images for Top-3 items ONLY
-- Non-Top-3 items have NO images whatsoever
-- =========================================================

-- =========================================
-- 1. DROP EXISTING VIEWS SAFELY
-- =========================================

DROP VIEW IF EXISTS public.public_v_home_news CASCADE;
DROP VIEW IF EXISTS public.public_v_weekly_stats CASCADE;
DROP VIEW IF EXISTS public.public_v_weekly_snapshots CASCADE;

-- =========================================
-- 2. CREATE CONTRACT-COMPLIANT HOME NEWS VIEW
-- =========================================

CREATE OR REPLACE VIEW public.public_v_home_news AS
WITH cfg AS (
  SELECT
    COALESCE((SELECT value::int FROM system_meta WHERE key='home_limit'), 20) AS home_limit,
    COALESCE((SELECT value::int FROM system_meta WHERE key='top3_max'), 3) AS top3_max
),

-- Get current Thai date for day-scoped ranking
current_thai_day AS (
  SELECT (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok')::date AS today
),

-- Get latest snapshot date for metrics
latest_snapshot AS (
  SELECT MAX(snapshot_date) AS max_date FROM snapshots
),

base AS (
  SELECT
    -- Identifiers
    nt.id::text AS id,
    
    -- Content fields (prefer stories for canonical data)
    COALESCE(st.title, nt.title)::text AS title,
    COALESCE(st.summary, nt.summary)::text AS summary,
    COALESCE(st.summary_en, nt.summary_en, st.summary, nt.summary)::text AS summary_en,
    
    -- Metadata (prefer stories for canonical data)
    COALESCE(st.category, nt.category)::text AS category,
    COALESCE(st.platform, nt.platform, 
      CASE 
        WHEN nt.video_id IS NOT NULL OR nt.external_id LIKE 'YT%' THEN 'YouTube'
        WHEN nt.external_id LIKE 'TT%' THEN 'TikTok'
        WHEN nt.external_id LIKE 'IG%' THEN 'Instagram'
        WHEN nt.external_id LIKE 'FB%' THEN 'Facebook'
        WHEN nt.external_id LIKE 'X%' OR nt.external_id LIKE 'TW%' THEN 'X'
        ELSE 'Social'
      END
    )::text AS platform,
    COALESCE(st.channel, nt.channel)::text AS channel,
    
    -- Timestamps
    COALESCE(st.publish_time, nt.published_at, nt.published_date)::timestamptz AS published_at,
    
    -- Construct source_url - NEVER NULL
    CASE
      WHEN nt.source_url IS NOT NULL AND nt.source_url != '' THEN nt.source_url
      WHEN st.source_id IS NOT NULL AND st.source_id != '' THEN 'https://www.youtube.com/watch?v=' || st.source_id
      WHEN nt.video_id IS NOT NULL AND nt.video_id != '' THEN 'https://www.youtube.com/watch?v=' || nt.video_id
      WHEN nt.external_id IS NOT NULL AND nt.external_id != '' THEN 'https://www.youtube.com/watch?v=' || nt.external_id
      ELSE NULL -- Will filter out in WHERE clause
    END::text AS source_url,
    
    -- Scores and ranking
    COALESCE(sn.popularity_score, nt.popularity_score, 0)::numeric AS popularity_score,
    
    -- Metrics from snapshots (prefer latest snapshot)
    COALESCE(
      CASE 
        WHEN sn.view_count ~ '^[0-9]+$' THEN sn.view_count::bigint
        ELSE NULLIF(regexp_replace(COALESCE(sn.view_count, '0'), '[^0-9]', '', 'g'), '')::bigint
      END,
      CASE
        WHEN nt.view_count ~ '^[0-9]+$' THEN nt.view_count::bigint
        ELSE NULLIF(regexp_replace(COALESCE(nt.view_count, '0'), '[^0-9]', '', 'g'), '')::bigint
      END,
      0
    )::bigint AS views,
    
    COALESCE(
      CASE 
        WHEN sn.like_count ~ '^[0-9]+$' THEN sn.like_count::bigint
        ELSE NULLIF(regexp_replace(COALESCE(sn.like_count, '0'), '[^0-9]', '', 'g'), '')::bigint
      END,
      CASE
        WHEN nt.like_count ~ '^[0-9]+$' THEN nt.like_count::bigint
        ELSE NULLIF(regexp_replace(COALESCE(nt.like_count, '0'), '[^0-9]', '', 'g'), '')::bigint
      END,
      0
    )::bigint AS likes,
    
    COALESCE(
      CASE 
        WHEN sn.comment_count ~ '^[0-9]+$' THEN sn.comment_count::bigint
        ELSE NULLIF(regexp_replace(COALESCE(sn.comment_count, '0'), '[^0-9]', '', 'g'), '')::bigint
      END,
      CASE
        WHEN nt.comment_count ~ '^[0-9]+$' THEN nt.comment_count::bigint
        ELSE NULLIF(regexp_replace(COALESCE(nt.comment_count, '0'), '[^0-9]', '', 'g'), '')::bigint
      END,
      0
    )::bigint AS comments,
    
    -- Growth rate
    COALESCE(sn.growth_rate, nt.growth_rate)::numeric AS growth_rate_value,
    
    -- AI fields (will be gated by Top-3 policy)
    COALESCE(
      img.file_path,
      ai.image_url,
      nt.ai_image_url
    ) AS image_url_raw,
    
    COALESCE(
      st.ai_image_prompt,
      ai.prompt,
      nt.ai_image_prompt
    ) AS ai_prompt_raw,
    
    -- Additional fields
    nt.ai_opinion::text AS ai_opinion,
    
    -- Ensure score_details is valid JSONB
    CASE 
      WHEN nt.score_details IS NULL THEN NULL::jsonb
      WHEN nt.score_details::text = '' THEN NULL::jsonb
      WHEN jsonb_typeof(nt.score_details::jsonb) IS NOT NULL THEN nt.score_details::jsonb
      ELSE NULL::jsonb
    END AS score_details,
    
    -- Day for partitioning (Thai timezone)
    COALESCE(
      nt.summary_date,
      date_trunc('day', COALESCE(st.publish_time, nt.published_at, nt.published_date) AT TIME ZONE 'Asia/Bangkok')::date,
      date_trunc('day', nt.created_at AT TIME ZONE 'Asia/Bangkok')::date
    )::date AS ranking_day,
    
    nt.updated_at::timestamptz AS updated_at

  FROM news_trends nt
  
  -- Join to stories using platform ID (video_id or external_id)
  LEFT JOIN stories st 
    ON st.source_id = COALESCE(nt.video_id, nt.external_id)
  
  -- Join to snapshots through stories
  LEFT JOIN snapshots sn 
    ON sn.story_id = st.story_id 
    AND sn.snapshot_date = (SELECT max_date FROM latest_snapshot)
  
  -- Join to ai_images through news_trends.id
  LEFT JOIN ai_images ai 
    ON ai.news_id = nt.id
  
  -- Join to image_files through stories
  LEFT JOIN image_files img 
    ON img.story_id = st.story_id 
    AND img.is_valid = true
  
  WHERE nt.title IS NOT NULL 
    AND nt.title != ''
),

-- Day-scoped ranking
ranked AS (
  SELECT
    b.*,
    -- Rank within current Thai day
    DENSE_RANK() OVER (
      PARTITION BY b.ranking_day
      ORDER BY b.popularity_score DESC, 
               b.updated_at DESC, 
               b.id
    ) AS rank
  FROM base b
  CROSS JOIN current_thai_day
  -- Only include items from current Thai day
  WHERE b.ranking_day = current_thai_day.today
    AND b.source_url IS NOT NULL -- Ensure source_url is never NULL
),

-- Apply Top-3 policy and final selection
final_selection AS (
  SELECT
    r.id::text,
    r.title::text,
    r.summary::text,
    r.summary_en::text,
    r.category::text,
    r.platform::text,
    r.channel::text,
    r.published_at::timestamptz,
    r.source_url::text,  -- guaranteed non-NULL
    
    -- Top-3 policy: images and prompts only for top 3
    CASE 
      WHEN r.rank <= (SELECT top3_max FROM cfg) 
      THEN r.image_url_raw::text
      ELSE NULL::text
    END AS image_url,
    
    CASE 
      WHEN r.rank <= (SELECT top3_max FROM cfg) 
      THEN r.ai_prompt_raw::text
      ELSE NULL::text
    END AS ai_prompt,
    
    r.popularity_score::numeric,
    r.rank::integer,
    (r.rank <= (SELECT top3_max FROM cfg))::boolean AS is_top3,
    
    r.views::bigint,
    r.likes::bigint,
    r.comments::bigint,
    
    r.growth_rate_value::numeric,
    
    -- Growth rate label
    CASE
      WHEN r.growth_rate_value IS NULL THEN 'Not enough data'
      WHEN r.growth_rate_value >= 50 THEN 'Surging'
      WHEN r.growth_rate_value >= 10 THEN 'Rising'
      WHEN r.growth_rate_value >= -10 THEN 'Stable'
      ELSE 'Cooling'
    END::text AS growth_rate_label,
    
    r.ai_opinion::text,
    r.score_details::jsonb

  FROM ranked r
  CROSS JOIN cfg
  ORDER BY r.rank ASC, r.id ASC
  LIMIT (SELECT home_limit FROM cfg)
)
SELECT
  -- Exact contract fields (snake_case)
  id,
  title,
  summary,
  summary_en,
  category,
  platform,
  channel,
  published_at,
  source_url,  -- NEVER NULL
  image_url,   -- NULL except for Top-3
  ai_prompt,   -- NULL except for Top-3
  popularity_score,
  rank,
  is_top3,
  views,
  likes,
  comments,
  growth_rate_value,
  growth_rate_label,
  ai_opinion,
  score_details  -- Valid JSONB
FROM final_selection;

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
  
  -- Safe numeric conversions for view counts
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
  
  COALESCE(wrs.built_at, wrs.created_at) AS built_at,
  COALESCE(wrs.built_at, wrs.created_at) AS updated_at,
  
  wrs.algo_version,
  wrs.data_version,
  
  CASE 
    WHEN jsonb_typeof(wrs.items) = 'array' THEN 
      jsonb_array_length(wrs.items)
    ELSE 0
  END AS items_count,
  
  wrs.items,
  COALESCE(wrs.meta, '{}'::jsonb) AS meta,
  
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
-- SQL SELF-CHECKS (Run these manually)
-- =========================================

/*
-- CHECK 1: Verify expected columns exist
SELECT column_name 
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'public_v_home_news' 
ORDER BY ordinal_position;

-- Expected: id, title, summary, summary_en, category, platform, channel, 
-- published_at, source_url, image_url, ai_prompt, popularity_score,
-- rank, is_top3, views, likes, comments, growth_rate_value, 
-- growth_rate_label, ai_opinion, score_details
*/

/*
-- CHECK 2: Verify counts and constraints
SELECT 
  COUNT(*) AS total,
  SUM(CASE WHEN is_top3 THEN 1 ELSE 0 END) AS top3_count,
  SUM(CASE WHEN source_url IS NULL THEN 1 ELSE 0 END) AS null_urls
FROM public.public_v_home_news;

-- Expected: null_urls = 0, top3_count <= configured top3_max
*/

/*
-- CHECK 3: Verify source URLs are valid
SELECT source_url
FROM public.public_v_home_news
WHERE source_url NOT LIKE 'https://www.youtube.com/watch?v=%'
  AND source_url NOT LIKE 'https://youtu.be/%'
LIMIT 5;

-- Expected: All URLs should be YouTube format
*/

/*
-- CHECK 4: Verify Top-3 gating policy
SELECT
  SUM(CASE WHEN is_top3 AND image_url IS NOT NULL AND ai_prompt IS NOT NULL THEN 1 ELSE 0 END) AS ok_top3,
  SUM(CASE WHEN NOT is_top3 AND (image_url IS NOT NULL OR ai_prompt IS NOT NULL) THEN 1 ELSE 0 END) AS leak_non_top3
FROM public.public_v_home_news;

-- Expected: leak_non_top3 = 0 (non-Top3 should never have images/prompts)
*/

/*
-- CHECK 5: Sample data with ranking
SELECT 
  rank,
  id,
  title,
  platform,
  source_url,
  is_top3,
  CASE WHEN image_url IS NOT NULL THEN '✓' ELSE '✗' END AS has_image,
  CASE WHEN ai_prompt IS NOT NULL THEN '✓' ELSE '✗' END AS has_prompt
FROM public.public_v_home_news
ORDER BY rank
LIMIT 10;
*/

/*
-- CHECK 6: Verify all required columns exist (should return 21 rows)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'public_v_home_news'
  AND column_name IN (
    'id', 'title', 'summary', 'summary_en', 'category', 'platform',
    'channel', 'published_at', 'source_url', 'image_url', 'ai_prompt',
    'popularity_score', 'rank', 'is_top3', 'views', 'likes', 'comments',
    'growth_rate_value', 'growth_rate_label', 'ai_opinion', 'score_details'
  );
-- Should return exactly 21 rows
*/

/*
-- CHECK 7: Verify join keys exist in base tables
SELECT 
  'news_trends' as table_name,
  COUNT(*) FILTER (WHERE column_name = 'id') as has_id,
  COUNT(*) FILTER (WHERE column_name = 'video_id') as has_video_id,
  COUNT(*) FILTER (WHERE column_name = 'external_id') as has_external_id
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'news_trends'
UNION ALL
SELECT 
  'stories' as table_name,
  COUNT(*) FILTER (WHERE column_name = 'story_id') as has_story_id,
  COUNT(*) FILTER (WHERE column_name = 'source_id') as has_source_id,
  0 as has_external_id
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'stories'
UNION ALL
SELECT 
  'ai_images' as table_name,
  COUNT(*) FILTER (WHERE column_name = 'news_id') as has_news_id,
  0 as has_video_id,
  0 as has_external_id
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ai_images';
*/

/*
-- CHECK 8: Verify exact column order (run this after creating the view)
SELECT string_agg(column_name, ',' ORDER BY ordinal_position) as columns
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'public_v_home_news';
-- Should return exactly:
-- id,title,summary,summary_en,category,platform,channel,published_at,source_url,image_url,ai_prompt,popularity_score,rank,is_top3,views,likes,comments,growth_rate_value,growth_rate_label,ai_opinion,score_details
*/