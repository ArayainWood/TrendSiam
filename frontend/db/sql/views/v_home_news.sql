-- =============================================
-- Home News View (v_home_news) - Fixed Version
-- Optimized view for Home page with proper column mapping
-- =============================================

DROP VIEW IF EXISTS public.v_home_news CASCADE;

CREATE OR REPLACE VIEW public.v_home_news 
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
  
  -- Scores (create popularity_score_precise alias pointing to popularity_score)
  nt.popularity_score,
  nt.popularity_score AS popularity_score_precise,
  
  -- Growth metrics (if exists, otherwise NULL)
  nt.growth_rate,
  
  -- AI and analysis fields (if they exist)
  nt.ai_opinion,
  nt.score_details,
  nt.reason,
  nt.keywords,
  nt.platform_mentions,
  
  -- Image fields with backward compatibility
  nt.ai_image_url,
  nt.ai_image_url AS image_url,  -- Backward compatibility alias
  COALESCE(
    nt.ai_image_prompt,                              -- Primary: news_trends table
    s.ai_image_prompt                                -- Fallback: stories table
  ) AS ai_image_prompt,
  COALESCE(
    nt.ai_image_url,                                 -- AI-generated image (primary)
    '/placeholder-image.svg'                         -- Safe placeholder fallback
  ) AS display_image_url_raw,
  (nt.ai_image_url IS NOT NULL) AS is_ai_image,
  
  -- Platform fields with simple fallback
  COALESCE(
    s.platform,                                      -- Primary: stories table
    nt.platform                                      -- Fallback: news_trends platform
  ) AS platforms_raw,
  
  -- Additional fields
  nt.description,
  nt.duration

FROM public.news_trends nt
LEFT JOIN public.stories s ON s.story_id = nt.video_id
WHERE 
  -- Show published content with recent fallback (restored original logic)
  nt.published_date IS NOT NULL
  OR nt.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY 
  COALESCE(nt.popularity_score, 0) DESC, 
  nt.published_date DESC NULLS LAST;

-- Set proper ownership and security
ALTER VIEW public.v_home_news OWNER TO postgres;
ALTER VIEW public.v_home_news SET (security_invoker = on);

-- Grant permissions (anon for public access, service_role for admin operations)
GRANT SELECT ON public.v_home_news TO anon, authenticated, service_role;

-- Add comment
COMMENT ON VIEW public.v_home_news IS 
'Optimized view for Home page with display_image_url_raw for client-side normalization';

-- Test the view to ensure it compiles
SELECT * FROM public.v_home_news LIMIT 5;

-- Verification query to check key fields
SELECT 
  COUNT(*) as total_items,
  COUNT(ai_image_url) as items_with_ai_images,
  COUNT(image_url) as items_with_image_url_alias,
  COUNT(popularity_score) as items_with_popularity_score,
  COUNT(popularity_score_precise) as items_with_popularity_score_precise,
  COUNT(CASE WHEN display_image_url_raw = '/placeholder-image.svg' THEN 1 END) as items_using_placeholder,
  COUNT(CASE WHEN is_ai_image THEN 1 END) as items_marked_as_ai
FROM public.v_home_news
LIMIT 1;
