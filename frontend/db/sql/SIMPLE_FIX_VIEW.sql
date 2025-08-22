-- =============================================
-- SIMPLE FIX: Create a working view without complex JSON
-- =============================================
-- This creates a simpler version that avoids JSON errors
-- =============================================

-- Drop the broken view
DROP VIEW IF EXISTS public.news_public_v CASCADE;

-- Create a simpler view that doesn't use complex JSON operations
CREATE VIEW public.news_public_v
WITH (security_invoker = true) AS
SELECT
  -- Core identifiers
  n.id,
  n.video_id,
  n.external_id,
  
  -- Content fields
  n.title,
  n.summary,
  n.summary_en,
  n.description,
  n.category,
  n.platform,
  n.channel,
  
  -- Dates with compatibility alias
  n.date,
  n.published_date,
  n.published_date AS published_at,  -- Compatibility alias
  n.created_at,
  n.updated_at,
  
  -- Metrics
  n.view_count,
  n.like_count,
  n.comment_count,
  n.duration,
  
  -- Scores - provide both raw and computed
  n.popularity_score,
  n.popularity_score_precise,
  COALESCE(n.popularity_score_precise, n.popularity_score, 0)::numeric AS score,
  
  -- Safe image field only (no prompts)
  n.ai_image_url,
  n.ai_image_url AS display_image_url,  -- Compatibility alias
  
  -- Analysis fields
  n.reason,
  n.keywords,
  n.ai_opinion,
  n.ai_opinion AS analysis,  -- Compatibility alias
  
  -- Raw score_details as TEXT (no conversion)
  n.score_details,
  
  -- Simple view_details as JSON object (no parsing of score_details)
  jsonb_build_object(
    'views', COALESCE(n.view_count, '0'),
    'growth_rate', COALESCE(n.growth_rate, '0'),
    'platform_mentions', COALESCE(n.platform_mentions, '0'),
    'matched_keywords', COALESCE(n.keywords, ''),
    'ai_opinion', COALESCE(n.ai_opinion, ''),
    'score', COALESCE(n.popularity_score_precise, n.popularity_score, 0)::text
  ) AS view_details
  
FROM public.news_trends n
WHERE
  -- Show published content with recent fallback
  n.published_date IS NOT NULL
  OR n.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY 
  COALESCE(n.popularity_score_precise, n.popularity_score, 0) DESC, 
  n.id ASC;

-- Grant permissions
GRANT SELECT ON public.news_public_v TO anon, authenticated;

-- Test it works
SELECT 
  'Simple view created successfully!' as status,
  COUNT(*) as total_rows
FROM public.news_public_v
LIMIT 1;
