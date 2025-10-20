/**
 * COMPREHENSIVE HOME FEED AUDIT - Full Data Investigation
 * Purpose: Identify root cause of "mostly high scores (78+)" symptom
 * Date: 2025-10-09
 * 
 * This script checks:
 * 1. Raw data in news_trends (score distribution, dates, counts)
 * 2. View output (public_v_home_news, home_feed_v1)
 * 3. Filtering logic (WHERE clauses, score thresholds)
 * 4. Timezone handling (published_at vs snapshot_date)
 * 5. Ordering logic (rank assignment)
 */

\set ON_ERROR_STOP off
\timing on

\echo ''
\echo '============================================================================'
\echo 'PHASE 1: RAW DATA INVENTORY (news_trends base table)'
\echo '============================================================================'
\echo ''

-- 1.1: Total count and platform distribution
\echo '--- 1.1: Total Records by Platform ---'
SELECT 
  platform,
  COUNT(*) AS total_records
FROM news_trends
GROUP BY platform
ORDER BY total_records DESC;

\echo ''
\echo '--- 1.2: Popularity Score Distribution (ALL records) ---'
SELECT 
  score_range,
  record_count,
  percentage
FROM (
  SELECT 
    CASE
      WHEN popularity_score IS NULL THEN 'NULL'
      WHEN popularity_score >= 95 THEN '95-100 (Top Tier)'
      WHEN popularity_score >= 85 THEN '85-94 (Excellent)'
      WHEN popularity_score >= 78 THEN '78-84 (Very Good)'
      WHEN popularity_score >= 70 THEN '70-77 (Good)'
      WHEN popularity_score >= 50 THEN '50-69 (Average)'
      WHEN popularity_score >= 30 THEN '30-49 (Below Average)'
      ELSE '0-29 (Low)'
    END AS score_range,
    COUNT(*) AS record_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percentage,
    CASE
      WHEN popularity_score IS NULL THEN 0
      WHEN popularity_score >= 95 THEN 95
      WHEN popularity_score >= 85 THEN 85
      WHEN popularity_score >= 78 THEN 78
      WHEN popularity_score >= 70 THEN 70
      WHEN popularity_score >= 50 THEN 50
      WHEN popularity_score >= 30 THEN 30
      ELSE 0
    END AS sort_order
  FROM news_trends
  GROUP BY score_range, sort_order
) AS score_dist
ORDER BY sort_order DESC;

\echo ''
\echo '--- 1.3: Score Statistics ---'
SELECT 
  COUNT(*) AS total_records,
  COUNT(popularity_score) AS records_with_score,
  MIN(popularity_score) AS min_score,
  ROUND(AVG(popularity_score)::numeric, 2) AS avg_score,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY popularity_score) AS median_score,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY popularity_score) AS p25_score,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY popularity_score) AS p75_score,
  MAX(popularity_score) AS max_score
FROM news_trends;

\echo ''
\echo '--- 1.4: Records by Date (Thai TZ) - Last 7 Days ---'
WITH dated_records AS (
  SELECT 
    DATE(COALESCE(published_at, created_at) AT TIME ZONE 'Asia/Bangkok') AS thai_date,
    COUNT(*) AS record_count,
    COUNT(CASE WHEN popularity_score >= 78 THEN 1 END) AS high_score_count,
    ROUND(AVG(popularity_score)::numeric, 2) AS avg_score
  FROM news_trends
  WHERE COALESCE(published_at, created_at) >= NOW() - INTERVAL '7 days'
  GROUP BY thai_date
)
SELECT 
  thai_date,
  record_count,
  high_score_count,
  ROUND(high_score_count * 100.0 / NULLIF(record_count, 0), 2) AS high_score_percentage,
  avg_score,
  CASE 
    WHEN thai_date = CURRENT_DATE AT TIME ZONE 'Asia/Bangkok' THEN '← TODAY'
    ELSE ''
  END AS marker
FROM dated_records
ORDER BY thai_date DESC;

\echo ''
\echo '============================================================================'
\echo 'PHASE 2: VIEW DEFINITION AUDIT'
\echo '============================================================================'
\echo ''

\echo '--- 2.1: Check View Exists and Row Count ---'
SELECT 
  'public_v_home_news' AS view_name,
  COUNT(*) AS row_count
FROM public_v_home_news
UNION ALL
SELECT 
  'home_feed_v1' AS view_name,
  COUNT(*) AS row_count
FROM home_feed_v1;

