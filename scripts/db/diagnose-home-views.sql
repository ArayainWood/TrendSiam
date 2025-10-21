/**
 * Diagnostic Script: Home Views State
 * Date: 2025-10-08
 * Purpose: Understand current database state for home views and data availability
 */

SET client_min_messages TO NOTICE;

\echo '========================================='
\echo 'DATABASE DIAGNOSTIC REPORT'
\echo '========================================='
\echo ''

-- ============================================================================
-- PART 1: View Existence
-- ============================================================================
\echo '--- PART 1: View Existence ---'
SELECT 
  schemaname,
  viewname,
  viewowner,
  definition IS NOT NULL AS has_definition
FROM pg_views
WHERE schemaname = 'public' 
  AND viewname IN ('home_feed_v1', 'public_v_home_news')
ORDER BY viewname;

\echo ''

-- ============================================================================
-- PART 2: Column Counts
-- ============================================================================
\echo '--- PART 2: Column Counts ---'
SELECT 
  table_name AS view_name,
  COUNT(*) AS column_count,
  STRING_AGG(column_name, ', ' ORDER BY ordinal_position) AS columns
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('home_feed_v1', 'public_v_home_news')
GROUP BY table_name
ORDER BY table_name;

\echo ''

-- ============================================================================
-- PART 3: Check web_view_count column
-- ============================================================================
\echo '--- PART 3: web_view_count Column Check ---'
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('home_feed_v1', 'public_v_home_news')
  AND column_name = 'web_view_count';

\echo ''

-- ============================================================================
-- PART 4: Row Counts from Each View
-- ============================================================================
\echo '--- PART 4: Row Counts ---'
DO $$
DECLARE
  v1_count INTEGER := 0;
  v2_count INTEGER := 0;
BEGIN
  -- Check if views exist before querying
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'home_feed_v1') THEN
    EXECUTE 'SELECT COUNT(*) FROM public.home_feed_v1' INTO v1_count;
    RAISE NOTICE 'home_feed_v1: % rows', v1_count;
  ELSE
    RAISE NOTICE 'home_feed_v1: VIEW DOES NOT EXIST';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'public_v_home_news') THEN
    EXECUTE 'SELECT COUNT(*) FROM public.public_v_home_news' INTO v2_count;
    RAISE NOTICE 'public_v_home_news: % rows', v2_count;
  ELSE
    RAISE NOTICE 'public_v_home_news: VIEW DOES NOT EXIST';
  END IF;
END $$;

\echo ''

-- ============================================================================
-- PART 5: Base Table Data Availability
-- ============================================================================
\echo '--- PART 5: Base Table Data ---'
SELECT 
  'news_trends' AS table_name,
  COUNT(*) AS total_rows,
  COUNT(CASE WHEN published_at >= NOW() - INTERVAL '72 hours' THEN 1 END) AS last_72h,
  COUNT(CASE WHEN published_at >= NOW() - INTERVAL '30 days' THEN 1 END) AS last_30d,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '72 hours' THEN 1 END) AS created_72h,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) AS created_30d
FROM news_trends;

\echo ''

-- ============================================================================
-- PART 6: Check news_trends schema
-- ============================================================================
\echo '--- PART 6: news_trends Columns ---'
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'news_trends'
  AND column_name IN ('id', 'rank', 'popularity_score', 'view_count', 'web_view_count')
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- PART 7: Sample news_trends rows
-- ============================================================================
\echo '--- PART 7: Sample news_trends Rows (Top 3 by popularity_score) ---'
SELECT 
  id,
  LEFT(title, 60) AS title_preview,
  popularity_score,
  view_count,
  published_at,
  created_at,
  updated_at
FROM news_trends
WHERE title IS NOT NULL
ORDER BY 
  popularity_score DESC NULLS LAST,
  created_at DESC NULLS LAST
LIMIT 3;

\echo ''

-- ============================================================================
-- PART 8: System Metadata
-- ============================================================================
\echo '--- PART 8: System Metadata ---'
SELECT key, value, updated_at
FROM system_meta
WHERE key IN (
  'home_view_version',
  'home_view_canonical',
  'home_limit',
  'top3_max',
  'home_freshness_policy',
  'news_last_updated'
)
ORDER BY key;

\echo ''

-- ============================================================================
-- PART 9: Check util_has_column RPC
-- ============================================================================
\echo '--- PART 9: RPC Function Check ---'
SELECT 
  proname AS function_name,
  prosecdef AS is_security_definer,
  provolatile AS volatility
FROM pg_proc
WHERE proname = 'util_has_column'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

\echo ''
\echo '========================================='
\echo 'END OF DIAGNOSTIC REPORT'
\echo '========================================='

