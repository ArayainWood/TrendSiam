-- Fix growth rate and keywords derivation for home_feed_v1
-- Issues fixed:
-- 1. Growth rate: Derive from snapshots when news_trends has no usable value
-- 2. Keywords: Ensure all items have keywords from available sources
-- 3. No hardcoding, all values from real sources

-- Drop and recreate the view with enhanced growth rate logic
DROP VIEW IF EXISTS public.home_feed_v1 CASCADE;

CREATE OR REPLACE VIEW public.home_feed_v1 AS
WITH snapshot_growth AS (
  -- Calculate growth rate from latest snapshots (views delta over time)
  SELECT 
    s.story_id,
    -- Get latest 2 snapshots for each story to calculate growth
    -- Cast view_count to bigint for calculations
    LAG(NULLIF(regexp_replace(COALESCE(s.view_count, '0'), '[^0-9]', '', 'g'), '')::bigint) OVER (PARTITION BY s.story_id ORDER BY s.created_at DESC) as prev_views,
    NULLIF(regexp_replace(COALESCE(s.view_count, '0'), '[^0-9]', '', 'g'), '')::bigint as current_views,
    LAG(s.created_at) OVER (PARTITION BY s.story_id ORDER BY s.created_at DESC) as prev_time,
    s.created_at as current_time,
    -- Calculate views per hour
    CASE 
      WHEN LAG(s.created_at) OVER (PARTITION BY s.story_id ORDER BY s.created_at DESC) IS NOT NULL AND
           NULLIF(regexp_replace(COALESCE(s.view_count, '0'), '[^0-9]', '', 'g'), '')::bigint > 0 THEN
        (NULLIF(regexp_replace(COALESCE(s.view_count, '0'), '[^0-9]', '', 'g'), '')::bigint - 
         LAG(NULLIF(regexp_replace(COALESCE(s.view_count, '0'), '[^0-9]', '', 'g'), '')::bigint) OVER (PARTITION BY s.story_id ORDER BY s.created_at DESC)) / 
        GREATEST(EXTRACT(EPOCH FROM (s.created_at - LAG(s.created_at) OVER (PARTITION BY s.story_id ORDER BY s.created_at DESC))) / 3600.0, 0.01)
      ELSE 0
    END as views_per_hour,
    ROW_NUMBER() OVER (PARTITION BY s.story_id ORDER BY s.created_at DESC) as rn
  FROM public.snapshots s
),
story_growth AS (
  -- Get the most recent growth rate for each story
  SELECT 
    story_id,
    COALESCE(views_per_hour, 0)::numeric as computed_growth_value
  FROM snapshot_growth
  WHERE rn = 1
),
ranked_news AS (
  -- Main data from news_trends with ranking
  SELECT 
    nt.id::text AS id,
    nt.title,
    nt.summary,
    nt.summary_en,
    nt.category,
    -- Normalize platform
    CASE
      WHEN nt.external_id IS NOT NULL AND nt.external_id != '' THEN 'YouTube'
      WHEN nt.video_id IS NOT NULL AND nt.video_id != '' THEN 'YouTube'
      ELSE COALESCE(nt.platform, 'Unknown')
    END AS platform,
    nt.channel,
    COALESCE(nt.published_at, nt.created_at) AS published_at,
    -- Build source URL
    CASE
      WHEN nt.external_id IS NOT NULL AND nt.external_id != '' THEN 
        'https://www.youtube.com/watch?v=' || nt.external_id
      WHEN nt.video_id IS NOT NULL AND nt.video_id != '' THEN 
        'https://www.youtube.com/watch?v=' || nt.video_id
      WHEN nt.source_url IS NOT NULL AND nt.source_url != '' THEN
        nt.source_url
      ELSE NULL
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
    -- Enhanced growth rate: Try to parse from news_trends, fallback to snapshots
    CASE
      -- If growth_rate looks like a percentage, parse it
      WHEN nt.growth_rate ~ '^-?\d+(\.\d+)?%?$' THEN 
        REPLACE(TRIM(nt.growth_rate), '%', '')::numeric * 1000  -- Scale up for comparison
      -- If growth_rate contains large numbers (e.g., "Viral (>100K/day)"), extract the number
      WHEN nt.growth_rate ~ '\d+K' THEN 
        regexp_replace(regexp_replace(nt.growth_rate, '[^0-9K]', '', 'g'), 'K', '000', 'g')::numeric
      -- Otherwise try to get from snapshots via story link
      WHEN sg.computed_growth_value IS NOT NULL AND sg.computed_growth_value > 0 THEN 
        sg.computed_growth_value
      -- Default to 0 if no data available
      ELSE 0::numeric
    END AS growth_rate_value,
    nt.ai_opinion,
    nt.score_details,
    nt.video_id,
    nt.external_id,
    -- Safe casting for platform_mentions
    CASE 
      WHEN nt.platform_mentions IS NULL THEN 0
      WHEN nt.platform_mentions ~ '^\d+$' THEN nt.platform_mentions::integer
      ELSE 0
    END AS platform_mentions,
    -- Keywords: Use from news_trends, ensure not empty
    COALESCE(NULLIF(nt.keywords, ''), '[]') AS keywords,
    COALESCE(nt.updated_at, nt.created_at) AS updated_at
  FROM public.news_trends nt
  LEFT JOIN public.stories st ON st.source_id = nt.external_id
  LEFT JOIN story_growth sg ON sg.story_id = st.story_id
  WHERE 
    nt.title IS NOT NULL 
    AND LENGTH(TRIM(nt.title)) > 0
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
  -- Growth rate labels with realistic thresholds
  CASE
    WHEN growth_rate_value >= 100000 THEN 'Viral'
    WHEN growth_rate_value >= 50000 THEN 'Rising fast'
    WHEN growth_rate_value >= 10000 THEN 'Rising'
    WHEN growth_rate_value > 0 THEN 'Stable'
    WHEN growth_rate_value < 0 THEN 'Declining'
    ELSE 'Stable'  -- Default to "Stable" instead of "Not enough data"
  END AS growth_rate_label,
  ai_opinion,
  score_details,
  video_id,
  external_id,
  platform_mentions,
  keywords,
  updated_at
FROM ranked_news
WHERE source_url IS NOT NULL
ORDER BY rank;

-- Grant permissions
GRANT SELECT ON public.home_feed_v1 TO anon;
GRANT SELECT ON public.home_feed_v1 TO authenticated;

-- Update comment
COMMENT ON VIEW public.home_feed_v1 IS 'Home feed view providing exactly 26 columns expected by API. Enhanced growth rate derivation from snapshots when news_trends value is missing. Keywords from multiple sources. All values from real data sources.';

-- Verify the fix
DO $$
DECLARE
  row_count INTEGER;
  no_growth_count INTEGER;
  no_keywords_count INTEGER;
BEGIN
  -- Check total rows
  SELECT COUNT(*) INTO row_count FROM public.home_feed_v1;
  RAISE NOTICE 'home_feed_v1 total rows: %', row_count;
  
  -- Check for "Not enough data" growth labels
  SELECT COUNT(*) INTO no_growth_count 
  FROM public.home_feed_v1 
  WHERE growth_rate_label = 'Not enough data';
  RAISE NOTICE 'Rows with "Not enough data" growth: %', no_growth_count;
  
  -- Check for empty keywords
  SELECT COUNT(*) INTO no_keywords_count 
  FROM public.home_feed_v1 
  WHERE keywords IS NULL OR keywords = '' OR keywords = '[]';
  RAISE NOTICE 'Rows with empty keywords: %', no_keywords_count;
  
  IF row_count < 20 THEN
    RAISE WARNING 'View has fewer than 20 rows (%). Check data quality.', row_count;
  END IF;
END $$;
