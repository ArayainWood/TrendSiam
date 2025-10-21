-- Baseline Assessment: Published Date Issue
-- Date: 2025-10-10
-- Purpose: Identify extent of missing/invalid published_at data

\echo '=== BASELINE: Published Date Analysis ==='
\echo ''

-- Test 1: View schema check
\echo '1. View Schema (published_at vs snapshot_date):'
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'home_feed_v1'
  AND column_name IN ('published_at', 'snapshot_date')
ORDER BY column_name;

\echo ''
\echo '2. Data availability in home_feed_v1:'
SELECT 
  COUNT(*) AS total_items,
  COUNT(published_at) AS has_published_at,
  COUNT(snapshot_date) AS has_snapshot_date,
  ROUND(100.0 * COUNT(published_at) / NULLIF(COUNT(*), 0), 1) AS published_pct,
  ROUND(100.0 * COUNT(snapshot_date) / NULLIF(COUNT(*), 0), 1) AS snapshot_pct
FROM home_feed_v1;

\echo ''
\echo '3. Sample rows (showing first 5 items):'
SELECT 
  id,
  LEFT(title, 50) AS title_preview,
  published_at,
  snapshot_date,
  platform,
  rank
FROM home_feed_v1
ORDER BY rank ASC
LIMIT 5;

\echo ''
\echo '4. Published date range analysis:'
SELECT 
  MIN(published_at) AS earliest_published,
  MAX(published_at) AS latest_published,
  MIN(snapshot_date) AS earliest_snapshot,
  MAX(snapshot_date) AS latest_snapshot
FROM home_feed_v1
WHERE published_at IS NOT NULL;

\echo ''
\echo '5. Ranking order check (view definition):'
SELECT 
  pg_get_viewdef('public.home_feed_v1', true) AS view_definition;

\echo ''
\echo '6. Upstream table: news_trends published_at status:'
SELECT 
  COUNT(*) AS total,
  COUNT(published_at) AS has_published_at,
  COUNT(published_date) AS has_published_date,
  ROUND(100.0 * COUNT(published_at) / NULLIF(COUNT(*), 0), 1) AS published_at_pct,
  ROUND(100.0 * COUNT(published_date) / NULLIF(COUNT(*), 0), 1) AS published_date_pct
FROM news_trends;

\echo ''
\echo '7. Sample from news_trends (raw data):'
SELECT 
  id,
  LEFT(title, 40) AS title,
  published_at,
  published_date,
  date AS snapshot_date,
  platform
FROM news_trends
ORDER BY date DESC, popularity_score DESC
LIMIT 5;

