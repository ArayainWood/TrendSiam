/**
 * Diagnose Join Issue
 * Date: 2025-10-08
 * Purpose: Find out why the view returns 0 rows
 */

SET client_min_messages TO NOTICE;

\echo '--- Check stories table ---'
SELECT 
  'stories' AS table_name,
  COUNT(*) AS total_rows,
  COUNT(story_id) AS with_story_id
FROM stories;

\echo ''
\echo '--- Check news_trends to stories linkage ---'
SELECT 
  COUNT(DISTINCT nt.id) AS news_trends_count,
  COUNT(DISTINCT st.story_id) AS stories_count,
  COUNT(DISTINCT CASE WHEN st.story_id IS NOT NULL THEN nt.id END) AS linked_count,
  COUNT(DISTINCT CASE WHEN st.story_id IS NULL THEN nt.id END) AS unlinked_count
FROM news_trends nt
LEFT JOIN stories st ON st.story_id::text = nt.id::text;

\echo ''
\echo '--- Check if public_v_home_news has any filter issues ---'
\echo 'Trying to select from underlying base query without date filters...'

-- Test simplified query
WITH platform_id AS (
  SELECT nt.id AS news_id,
    COALESCE(nt.video_id, nt.external_id) AS platform_id
  FROM news_trends nt
),
joined_data AS (
  SELECT 
    nt.id,
    nt.title,
    nt.platform,
    nt.popularity_score,
    nt.video_id,
    nt.external_id
  FROM news_trends nt
  WHERE nt.platform = 'YouTube'
    AND nt.title IS NOT NULL
)
SELECT 
  COUNT(*) AS rows_from_simplified_query
FROM joined_data;

\echo ''
\echo '--- Check platform filter ---'
SELECT 
  platform,
  COUNT(*) AS count
FROM news_trends
GROUP BY platform
ORDER BY count DESC;

