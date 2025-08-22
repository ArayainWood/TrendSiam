-- =============================================
-- COMPLETE FIX: Drop and Recreate View
-- =============================================
-- The functions exist but the view is broken
-- We need to DROP and RECREATE it
-- =============================================

-- STEP 1: Drop the broken view
DROP VIEW IF EXISTS public.news_public_v CASCADE;

-- STEP 2: Ensure helper functions exist (they should already)
CREATE OR REPLACE FUNCTION public.safe_to_jsonb(src text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF src IS NULL OR btrim(src) = '' THEN
    RETURN '{}'::jsonb;
  END IF;
  BEGIN
    RETURN src::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN '{}'::jsonb;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.safe_json_text(obj jsonb, key text, default_val text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(jsonb_extract_path_text(obj, key), default_val);
$$;

-- STEP 3: Create the view fresh
CREATE VIEW public.news_public_v
WITH (security_invoker = true) AS
WITH src AS (
  SELECT
    n.*,
    public.safe_to_jsonb(n.score_details) AS score_details_json
  FROM public.news_trends n
)
SELECT
  -- Core identifiers
  src.id,
  src.video_id,
  src.external_id,
  
  -- Content fields
  src.title,
  src.summary,
  src.summary_en,
  src.description,
  src.category,
  src.platform,
  src.channel,
  
  -- Dates with compatibility alias
  src.date,
  src.published_date,
  src.published_date AS published_at,  -- Compatibility alias
  src.created_at,
  src.updated_at,
  
  -- Metrics
  src.view_count,
  src.like_count,
  src.comment_count,
  src.duration,
  
  -- Scores - provide both raw and computed
  src.popularity_score,
  src.popularity_score_precise,
  COALESCE(src.popularity_score_precise, src.popularity_score, 0)::numeric AS score,
  
  -- Safe image field only (no prompts)
  src.ai_image_url,
  src.ai_image_url AS display_image_url,  -- Compatibility alias
  
  -- Analysis fields
  src.reason,
  src.keywords,
  src.ai_opinion,
  src.ai_opinion AS analysis,  -- Compatibility alias
  
  -- Raw score_details as TEXT
  src.score_details,
  
  -- Build view_details safely using helper functions
  jsonb_build_object(
    'views', COALESCE(src.view_count::text, '0'),
    'growth_rate', public.safe_json_text(src.score_details_json, 'growth_rate', '0'),
    'platform_mentions', public.safe_json_text(src.score_details_json, 'platform_mentions', '0'),
    'matched_keywords', COALESCE(src.keywords::text, ''),
    'ai_opinion', COALESCE(src.ai_opinion, ''),
    'score', COALESCE(src.popularity_score_precise, src.popularity_score, 0)::text
  ) AS view_details
  
FROM src
WHERE
  -- Show published content with recent fallback
  src.published_date IS NOT NULL
  OR src.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY 
  COALESCE(src.popularity_score_precise, src.popularity_score, 0) DESC, 
  src.id ASC;

-- STEP 4: Grant permissions
GRANT SELECT ON public.news_public_v TO anon, authenticated;

-- STEP 5: Test it works
SELECT 
  'View recreated successfully!' as status,
  COUNT(*) as total_rows,
  COUNT(view_details) as rows_with_view_details
FROM public.news_public_v;
