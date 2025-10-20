-- ============================================================================
-- Verification: util_has_column RPC Function
-- ============================================================================
-- Date: 2025-10-06
-- Purpose: Verify that util_has_column function works correctly
-- Run after: 2025-10-06_util_has_column.sql
-- ============================================================================

-- Test 1: Check for existing column (should return true)
SELECT 
  'Test 1: Existing column' AS test_name,
  public.util_has_column('home_feed_v1', 'web_view_count') AS result,
  CASE 
    WHEN public.util_has_column('home_feed_v1', 'web_view_count') = true 
    THEN '✅ PASS' 
    ELSE '❌ FAIL' 
  END AS status;

-- Test 2: Check for non-existent column (should return false)
SELECT 
  'Test 2: Non-existent column' AS test_name,
  public.util_has_column('home_feed_v1', 'non_existent_column') AS result,
  CASE 
    WHEN public.util_has_column('home_feed_v1', 'non_existent_column') = false 
    THEN '✅ PASS' 
    ELSE '❌ FAIL' 
  END AS status;

-- Test 3: Check for non-existent view (should return false)
SELECT 
  'Test 3: Non-existent view' AS test_name,
  public.util_has_column('non_existent_view', 'some_column') AS result,
  CASE 
    WHEN public.util_has_column('non_existent_view', 'some_column') = false 
    THEN '✅ PASS' 
    ELSE '❌ FAIL' 
  END AS status;

-- Test 4: Verify grants (should not error when called as anon)
-- Note: This requires manual testing via PostgREST or Supabase client
SELECT 
  'Test 4: Function grants' AS test_name,
  'Run via anon client to verify' AS instruction,
  '⚠️  MANUAL' AS status;

-- Test 5: Verify all expected columns in home_feed_v1
WITH expected_columns AS (
  SELECT unnest(ARRAY[
    'id', 'title', 'summary', 'summary_en', 'category', 
    'platform', 'channel', 'published_at', 'source_url', 
    'image_url', 'ai_prompt', 'popularity_score', 'rank', 
    'is_top3', 'views', 'likes', 'comments', 
    'growth_rate_value', 'growth_rate_label', 'ai_opinion', 
    'score_details', 'video_id', 'external_id', 
    'platform_mentions', 'keywords', 'updated_at', 'web_view_count'
  ]) AS col_name
),
column_checks AS (
  SELECT 
    col_name,
    public.util_has_column('home_feed_v1', col_name) AS exists
  FROM expected_columns
)
SELECT 
  'Test 5: All expected columns' AS test_name,
  COUNT(*) AS total_columns,
  SUM(CASE WHEN exists THEN 1 ELSE 0 END) AS present_columns,
  CASE 
    WHEN COUNT(*) = SUM(CASE WHEN exists THEN 1 ELSE 0 END) 
    THEN '✅ PASS' 
    ELSE '❌ FAIL' 
  END AS status
FROM column_checks;

-- Show any missing columns (should be empty)
WITH expected_columns AS (
  SELECT unnest(ARRAY[
    'id', 'title', 'summary', 'summary_en', 'category', 
    'platform', 'channel', 'published_at', 'source_url', 
    'image_url', 'ai_prompt', 'popularity_score', 'rank', 
    'is_top3', 'views', 'likes', 'comments', 
    'growth_rate_value', 'growth_rate_label', 'ai_opinion', 
    'score_details', 'video_id', 'external_id', 
    'platform_mentions', 'keywords', 'updated_at', 'web_view_count'
  ]) AS col_name
),
column_checks AS (
  SELECT 
    col_name,
    public.util_has_column('home_feed_v1', col_name) AS exists
  FROM expected_columns
)
SELECT 
  'Missing columns (should be empty)' AS info,
  string_agg(col_name, ', ') AS missing_columns
FROM column_checks
WHERE NOT exists;

-- Summary
SELECT 
  '=== VERIFICATION SUMMARY ===' AS title,
  'All tests should show ✅ PASS' AS expected,
  'If any test shows ❌ FAIL, check migration' AS action;