\echo ''
\echo '--- 2.2: View Score Distribution (public_v_home_news) ---'
WITH score_dist AS (
  SELECT 
    CASE
      WHEN popularity_score IS NULL THEN 'NULL'
      WHEN popularity_score >= 95 THEN '95-100 (Top Tier)'
      WHEN popularity_score >= 85 THEN '85-94 (Excellent)'
      WHEN popularity_score >= 78 THEN '78-84 (Very Good)'
      WHEN popularity_score >= 70 THEN '70-77 (Good)'
      WHEN popularity_score >= 50 THEN '50-69 (Average)'
      WHEN popularity_score >= 30 THEN '30-49 (Below Average)'
      ELSE '0-29 (Low)'
    END AS score_range,
    CASE
      WHEN popularity_score IS NULL THEN 0
      WHEN popularity_score >= 95 THEN 95
      WHEN popularity_score >= 85 THEN 85
      WHEN popularity_score >= 78 THEN 78
      WHEN popularity_score >= 70 THEN 70
      WHEN popularity_score >= 50 THEN 50
      WHEN popularity_score >= 30 THEN 30
      ELSE 0
    END AS sort_order
  FROM public_v_home_news
)
SELECT 
  score_range,
  COUNT(*) AS view_count
FROM score_dist
GROUP BY score_range, sort_order
ORDER BY sort_order DESC;

\echo ''
\echo '--- 2.3: View Score Distribution (home_feed_v1) ---'
WITH score_dist AS (
  SELECT 
    CASE
      WHEN popularity_score IS NULL THEN 'NULL'
      WHEN popularity_score >= 95 THEN '95-100 (Top Tier)'
      WHEN popularity_score >= 85 THEN '85-94 (Excellent)'
      WHEN popularity_score >= 78 THEN '78-84 (Very Good)'
      WHEN popularity_score >= 70 THEN '70-77 (Good)'
      WHEN popularity_score >= 50 THEN '50-69 (Average)'
      WHEN popularity_score >= 30 THEN '30-49 (Below Average)'
      ELSE '0-29 (Low)'
    END AS score_range,
    CASE
      WHEN popularity_score IS NULL THEN 0
      WHEN popularity_score >= 95 THEN 95
      WHEN popularity_score >= 85 THEN 85
      WHEN popularity_score >= 78 THEN 78
      WHEN popularity_score >= 70 THEN 70
      WHEN popularity_score >= 50 THEN 50
      WHEN popularity_score >= 30 THEN 30
      ELSE 0
    END AS sort_order
  FROM home_feed_v1
)
SELECT 
  score_range,
  COUNT(*) AS view_count
FROM score_dist
GROUP BY score_range, sort_order
ORDER BY sort_order DESC;

\echo ''
\echo '--- 2.4: Check for Hidden WHERE Filters in View Definition ---'
SELECT 
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE viewname IN ('public_v_home_news', 'home_feed_v1')
ORDER BY viewname;

\echo ''
\echo '============================================================================'
\echo 'PHASE 3: TOP 20 ANALYSIS (What API returns)'
\echo '============================================================================'
\echo ''

\echo '--- 3.1: First 20 Items by Rank (as API would return) ---'
SELECT 
  rank,
  LEFT(title, 40) AS title,
  ROUND(popularity_score::numeric, 2) AS score,
  is_top3,
  video_views,
  growth_rate_label,
  DATE(published_at AT TIME ZONE 'Asia/Bangkok') AS published_date_thai
FROM home_feed_v1
WHERE rank IS NOT NULL
ORDER BY rank ASC
LIMIT 20;

\echo ''
\echo '--- 3.2: Score Statistics for Top 20 ---'
WITH top_20 AS (
  SELECT popularity_score
  FROM home_feed_v1
  WHERE rank IS NOT NULL
  ORDER BY rank ASC
  LIMIT 20
)
SELECT 
  COUNT(*) AS total_items,
  MIN(popularity_score) AS min_score,
  ROUND(AVG(popularity_score)::numeric, 2) AS avg_score,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY popularity_score) AS median_score,
  MAX(popularity_score) AS max_score,
  COUNT(CASE WHEN popularity_score >= 78 THEN 1 END) AS items_above_78,
  ROUND(COUNT(CASE WHEN popularity_score >= 78 THEN 1 END) * 100.0 / COUNT(*), 2) AS pct_above_78,
  COUNT(CASE WHEN popularity_score < 70 THEN 1 END) AS items_below_70
FROM top_20;

\echo ''
\echo '============================================================================'
\echo 'PHASE 4: RANKING LOGIC INVESTIGATION'
\echo '============================================================================'
\echo ''

\echo '--- 4.1: Check Rank Assignment Logic ---'
-- This shows how ranks are assigned and if there's any filtering before ranking
SELECT 
  nt.id,
  LEFT(nt.title, 40) AS title,
  nt.popularity_score AS base_score,
  nt.platform,
  LOWER(nt.platform) = 'youtube' AS passes_platform_filter,
  ROW_NUMBER() OVER (ORDER BY COALESCE(nt.popularity_score, 0) DESC) AS computed_rank,
  DATE(COALESCE(nt.published_at, nt.created_at) AT TIME ZONE 'Asia/Bangkok') AS thai_date
