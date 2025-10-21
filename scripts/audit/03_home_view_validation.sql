/**
 * Home View Validation
 * Part of TrendSiam Comprehensive Audit
 * 
 * Validates:
 * - Column schema (exactly 28 columns including snapshot_date)
 * - Data completeness (published_at vs snapshot_date)
 * - Ranking logic
 * - Top-3 policy enforcement
 * - Data quality checks
 */

\set ON_ERROR_STOP off

\echo ''
\echo '================================================================================'
\echo 'HOME VIEW VALIDATION - home_feed_v1'
\echo '================================================================================'
\echo ''

-- ==============================================================================
-- 1. View Existence & Column Count
-- ==============================================================================

\echo '1. VIEW EXISTENCE & COLUMN COUNT'
\echo '--------------------------------'
\echo ''

SELECT 
  table_name AS view_name,
  COUNT(*) AS column_count,
  CASE 
    WHEN COUNT(*) = 28 THEN '✅ CORRECT (28 columns)'
    WHEN COUNT(*) = 27 THEN '⚠️  OLD (27 columns - missing snapshot_date?)'
    ELSE '❌ INCORRECT (expected 28, got ' || COUNT(*) || ')'
  END AS status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('home_feed_v1', 'public_v_home_news')
GROUP BY table_name;

\echo ''
\echo 'Expected 28 columns:'
\echo 'id, title, summary, summary_en, category, platform, channel,'
\echo 'published_at, snapshot_date, source_url, image_url, ai_prompt,'
\echo 'popularity_score, rank, is_top3, views, likes, comments,'
\echo 'growth_rate_value, growth_rate_label, ai_opinion, score_details,'
\echo 'video_id, external_id, platform_mentions, keywords, updated_at, web_view_count'
\echo ''

-- ==============================================================================
-- 2. Column List Verification
-- ==============================================================================

\echo '2. COLUMN LIST (home_feed_v1)'
\echo '-----------------------------'
\echo ''

SELECT 
  ordinal_position AS pos,
  column_name,
  data_type,
  CASE WHEN is_nullable = 'YES' THEN 'NULL' ELSE 'NOT NULL' END AS nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'home_feed_v1'
ORDER BY ordinal_position;

\echo ''

-- ==============================================================================
-- 3. Critical Columns Check
-- ==============================================================================

\echo '3. CRITICAL COLUMNS CHECK'
\echo '-------------------------'
\echo ''

WITH expected_cols AS (
  SELECT unnest(ARRAY[
    'id', 'title', 'summary', 'published_at', 'snapshot_date', 
    'source_url', 'popularity_score', 'rank', 'is_top3'
  ]) AS col_name
),
actual_cols AS (
  SELECT column_name AS col_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'home_feed_v1'
)
SELECT 
  e.col_name,
  CASE 
    WHEN a.col_name IS NOT NULL THEN '✅ Present'
    ELSE '❌ MISSING'
  END AS status
FROM expected_cols e
LEFT JOIN actual_cols a ON a.col_name = e.col_name
ORDER BY e.col_name;

\echo ''

-- ==============================================================================
-- 4. Row Count & Data Sample
-- ==============================================================================

\echo '4. ROW COUNT & DATA SAMPLE'
\echo '--------------------------'
\echo ''

SELECT COUNT(*) AS total_rows FROM home_feed_v1;

\echo ''
\echo 'Top 5 rows (by rank):'
\echo ''

SELECT 
  rank,
  id,
  LEFT(title, 50) AS title_preview,
  popularity_score,
  is_top3,
  published_at IS NOT NULL AS has_published_at,
  snapshot_date IS NOT NULL AS has_snapshot_date
FROM home_feed_v1
ORDER BY rank ASC NULLS LAST
LIMIT 5;

\echo ''

-- ==============================================================================
-- 5. Published_at vs Snapshot_date Analysis
-- ==============================================================================

\echo '5. PUBLISHED_AT vs SNAPSHOT_DATE ANALYSIS'
\echo '------------------------------------------'
\echo ''

WITH coverage AS (
  SELECT 
    COUNT(*) AS total,
    COUNT(published_at) AS has_published,
    COUNT(snapshot_date) AS has_snapshot,
    COUNT(CASE WHEN published_at IS NULL AND snapshot_date IS NOT NULL THEN 1 END) AS snapshot_only,
    COUNT(CASE WHEN published_at IS NOT NULL AND snapshot_date IS NULL THEN 1 END) AS published_only,
    COUNT(CASE WHEN published_at IS NOT NULL AND snapshot_date IS NOT NULL THEN 1 END) AS has_both
  FROM home_feed_v1
)
SELECT 
  total,
  has_published,
  ROUND(100.0 * has_published / NULLIF(total, 0), 1) AS published_pct,
  has_snapshot,
  ROUND(100.0 * has_snapshot / NULLIF(total, 0), 1) AS snapshot_pct,
  has_both,
  snapshot_only,
  published_only,
  CASE 
    WHEN has_snapshot = total THEN '✅ All items have snapshot_date'
    ELSE '❌ Some items missing snapshot_date'
  END AS snapshot_status,
  CASE 
    WHEN has_published >= total * 0.9 THEN '✅ Good published_at coverage (≥90%)'
    WHEN has_published >= total * 0.5 THEN '⚠️  Fair published_at coverage (≥50%)'
    ELSE '❌ Low published_at coverage (<50%)'
  END AS published_status
