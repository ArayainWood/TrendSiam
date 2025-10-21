/**
 * Full View Definition Export
 * Date: 2025-10-08
 */

\o scripts/db/home_feed_v1_definition.txt
SELECT definition FROM pg_views WHERE schemaname = 'public' AND viewname = 'home_feed_v1';
\o

\o scripts/db/public_v_home_news_definition.txt
SELECT definition FROM pg_views WHERE schemaname = 'public' AND viewname = 'public_v_home_news';
\o

\echo 'View definitions exported to scripts/db/*_definition.txt'