FROM news_trends nt
WHERE LOWER(nt.platform) = 'youtube'
  AND nt.title IS NOT NULL
  AND nt.title != ''
ORDER BY computed_rank
LIMIT 20;

\echo ''
\echo '--- 4.2: Check if Low-Score Items Exist but Are Ranked Lower ---'
SELECT 
  'Rank 1-20' AS rank_group,
  COUNT(*) AS item_count,
  MIN(popularity_score) AS min_score,
  ROUND(AVG(popularity_score)::numeric, 2) AS avg_score,
  MAX(popularity_score) AS max_score
FROM home_feed_v1
WHERE rank BETWEEN 1 AND 20

UNION ALL

SELECT 
  'Rank 21-50' AS rank_group,
  COUNT(*) AS item_count,
  MIN(popularity_score) AS min_score,
  ROUND(AVG(popularity_score)::numeric, 2) AS avg_score,
  MAX(popularity_score) AS max_score
FROM home_feed_v1
WHERE rank BETWEEN 21 AND 50

UNION ALL

SELECT 
  'Rank 51-100' AS rank_group,
  COUNT(*) AS item_count,
  MIN(popularity_score) AS min_score,
  ROUND(AVG(popularity_score)::numeric, 2) AS avg_score,
  MAX(popularity_score) AS max_score
FROM home_feed_v1
WHERE rank BETWEEN 51 AND 100;

\echo ''
\echo '============================================================================'
\echo 'PHASE 5: TIMEZONE & DATE CONSISTENCY CHECK'
\echo '============================================================================'
\echo ''

\echo '--- 5.1: Check Timezone Handling ---'
SELECT 
  NOW() AS utc_now,
  NOW() AT TIME ZONE 'Asia/Bangkok' AS bangkok_now,
  CURRENT_DATE AS utc_date,
  CURRENT_DATE AT TIME ZONE 'Asia/Bangkok' AS bangkok_date_incorrect,
  DATE(NOW() AT TIME ZONE 'Asia/Bangkok') AS bangkok_date_correct;

\echo ''
\echo '--- 5.2: Sample Records - Published Date vs Snapshot Date ---'
SELECT 
  id,
  LEFT(title, 35) AS title,
  published_at AS published_at_utc,
  DATE(published_at AT TIME ZONE 'Asia/Bangkok') AS published_date_thai,
  created_at AS created_at_utc,
  DATE(created_at AT TIME ZONE 'Asia/Bangkok') AS created_date_thai
FROM news_trends
WHERE LOWER(platform) = 'youtube'
ORDER BY created_at DESC
LIMIT 5;

\echo ''
\echo '============================================================================'
\echo 'PHASE 6: DEPENDENCY CHECK (snapshots, stories tables)'
\echo '============================================================================'
\echo ''

\echo '--- 6.1: Check Snapshots Table ---'
SELECT 
  COUNT(*) AS total_snapshots,
  COUNT(DISTINCT story_id) AS unique_stories,
  MIN(snapshot_date) AS earliest_snapshot,
  MAX(snapshot_date) AS latest_snapshot,
  COUNT(CASE WHEN snapshot_date >= NOW() - INTERVAL '72 hours' THEN 1 END) AS snapshots_72h,
  COUNT(CASE WHEN snapshot_date >= NOW() - INTERVAL '7 days' THEN 1 END) AS snapshots_7d
FROM snapshots;

\echo ''
\echo '--- 6.2: Check Stories Table ---'
SELECT 
  COUNT(*) AS total_stories,
  COUNT(summary_en) AS stories_with_en_summary,
  COUNT(ai_image_prompt) AS stories_with_prompt
FROM stories;

\echo ''
\echo '============================================================================'
\echo 'DIAGNOSIS SUMMARY'
\echo '============================================================================'
\echo ''
\echo 'Review the above output to identify:'
\echo '1. Is the base data (news_trends) diverse in scores, or mostly high?'
\echo '2. Does the view filter out low-score items via WHERE clause?'
\echo '3. Does the API LIMIT 20 happen AFTER sorting, showing only top-ranked items?'
\echo '4. Is there a timezone issue causing wrong-day filtering?'
\echo '5. Are low-score items present but ranked beyond position 20?'
\echo ''
\echo 'Expected: If symptom is real, we should see:'
\echo '  - Diverse scores in news_trends (0-100 range)'
\echo '  - Only high scores (78+) in Top 20'
\echo '  - Low scores exist but ranked in positions 21+'
\echo ''
\echo 'Audit complete. Save this output for AUDIT_REPORT.md.'
\echo '============================================================================'

