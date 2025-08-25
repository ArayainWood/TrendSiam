-- =============================================
-- Home News View (v_home_news)
-- Optimized view for Home page with display_image_url_raw
-- =============================================

DROP VIEW IF EXISTS public.v_home_news CASCADE;

CREATE VIEW public.v_home_news 
WITH (security_invoker = true) AS
SELECT 
  -- Core identifiers
  nt.id,
  nt.video_id AS external_id,
  nt.video_id,
  
  -- Content fields
  nt.title,
  nt.summary,
  nt.summary_en,
  nt.category,
  nt.platform,
  nt.channel AS channel_title,
  nt.channel,
  
  -- Dates
  nt.date AS summary_date,
  nt.date,
  nt.published_date AS published_at,
  nt.published_date,
  nt.created_at,
  nt.updated_at,
  
  -- Metrics
  nt.view_count AS views,
  nt.view_count,
  nt.like_count AS likes,
  nt.like_count,
  nt.comment_count AS comments,
  nt.comment_count,
  
  -- Scores
  nt.popularity_score,
  nt.popularity_score_precise,
  
  -- Growth metrics
  nt.growth_rate,
  
  nt.ai_opinion,
  nt.score_details,
  
  -- Image fields
  nt.ai_image_url,
  -- AI Prompt with fallback chain: stories.ai_image_prompt -> news_trends.ai_image_prompt -> image_files.reason -> snapshots.reason
  COALESCE(
    s.ai_image_prompt,                                   -- Primary: stories table
    nt.ai_image_prompt,                                  -- Fallback 1: news_trends table
    (SELECT reason FROM image_files 
     WHERE story_id = nt.video_id 
       AND is_valid = true 
       AND reason IS NOT NULL 
     ORDER BY generated_at DESC LIMIT 1),               -- Fallback 2: latest valid image file reason
    (SELECT reason FROM snapshots 
     WHERE story_id = nt.video_id 
       AND reason IS NOT NULL 
     ORDER BY snapshot_date DESC LIMIT 1)              -- Fallback 3: latest snapshot reason
  ) AS ai_image_prompt,
  COALESCE(
    nt.ai_image_url,                                 -- AI-generated image (primary)
    '/placeholder-image.svg'                         -- Safe placeholder fallback
  ) AS display_image_url_raw,
  (nt.ai_image_url IS NOT NULL) AS is_ai_image,
  
  -- Analysis (safe fields only)
  nt.reason,
  nt.keywords,
  
  -- Platform fields with fallback chain
  nt.platform_mentions,
  COALESCE(
    s.platform,                                      -- Primary: stories table
    nt.platform,                                     -- Fallback 1: news_trends platform
    nt.platform_mentions,                            -- Fallback 2: news_trends platform_mentions
    (SELECT platform_mentions FROM snapshots 
     WHERE story_id = nt.video_id 
       AND platform_mentions IS NOT NULL 
     ORDER BY snapshot_date DESC LIMIT 1)           -- Fallback 3: latest snapshot platform_mentions
  ) AS platforms_raw,
  
  -- Additional fields
  nt.description,
  nt.duration
  
FROM public.news_trends nt
LEFT JOIN public.stories s ON s.story_id = nt.video_id
WHERE 
  -- Show published content with recent fallback
  nt.published_date IS NOT NULL
  OR nt.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY 
  COALESCE(nt.popularity_score_precise, nt.popularity_score, 0) DESC, 
  nt.published_date DESC NULLS LAST;

-- Set proper ownership and security
ALTER VIEW public.v_home_news OWNER TO postgres;
ALTER VIEW public.v_home_news SET (security_invoker = on);

-- Grant permissions (anon for public access, service_role for admin operations)
GRANT SELECT ON public.v_home_news TO anon, authenticated, service_role;

-- Add comment
COMMENT ON VIEW public.v_home_news IS 
'Optimized view for Home page with display_image_url_raw for client-side normalization';

-- Verification query
SELECT 
  COUNT(*) as total_items,
  COUNT(ai_image_url) as items_with_ai_images,
  COUNT(CASE WHEN display_image_url_raw = '/placeholder-image.svg' THEN 1 END) as items_using_placeholder,
  COUNT(CASE WHEN is_ai_image THEN 1 END) as items_marked_as_ai
FROM public.v_home_news
LIMIT 1;
