-- =========================================================
-- CREATE PUBLIC BRIDGE VIEW FOR AI IMAGES
-- Date: 2025-09-23
--
-- Creates a safe bridge view that exposes only the latest 
-- image per news_id. Frontend will read this view instead
-- of the base ai_images table.
--
-- Security: No grants on base table, only on the view
-- =========================================================

BEGIN;

-- Create bridge view for latest AI images
CREATE OR REPLACE VIEW public.public_v_ai_images_latest AS
SELECT DISTINCT ON (ai.news_id)
  ai.news_id,
  ai.image_url,
  ai.created_at
FROM ai_images ai
WHERE ai.image_url IS NOT NULL
ORDER BY ai.news_id, ai.created_at DESC;

-- =========================================
-- SECURITY MODEL
-- =========================================

-- Grant SELECT on the view (NOT the base table)
-- The view uses definer security (default) so it can read base table
GRANT SELECT ON public.public_v_ai_images_latest TO anon;
GRANT SELECT ON public.public_v_ai_images_latest TO authenticated;

-- Do NOT grant on base table ai_images

-- =========================================
-- DOCUMENTATION
-- =========================================

COMMENT ON VIEW public.public_v_ai_images_latest IS
'Bridge view exposing latest AI image per news item.
Security: Frontend reads this view, not the base ai_images table.
Returns: news_id, image_url, created_at for the most recent image per news_id.
Created: 2025-09-23';

-- =========================================
-- VERIFICATION
-- =========================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Check if view returns data
  SELECT COUNT(*) INTO v_count FROM public.public_v_ai_images_latest;
  RAISE NOTICE 'Bridge view has % rows', v_count;
  
  -- Verify no duplicates per news_id
  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT news_id, COUNT(*) as cnt
    FROM public.public_v_ai_images_latest
    GROUP BY news_id
    HAVING COUNT(*) > 1
  ) dups;
  
  IF v_count > 0 THEN
    RAISE WARNING 'Found % duplicate news_ids in bridge view', v_count;
  ELSE
    RAISE NOTICE 'No duplicate news_ids - view is correctly distinct';
  END IF;
END $$;

COMMIT;
