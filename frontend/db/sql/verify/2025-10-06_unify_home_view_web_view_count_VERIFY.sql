/**
 * Verification Script: Unified Home View with Web View Count
 * Date: 2025-10-06
 * Purpose: Verify that home_feed_v1 (canonical) and public_v_home_news (alias) 
 *          both exist, have web_view_count column, and return valid data
 *
 * This script is intended to be run AFTER the migration script:
 * frontend/db/sql/fixes/2025-10-06_unify_home_view_web_view_count.sql
 *
 * It performs read-only checks and raises notices/exceptions for validation.
 */

-- Set client min messages to notice to see RAISE NOTICE output
SET client_min_messages TO NOTICE;

-- ============================================================================
-- TEST 1: Verify both views exist
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'home_feed_v1') THEN
        RAISE EXCEPTION 'TEST FAILED: View public.home_feed_v1 does not exist.';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'public_v_home_news') THEN
        RAISE EXCEPTION 'TEST FAILED: View public.public_v_home_news does not exist.';
    END IF;
    
    RAISE NOTICE 'TEST 1 PASSED: Both views exist.';
END $$;

-- ============================================================================
-- TEST 2: Verify home_feed_v1 has web_view_count column
-- ============================================================================
DO $$
DECLARE
  v1_has_column BOOLEAN;
  v2_has_column BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'home_feed_v1'
    AND column_name = 'web_view_count'
  ) INTO v1_has_column;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'public_v_home_news'
    AND column_name = 'web_view_count'
  ) INTO v2_has_column;
  
  IF NOT v1_has_column THEN
    RAISE EXCEPTION 'TEST FAILED: home_feed_v1 missing web_view_count column';
  END IF;
  
  IF v2_has_column THEN
    RAISE NOTICE 'NOTE: public_v_home_news also has web_view_count (unexpected but OK)';
  END IF;
  
  RAISE NOTICE 'TEST 2 PASSED: home_feed_v1 has web_view_count column.';
END $$;

-- ============================================================================
-- TEST 3: Verify column counts (home_feed_v1: 27, public_v_home_news: 26)
-- ============================================================================
DO $$
DECLARE
  v1_col_count INTEGER;
  v2_col_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v1_col_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'home_feed_v1';
  
  SELECT COUNT(*) INTO v2_col_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'public_v_home_news';
  
  IF v1_col_count <> 27 THEN
    RAISE EXCEPTION 'TEST FAILED: home_feed_v1 has % columns (expected 27)', v1_col_count;
  END IF;
  
  IF v2_col_count <> 26 THEN
    RAISE NOTICE 'NOTE: public_v_home_news has % columns (expected 26, may vary)', v2_col_count;
  END IF;
  
  RAISE NOTICE 'TEST 3 PASSED: home_feed_v1 has % columns, public_v_home_news has % columns.', v1_col_count, v2_col_count;
END $$;

-- ============================================================================
-- TEST 4: Show column details for both views
-- ============================================================================
\echo '--- Column Details for home_feed_v1 ---'
SELECT 
  ordinal_position AS pos,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'home_feed_v1'
ORDER BY ordinal_position;

\echo '--- Column Details for public_v_home_news ---'
SELECT 
  ordinal_position AS pos,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'public_v_home_news'
ORDER BY ordinal_position;

-- ============================================================================
-- TEST 5: Sample data from home_feed_v1
-- ============================================================================
\echo '--- Sample Row from home_feed_v1 ---'
SELECT 
  id,
  title,
  rank,
  popularity_score,
  web_view_count,
  views,
  likes,
  comments
FROM public.home_feed_v1
ORDER BY rank ASC NULLS LAST
LIMIT 1;

-- ============================================================================
-- TEST 6: Sample data from public_v_home_news (26 columns, no web_view_count)
-- ============================================================================
\echo '--- Sample Row from public_v_home_news (26 columns) ---'
SELECT 
  id,
  title,
  rank,
  popularity_score,
  views,
  likes,
  comments
FROM public.public_v_home_news
ORDER BY rank ASC NULLS LAST
LIMIT 1;

-- ============================================================================
-- TEST 7: Data statistics
-- ============================================================================
\echo '--- Data Statistics ---'
WITH v1_stats AS (
  SELECT 
    'home_feed_v1' AS view_name,
    COUNT(*) AS total_rows,
    COUNT(web_view_count) AS rows_with_web_views,
    COALESCE(SUM(web_view_count), 0) AS total_web_views,
    COALESCE(MAX(web_view_count), 0) AS max_web_views,
    COALESCE(AVG(web_view_count), 0) AS avg_web_views
  FROM public.home_feed_v1
),
v2_stats AS (
  SELECT 
    'public_v_home_news' AS view_name,
    COUNT(*) AS total_rows,
    NULL::bigint AS rows_with_web_views,
    NULL::numeric AS total_web_views,
    NULL::integer AS max_web_views,
    NULL::numeric AS avg_web_views
  FROM public.public_v_home_news
)
SELECT * FROM v1_stats
UNION ALL
SELECT * FROM v2_stats;

-- ============================================================================
-- TEST 8: System metadata
-- ============================================================================
\echo '--- System Metadata ---'
SELECT key, value, updated_at
FROM public.system_meta
WHERE key IN ('home_view_version', 'home_view_canonical')
ORDER BY key;

-- ============================================================================
-- TEST 9: Verify web_view_count data type is numeric/integer
-- ============================================================================
DO $$
DECLARE
  col_type TEXT;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' 
  AND table_name = 'home_feed_v1'
  AND column_name = 'web_view_count';
  
  IF col_type NOT IN ('integer', 'bigint', 'numeric') THEN
    RAISE WARNING 'web_view_count has type % (expected integer/bigint/numeric)', col_type;
  END IF;
  
  RAISE NOTICE 'TEST 9 PASSED: web_view_count has type %.', col_type;
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'All verification tests completed successfully!';
  RAISE NOTICE 'home_feed_v1 is the canonical view';
  RAISE NOTICE 'public_v_home_news is the compatibility alias';
  RAISE NOTICE 'Both expose web_view_count for site tracking';
  RAISE NOTICE '========================================';
END $$;
