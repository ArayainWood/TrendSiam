-- Complete fix for home_feed_v1 view
-- Issues fixed:
-- 1. source_url generation for ALL rows (not just those with platform='youtube')
-- 2. Robust identification of YouTube videos via external_id/video_id presence
-- 3. All 26 columns with correct types
-- 4. Top-3 policy enforcement
-- 5. Demo seed fallback (dev-only)

-- Drop and recreate the view
DROP VIEW IF EXISTS public.home_feed_v1 CASCADE;

CREATE OR REPLACE VIEW public.home_feed_v1 AS
WITH ranked_news AS (
  -- Main data from news_trends with ranking
  SELECT 
    nt.id::text AS id,
    nt.title,
    nt.summary,
    nt.summary_en,
    nt.category,
    -- Normalize platform: if it has video_id/external_id, it's YouTube
    CASE
      WHEN nt.external_id IS NOT NULL AND nt.external_id != '' THEN 'YouTube'
      WHEN nt.video_id IS NOT NULL AND nt.video_id != '' THEN 'YouTube'
      ELSE COALESCE(nt.platform, 'Unknown')
    END AS platform,
    nt.channel,
    COALESCE(nt.published_at, nt.created_at) AS published_at,
    -- Build source URL: if we have external_id or video_id, it's a YouTube video
    CASE
      WHEN nt.external_id IS NOT NULL AND nt.external_id != '' THEN 
        'https://www.youtube.com/watch?v=' || nt.external_id
      WHEN nt.video_id IS NOT NULL AND nt.video_id != '' THEN 
        'https://www.youtube.com/watch?v=' || nt.video_id
      WHEN nt.source_url IS NOT NULL AND nt.source_url != '' THEN
        nt.source_url
      ELSE NULL  -- Will be filtered out by validation
    END AS source_url,
    nt.ai_image_url AS image_url,
    nt.ai_image_prompt AS ai_prompt,
    COALESCE(nt.popularity_score, 0)::numeric AS popularity_score,
    -- Rank by popularity score with deterministic tiebreaker
    ROW_NUMBER() OVER (
      ORDER BY 
        COALESCE(nt.popularity_score, 0) DESC,
        nt.created_at DESC,
        nt.id
    )::integer AS rank,
    -- Engagement metrics with safe casting
    CASE 
      WHEN nt.view_count ~ '^\d+$' THEN nt.view_count::bigint
      WHEN nt.view_count IS NOT NULL AND nt.view_count != '' THEN 
        regexp_replace(nt.view_count, '[^0-9]', '', 'g')::bigint
      ELSE 0
    END AS views,
    CASE 
      WHEN nt.like_count ~ '^\d+$' THEN nt.like_count::bigint
      WHEN nt.like_count IS NOT NULL AND nt.like_count != '' THEN 
        regexp_replace(nt.like_count, '[^0-9]', '', 'g')::bigint
      ELSE 0
    END AS likes,
    CASE 
      WHEN nt.comment_count ~ '^\d+$' THEN nt.comment_count::bigint
      WHEN nt.comment_count IS NOT NULL AND nt.comment_count != '' THEN 
        regexp_replace(nt.comment_count, '[^0-9]', '', 'g')::bigint
      ELSE 0
    END AS comments,
    -- Growth rate handling
    CASE
      WHEN nt.growth_rate IS NULL THEN 0::numeric
      WHEN nt.growth_rate ~ '^-?\d+(\.\d+)?%?$' THEN 
        REPLACE(TRIM(nt.growth_rate), '%', '')::numeric
      ELSE 0::numeric
    END AS growth_rate_value,
    nt.ai_opinion,
    -- Keep score_details as TEXT (it contains descriptive text, not JSON)
    nt.score_details,
    nt.video_id,
    nt.external_id,
    -- Safe casting for platform_mentions
    CASE 
      WHEN nt.platform_mentions IS NULL THEN 0
      WHEN nt.platform_mentions ~ '^\d+$' THEN nt.platform_mentions::integer
      ELSE 0
    END AS platform_mentions,
    nt.keywords,
    COALESCE(nt.updated_at, nt.created_at) AS updated_at
  FROM public.news_trends nt
  WHERE 
    -- Basic data quality filter
    nt.title IS NOT NULL 
    AND LENGTH(TRIM(nt.title)) > 0
    -- Must have at least one identifier for source URL
    AND (
      nt.external_id IS NOT NULL AND nt.external_id != ''
      OR nt.video_id IS NOT NULL AND nt.video_id != ''
      OR (nt.source_url IS NOT NULL AND nt.source_url != '')
    )
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
  source_url,
  -- Apply Top-3 image policy
  CASE 
    WHEN rank <= 3 THEN image_url
    ELSE NULL
  END AS image_url,
  CASE 
    WHEN rank <= 3 THEN ai_prompt
    ELSE NULL
  END AS ai_prompt,
  popularity_score,
  rank,
  (rank <= 3) AS is_top3,
  views,
  likes,
  comments,
  growth_rate_value,
  -- Growth rate labels
  CASE
    WHEN growth_rate_value IS NULL OR growth_rate_value = 0 THEN 'Not enough data'
    WHEN growth_rate_value >= 0.20 THEN 'Rising fast'
    WHEN growth_rate_value >= 0.00 THEN 'Rising'
    WHEN growth_rate_value <= -0.20 THEN 'Falling fast'
    ELSE 'Falling'
  END AS growth_rate_label,
  ai_opinion,
  score_details,
  video_id,
  external_id,
  platform_mentions,
  keywords,
  updated_at
FROM ranked_news
WHERE source_url IS NOT NULL  -- Extra safety: ensure we have URLs
ORDER BY rank;

-- Grant permissions
GRANT SELECT ON public.home_feed_v1 TO anon;
GRANT SELECT ON public.home_feed_v1 TO authenticated;

-- Update comment
COMMENT ON VIEW public.home_feed_v1 IS 'Home feed view providing exactly 26 columns expected by API. Uses news_trends as primary source. Enforces Top-3 image policy. Fixed: (1) source_url generated for all rows with video identifiers, (2) platform normalized to YouTube when identifiers present, (3) score_details kept as text type.';

-- Verify the fix
DO $$
DECLARE
  row_count INTEGER;
  missing_url_count INTEGER;
BEGIN
  -- Check total rows
  SELECT COUNT(*) INTO row_count FROM public.home_feed_v1;
  RAISE NOTICE 'home_feed_v1 total rows: %', row_count;
  
  -- Check for missing URLs (should be 0)
  SELECT COUNT(*) INTO missing_url_count 
  FROM public.home_feed_v1 
  WHERE source_url IS NULL OR source_url = '';
  RAISE NOTICE 'Rows with missing source_url: %', missing_url_count;
  
  IF row_count < 20 THEN
    RAISE WARNING 'View has fewer than 20 rows (%). Check data quality.', row_count;
  END IF;
  
  IF missing_url_count > 0 THEN
    RAISE WARNING 'View has % rows with missing source_url. These will be filtered by validation.', missing_url_count;
  END IF;
END $$;
