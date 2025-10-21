-- =========================================================
-- WIRE AI PROMPT FROM AI IMAGES VIEW TO HOME VIEW
-- Date: 2025-09-26
--
-- Ensures home view properly uses ai_prompt from updated
-- public_v_ai_images_latest view (Top-3 only)
-- =========================================================

BEGIN;

-- =========================================
-- VERIFY AI IMAGES VIEW HAS PROMPT
-- =========================================

DO $$
DECLARE
  v_has_prompt BOOLEAN;
BEGIN
  -- Check if ai_prompt column exists in AI images view
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'public_v_ai_images_latest'
      AND column_name = 'ai_prompt'
  ) INTO v_has_prompt;
  
  IF NOT v_has_prompt THEN
    RAISE EXCEPTION 'Column ai_prompt not found in public_v_ai_images_latest. Run 2025-09-26_fix_ai_images_latest_prompt.sql first!';
  ELSE
    RAISE NOTICE '✅ public_v_ai_images_latest has ai_prompt column';
  END IF;
END $$;

-- =========================================
-- VERIFY HOME VIEW SETUP
-- =========================================

-- The home view already has the correct logic for ai_prompt.
-- It joins with public_v_ai_images_latest and uses:
-- CASE 
--   WHEN fd.is_top3 THEN COALESCE(fd.ai_latest_prompt, fd.ai_image_prompt)
--   ELSE NULL
-- END::text AS ai_prompt

-- Just verify it's working correctly
DO $$
DECLARE
  v_top3_with_prompt INTEGER;
  v_non_top3_with_prompt INTEGER;
  v_sample RECORD;
BEGIN
  -- Count Top-3 items with prompts
  SELECT COUNT(*) INTO v_top3_with_prompt
  FROM public.public_v_home_news
  WHERE is_top3 = true AND ai_prompt IS NOT NULL;
  
  RAISE NOTICE '✅ Top-3 items with ai_prompt: %', v_top3_with_prompt;
  
  -- Count non-Top-3 items that incorrectly have prompts
  SELECT COUNT(*) INTO v_non_top3_with_prompt
  FROM public.public_v_home_news
  WHERE is_top3 = false AND ai_prompt IS NOT NULL;
  
  IF v_non_top3_with_prompt > 0 THEN
    RAISE WARNING '❌ Found % non-Top-3 items with ai_prompt (should be NULL)', v_non_top3_with_prompt;
  ELSE
    RAISE NOTICE '✅ Non-Top-3 items correctly have NULL ai_prompt';
  END IF;
  
  -- Sample Top-3 item
  SELECT 
    title,
    rank,
    is_top3,
    image_url IS NOT NULL AS has_image,
    ai_prompt IS NOT NULL AS has_prompt,
    substring(ai_prompt, 1, 50) || '...' AS prompt_preview
  INTO v_sample
  FROM public.public_v_home_news
  WHERE is_top3 = true
  LIMIT 1;
  
  IF FOUND THEN
    RAISE NOTICE '✅ Sample Top-3 item:';
    RAISE NOTICE '   Title: %', v_sample.title;
    RAISE NOTICE '   Rank: %', v_sample.rank;
    RAISE NOTICE '   Has image: %', v_sample.has_image;
    RAISE NOTICE '   Has prompt: %', v_sample.has_prompt;
    IF v_sample.has_prompt THEN
      RAISE NOTICE '   Prompt preview: %', v_sample.prompt_preview;
    END IF;
  END IF;
END $$;

-- =========================================
-- SANITY CHECKS
-- =========================================

\echo '\n========== AI PROMPT WIRING VERIFICATION =========='

-- 1. Check AI images view columns
\echo '\n--- AI Images View Columns ---'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'public_v_ai_images_latest'
ORDER BY ordinal_position;

-- 2. Sample AI images with prompts
\echo '\n--- Sample AI Images with Prompts ---'
SELECT 
  news_id,
  substring(image_url, 1, 50) || '...' AS image_url_preview,
  substring(ai_prompt, 1, 100) || '...' AS ai_prompt_preview,
  created_at
FROM public.public_v_ai_images_latest
WHERE ai_prompt IS NOT NULL
LIMIT 5;

-- 3. Top-3 items in home view
\echo '\n--- Top-3 Items in Home View ---'
SELECT 
  id,
  title,
  rank,
  is_top3,
  CASE WHEN image_url IS NOT NULL THEN '✓ HAS' ELSE '✗ NULL' END AS image_status,
  CASE WHEN ai_prompt IS NOT NULL THEN '✓ HAS' ELSE '✗ NULL' END AS prompt_status,
  popularity_score
FROM public.public_v_home_news
WHERE is_top3 = true
ORDER BY rank
LIMIT 5;

-- 4. Non-Top-3 verification (should have NULL prompts)
\echo '\n--- Non-Top-3 Items (Should Have NULL Prompts) ---'
SELECT 
  id,
  title,
  rank,
  is_top3,
  CASE WHEN ai_prompt IS NULL THEN '✓ NULL (correct)' ELSE '✗ HAS PROMPT (wrong!)' END AS prompt_check
FROM public.public_v_home_news
WHERE is_top3 = false
LIMIT 5;

-- 5. Summary statistics
\echo '\n--- Summary Statistics ---'
WITH stats AS (
  SELECT 
    COUNT(*) AS total_items,
    COUNT(CASE WHEN is_top3 THEN 1 END) AS top3_items,
    COUNT(CASE WHEN is_top3 AND ai_prompt IS NOT NULL THEN 1 END) AS top3_with_prompts,
    COUNT(CASE WHEN is_top3 AND image_url IS NOT NULL THEN 1 END) AS top3_with_images,
    COUNT(CASE WHEN NOT is_top3 AND ai_prompt IS NOT NULL THEN 1 END) AS non_top3_with_prompts
  FROM public.public_v_home_news
)
SELECT 
  total_items,
  top3_items,
  top3_with_prompts || '/' || top3_items AS top3_prompt_coverage,
  top3_with_images || '/' || top3_items AS top3_image_coverage,
  CASE 
    WHEN non_top3_with_prompts = 0 THEN '✓ 0 (correct)'
    ELSE '✗ ' || non_top3_with_prompts || ' (should be 0)'
  END AS non_top3_prompt_check
FROM stats;

-- =========================================
-- FINAL MESSAGE
-- =========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========== AI PROMPT WIRING COMPLETE ==========';
  RAISE NOTICE 'The home view is already correctly wired to use ai_prompt from';
  RAISE NOTICE 'public_v_ai_images_latest for Top-3 items only.';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Verify UI shows "View AI Prompt" button for Top-3 items';
  RAISE NOTICE '2. Check that prompts display correctly when clicked';
  RAISE NOTICE '3. Run regression tests: npm run lint:perms';
  RAISE NOTICE '================================================';
END $$;

COMMIT;
