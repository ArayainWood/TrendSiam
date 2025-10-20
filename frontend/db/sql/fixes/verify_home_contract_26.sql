-- =========================================================
-- VERIFY HOME VIEW 26-COLUMN CONTRACT
-- Date: 2025-09-23
--
-- Ensures public_v_home_news has exactly the 26 columns
-- expected by mapNews.ts, no more, no less.
-- =========================================================

\echo '========================================='
\echo 'HOME VIEW 26-COLUMN CONTRACT VERIFICATION'
\echo '========================================='
\echo ''

-- 1) Expected 26 columns (must match mapNews.ts)
WITH expected(col) AS (VALUES
  ('id'),('title'),('summary'),('summary_en'),('category'),
  ('platform'),('channel'),('published_at'),('source_url'),
  ('image_url'),('ai_prompt'),('popularity_score'),('rank'),
  ('is_top3'),('views'),('likes'),('comments'),
  ('growth_rate_value'),('growth_rate_label'),
  ('ai_opinion'),('score_details'),
  ('video_id'),('external_id'),('platform_mentions'),
  ('keywords'),('updated_at')
),
actual AS (
  SELECT column_name AS col
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='public_v_home_news'
)
SELECT 'missing' AS kind, e.col 
FROM expected e 
LEFT JOIN actual a ON a.col=e.col 
WHERE a.col IS NULL
UNION ALL
SELECT 'unexpected' AS kind, a.col 
FROM actual a 
LEFT JOIN expected e ON e.col=a.col 
WHERE e.col IS NULL;

-- Summary check
\echo ''
\echo 'SUMMARY:'

WITH expected_count AS (
  SELECT 26 as expected
),
actual_count AS (
  SELECT COUNT(*) as actual
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='public_v_home_news'
)
SELECT 
  CASE 
    WHEN a.actual = e.expected THEN '✅ PASS: Exactly 26 columns'
    WHEN a.actual < e.expected THEN '❌ FAIL: Only ' || a.actual || ' columns (expected 26)'
    WHEN a.actual > e.expected THEN '❌ FAIL: Too many columns (' || a.actual || ', expected 26)'
  END as contract_status,
  a.actual as column_count
FROM expected_count e, actual_count a;

-- List all columns in order
\echo ''
\echo 'ACTUAL COLUMNS IN VIEW:'
SELECT 
  ordinal_position,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema='public' 
  AND table_name='public_v_home_news'
ORDER BY ordinal_position;

\echo ''
\echo '========================================='
\echo 'CONTRACT VERIFICATION COMPLETE'
\echo '========================================='