FROM coverage;

\echo ''

-- ==============================================================================
-- 6. Ranking Logic Validation
-- ==============================================================================

\echo '6. RANKING LOGIC VALIDATION'
\echo '---------------------------'
\echo ''

SELECT 
  rank,
  id,
  LEFT(title, 40) AS title,
  popularity_score,
  snapshot_date::date AS snapshot,
  published_at::date AS published
FROM home_feed_v1
WHERE rank <= 10
ORDER BY rank ASC NULLS LAST;

\echo ''
\echo 'Ranking should use snapshot_date for filtering/freshness,'
\echo 'but published_at is display-only for Story Details.'
\echo ''

-- ==============================================================================
-- 7. Top-3 Policy Enforcement
-- ==============================================================================

\echo '7. TOP-3 POLICY ENFORCEMENT'
\echo '---------------------------'
\echo ''

WITH top3_check AS (
  SELECT 
    COUNT(*) FILTER (WHERE is_top3 = TRUE) AS top3_count,
    COUNT(*) FILTER (WHERE is_top3 = TRUE AND rank <= 3) AS top3_in_first_3,
    COUNT(*) FILTER (WHERE is_top3 = TRUE AND rank > 3) AS top3_outside_first_3,
    COUNT(*) FILTER (WHERE is_top3 = TRUE AND image_url IS NOT NULL) AS top3_with_image,
    COUNT(*) FILTER (WHERE is_top3 = TRUE AND image_url IS NULL) AS top3_without_image,
    COUNT(*) FILTER (WHERE is_top3 = FALSE AND image_url IS NOT NULL) AS non_top3_with_image
  FROM home_feed_v1
)
SELECT 
  top3_count,
  CASE 
    WHEN top3_count = 3 THEN '✅ Exactly 3 Top-3 items'
    WHEN top3_count < 3 THEN '⚠️  Only ' || top3_count || ' Top-3 items (expected 3)'
    ELSE '❌ Too many Top-3 items (' || top3_count || ')'
  END AS top3_count_status,
  top3_in_first_3,
  top3_outside_first_3,
  CASE 
    WHEN top3_outside_first_3 = 0 THEN '✅ All Top-3 in ranks 1-3'
    ELSE '❌ Some Top-3 outside ranks 1-3'
  END AS top3_position_status,
  top3_with_image,
  top3_without_image,
  CASE 
    WHEN top3_with_image = top3_count THEN '✅ All Top-3 have images'
    ELSE '⚠️  ' || top3_without_image || ' Top-3 missing images'
  END AS top3_image_status,
  non_top3_with_image,
  CASE 
    WHEN non_top3_with_image = 0 THEN '✅ No non-Top3 with images'
    ELSE '❌ POLICY VIOLATION: ' || non_top3_with_image || ' non-Top3 have images'
  END AS image_policy_status
FROM top3_check;

\echo ''

-- ==============================================================================
-- 8. Data Quality Checks
-- ==============================================================================

\echo '8. DATA QUALITY CHECKS'
\echo '----------------------'
\echo ''

WITH quality AS (
  SELECT 
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE title IS NULL OR title = '') AS missing_title,
    COUNT(*) FILTER (WHERE summary IS NULL OR summary = '') AS missing_summary,
    COUNT(*) FILTER (WHERE source_url IS NULL OR source_url = '') AS missing_source_url,
    COUNT(*) FILTER (WHERE popularity_score IS NULL) AS missing_score,
    COUNT(*) FILTER (WHERE rank IS NULL) AS missing_rank
  FROM home_feed_v1
)
SELECT 
  total,
  missing_title,
  CASE WHEN missing_title = 0 THEN '✅' ELSE '❌' END AS title_status,
  missing_summary,
  CASE WHEN missing_summary = 0 THEN '✅' ELSE '⚠️ ' END AS summary_status,
  missing_source_url,
  CASE WHEN missing_source_url = 0 THEN '✅' ELSE '❌' END AS source_url_status,
  missing_score,
  CASE WHEN missing_score = 0 THEN '✅' ELSE '⚠️ ' END AS score_status,
  missing_rank,
  CASE WHEN missing_rank = 0 THEN '✅' ELSE '⚠️ ' END AS rank_status
FROM quality;

\echo ''
\echo '================================================================================'
\echo 'END OF HOME VIEW VALIDATION'
\echo '================================================================================'
\echo ''

