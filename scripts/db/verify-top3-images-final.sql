/**
 * Verify Top-3 Images with Fallback
 */

\echo '========================================='
\echo 'TOP-3 IMAGES VERIFICATION'
\echo '========================================='
\echo ''

SELECT 
  id,
  LEFT(title, 40) AS title,
  rank,
  is_top3,
  image_url IS NOT NULL AS has_image,
  LEFT(image_url, 80) AS image_preview,
  ai_prompt IS NOT NULL AS has_prompt,
  video_views,
  likes,
  comments
FROM public.home_feed_v1
WHERE is_top3 = true
ORDER BY rank;

