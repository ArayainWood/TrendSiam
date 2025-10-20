-- =========================================================
-- FIX AI IMAGES LATEST VIEW TO INCLUDE PROMPT
-- Date: 2025-09-26
--
-- Adds ai_prompt column to public_v_ai_images_latest view
-- Maintains definer semantics and Plan-B security
-- =========================================================

BEGIN;

-- =========================================
-- DROP AND RECREATE VIEW WITH PROMPT
-- =========================================

DROP VIEW IF EXISTS public.public_v_ai_images_latest CASCADE;

-- Create view with prompt column included
CREATE VIEW public.public_v_ai_images_latest AS
WITH ranked AS (
  SELECT 
    ai.news_id,
    ai.image_url,
    ai.prompt AS ai_prompt,  -- Include the prompt
    ai.created_at,
    ROW_NUMBER() OVER (PARTITION BY ai.news_id ORDER BY ai.created_at DESC) AS rn
  FROM public.ai_images ai
  WHERE ai.is_active = true  -- Only active images
)
SELECT 
  news_id, 
  image_url, 
  ai_prompt,  -- Expose prompt in view
  created_at
FROM ranked
WHERE rn = 1;  -- Latest image per news item

-- =========================================
-- SET DEFINER SEMANTICS AND OWNERSHIP
-- =========================================

-- Force definer semantics
DO $$
BEGIN
  BEGIN
    ALTER VIEW public.public_v_ai_images_latest SET (security_invoker = false);
    RAISE NOTICE '✅ Set security_invoker = false on public_v_ai_images_latest';
  EXCEPTION
    WHEN undefined_object THEN
      RAISE NOTICE '⚠️  security_invoker not supported - using ownership model';
    WHEN OTHERS THEN
      RAISE NOTICE '⚠️  Could not set security_invoker: %', SQLERRM;
  END;
END $$;

-- Set owner to postgres
ALTER VIEW public.public_v_ai_images_latest OWNER TO postgres;

-- =========================================
-- SET PERMISSIONS
-- =========================================

-- Revoke all existing permissions first
REVOKE ALL ON public.public_v_ai_images_latest FROM PUBLIC;

-- Grant read access following Plan-B security model
GRANT SELECT ON public.public_v_ai_images_latest TO anon;
GRANT SELECT ON public.public_v_ai_images_latest TO authenticated;
GRANT SELECT ON public.public_v_ai_images_latest TO service_role;

-- Ensure base table is NOT accessible
REVOKE ALL ON ai_images FROM anon, authenticated;

-- =========================================
-- DOCUMENTATION
-- =========================================

COMMENT ON VIEW public.public_v_ai_images_latest IS 
'Latest AI-generated image per news item with prompt included.
Security: DEFINER view - anon can read without base table permissions.
Returns: news_id, image_url, ai_prompt, created_at for latest active image.
Updated: 2025-09-26 - Added ai_prompt column';

-- =========================================
-- VERIFICATION
-- =========================================

DO $$
DECLARE
  v_count INTEGER;
  v_columns TEXT[];
  v_expected_columns TEXT[] := ARRAY['news_id', 'image_url', 'ai_prompt', 'created_at'];
  v_sample RECORD;
BEGIN
  -- Check columns
  SELECT array_agg(column_name ORDER BY ordinal_position)
  INTO v_columns
  FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'public_v_ai_images_latest';
  
  IF v_columns IS DISTINCT FROM v_expected_columns THEN
    RAISE WARNING 'Column mismatch! Expected: %, Got: %', v_expected_columns, v_columns;
  ELSE
    RAISE NOTICE '✅ All expected columns present: %', v_columns;
  END IF;
  
  -- Test view returns data
  SELECT COUNT(*) INTO v_count FROM public.public_v_ai_images_latest;
  RAISE NOTICE '✅ View returns % AI image records', v_count;
  
  -- Sample data check
  SELECT 
    news_id IS NOT NULL AS has_news_id,
    image_url IS NOT NULL AS has_image_url,
    ai_prompt IS NOT NULL AS has_prompt
  INTO v_sample
  FROM public.public_v_ai_images_latest
  LIMIT 1;
  
  IF FOUND THEN
    RAISE NOTICE '✅ Sample record check:';
    RAISE NOTICE '   news_id: %', CASE WHEN v_sample.has_news_id THEN 'present' ELSE 'missing' END;
    RAISE NOTICE '   image_url: %', CASE WHEN v_sample.has_image_url THEN 'present' ELSE 'missing' END;
    RAISE NOTICE '   ai_prompt: %', CASE WHEN v_sample.has_prompt THEN 'present' ELSE 'missing' END;
  END IF;
END $$;

COMMIT;
