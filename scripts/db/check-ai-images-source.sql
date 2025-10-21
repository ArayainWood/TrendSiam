/**
 * Check AI Images Base Table
 * Date: 2025-10-08
 */

\echo '--- ai_images base table row count ---'
SELECT COUNT(*) AS total_ai_images FROM ai_images;

\echo ''
\echo '--- ai_images columns ---'
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ai_images'
ORDER BY ordinal_position;

\echo ''
\echo '--- Sample ai_images rows ---'
SELECT 
  id,
  news_id,
  LEFT(image_url, 60) AS image_url_preview,
  LEFT(prompt, 50) AS prompt_preview,
  model,
  created_at
FROM ai_images
ORDER BY created_at DESC
LIMIT 5;

\echo ''
\echo '--- public_v_ai_images_latest definition ---'
SELECT definition
FROM pg_views
WHERE schemaname = 'public' AND viewname = 'public_v_ai_images_latest';

\echo ''
\echo '--- Check if stories.story_id exists for top-3 ---'
SELECT 
  nt.id AS news_id,
  LEFT(nt.title, 40) AS title,
  st.story_id,
  st.story_id IS NOT NULL AS has_story_id
FROM news_trends nt
LEFT JOIN stories st ON st.story_id::text = nt.id::text
WHERE nt.title IS NOT NULL
ORDER BY nt.popularity_score DESC NULLS LAST
LIMIT 3;

