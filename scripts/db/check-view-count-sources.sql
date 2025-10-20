/**
 * Check view_count sources
 */

\echo '--- Top story: news_trends vs snapshots view_count ---'
SELECT 
  nt.id,
  LEFT(nt.title, 40) AS title,
  nt.view_count AS nt_view_count_text,
  snap.view_count AS snap_view_count_text,
  nt.view_count = snap.view_count AS counts_match
FROM news_trends nt
LEFT JOIN public_v_latest_snapshots snap ON snap.story_id::text = nt.id::text
WHERE nt.title IS NOT NULL
ORDER BY nt.popularity_score DESC NULLS LAST
LIMIT 5;

