/**
 * Check Column Types for platform_mentions and keywords
 * Date: 2025-10-08
 */

\echo '--- news_trends column types ---'
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'news_trends'
  AND column_name IN ('platform_mentions', 'keywords', 'ai_opinion', 'score_details')
ORDER BY ordinal_position;

\echo ''
\echo '--- Sample news_trends data ---'
SELECT 
  id,
  LEFT(title, 40) AS title,
  platform_mentions,
  LEFT(keywords, 50) AS keywords_preview
FROM news_trends
WHERE title IS NOT NULL
LIMIT 3;

\echo ''
\echo '--- snapshots column types ---'
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'snapshots'
  AND column_name IN ('platform_mentions', 'keywords')
ORDER BY ordinal_position;

