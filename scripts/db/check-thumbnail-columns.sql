/**
 * Check Thumbnail Column Names
 */

\echo '--- news_trends columns related to images ---'
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'news_trends'
  AND (column_name LIKE '%image%' OR column_name LIKE '%thumbnail%' OR column_name LIKE '%url%')
ORDER BY column_name;

\echo ''
\echo '--- Sample news_trends image data ---'
SELECT 
  id,
  LEFT(title, 35) AS title,
  ai_image_url IS NOT NULL AS has_ai_image_url,
  source_url IS NOT NULL AS has_source_url,
  LEFT(ai_image_url, 60) AS ai_image_preview
FROM news_trends
WHERE title IS NOT NULL
ORDER BY popularity_score DESC NULLS LAST
LIMIT 3;

