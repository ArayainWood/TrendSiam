/**
 * Check View Definition
 * Date: 2025-10-08
 * Purpose: See actual view definition to understand filters
 */

\echo '--- home_feed_v1 Definition ---'
SELECT definition
FROM pg_views
WHERE schemaname = 'public' AND viewname = 'home_feed_v1';

\echo ''
\echo '--- public_v_home_news Definition ---'
SELECT definition
FROM pg_views
WHERE schemaname = 'public' AND viewname = 'public_v_home_news';

