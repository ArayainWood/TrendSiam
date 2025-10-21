-- Create public.home_feed_v1 view with exact 26 columns expected by the API
-- This view prioritizes news_trends data with optional joins to other tables
-- It returns data for all platforms, not just YouTube

CREATE OR REPLACE VIEW public.home_feed_v1 AS
WITH ranked_news AS (
  -- Main data from news_trends with ranking
  SELECT 
    nt.id::text AS id,
    nt.title,
    nt.summary,
    nt.summary_en,
    nt.category,
    nt.platform,
    nt.channel,
    COALESCE(nt.published_at, nt.created_at) AS published_at,
    -- Build source URL based on platform
    CASE
      WHEN nt.platform = 'YouTube' AND nt.external_id IS NOT NULL THEN 
        'https://www.youtube.com/watch?v=' || nt.external_id
      WHEN nt.platform = 'YouTube' AND nt.video_id IS NOT NULL THEN 
        'https://www.youtube.com/watch?v=' || nt.video_id
      ELSE COALESCE(nt.source_url, '')
    END AS source_url,
    nt.ai_image_url AS image_url,
    nt.ai_image_prompt AS ai_prompt,
    COALESCE(nt.popularity_score, 0)::numeric AS popularity_score,
    -- Rank by popularity score
    ROW_NUMBER() OVER (ORDER BY COALESCE(nt.popularity_score, 0) DESC)::integer AS rank,
    -- Engagement metrics
    CASE 
      WHEN nt.view_count ~ '^\d+$' THEN nt.view_count::bigint
      ELSE 0
    END AS views,
    CASE 
      WHEN nt.like_count ~ '^\d+$' THEN nt.like_count::bigint
      ELSE 0
    END AS likes,
    CASE 
      WHEN nt.comment_count ~ '^\d+$' THEN nt.comment_count::bigint
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
    COALESCE(nt.score_details, '{}'::text)::jsonb AS score_details,
    nt.video_id,
    nt.external_id,
    nt.platform_mentions::integer AS platform_mentions,
    nt.keywords,
    COALESCE(nt.updated_at, nt.created_at) AS updated_at
  FROM public.news_trends nt
  WHERE 
    -- Basic data quality filter
    nt.title IS NOT NULL 
    AND LENGTH(TRIM(nt.title)) > 0
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
ORDER BY rank, popularity_score DESC;

-- Add comment explaining the view
COMMENT ON VIEW public.home_feed_v1 IS 'Home feed view providing exactly 26 columns expected by API. Uses news_trends as primary source. Enforces Top-3 image policy.';
