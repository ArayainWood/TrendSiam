-- Verify the home_feed_v1 view after creation

-- Check if view exists
SELECT 
  'View exists' as check_type,
  EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'home_feed_v1'
  ) as result;

-- Check column count and names
SELECT 
  'Column count' as check_type,
  COUNT(*) as count,
  COUNT(*) = 26 as is_valid
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'home_feed_v1';

-- List all columns
SELECT 
  ordinal_position,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'home_feed_v1'
ORDER BY ordinal_position;

-- Check permissions
SELECT 
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
AND table_name = 'home_feed_v1'
AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- Test selecting from the view
SELECT 
  'Row count' as check_type,
  COUNT(*) as count
FROM public.home_feed_v1;

-- Check Top-3 data
SELECT 
  'Top-3 check' as check_type,
  COUNT(*) as total_top3,
  COUNT(image_url) as with_images,
  COUNT(ai_prompt) as with_prompts,
  COUNT(*) = COUNT(image_url) as images_ok,
  COUNT(*) = COUNT(ai_prompt) as prompts_ok
FROM public.home_feed_v1
WHERE is_top3 = true;

-- Check non-Top-3 don't have images/prompts
SELECT 
  'Non-Top-3 check' as check_type,
  COUNT(*) as total_non_top3,
  COUNT(image_url) as with_images,
  COUNT(ai_prompt) as with_prompts,
  COUNT(image_url) = 0 as images_ok,
  COUNT(ai_prompt) = 0 as prompts_ok
FROM public.home_feed_v1
WHERE is_top3 = false;

-- Sample first 5 rows
SELECT 
  id,
  title,
  platform,
  rank,
  is_top3,
  popularity_score,
  CASE WHEN image_url IS NOT NULL THEN 'YES' ELSE 'NO' END as has_image,
  CASE WHEN ai_prompt IS NOT NULL THEN 'YES' ELSE 'NO' END as has_prompt
FROM public.home_feed_v1
ORDER BY rank
LIMIT 5;
