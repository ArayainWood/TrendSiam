-- ===================================================================
-- Test Date Filtering Logic in Views
-- ===================================================================

\echo '=== 1. BANGKOK TODAY (What the view uses) ==='
SELECT date((now() AT TIME ZONE 'Asia/Bangkok')) as bangkok_today;

\echo ''
\echo '=== 2. NEWS_TRENDS - Count by snapshot_date (last 3 days) ==='
SELECT 
    COALESCE(date, DATE(created_at AT TIME ZONE 'Asia/Bangkok')) as effective_snapshot_date,
    COUNT(*) as row_count,
    MIN(title) as sample_title
FROM news_trends
GROUP BY COALESCE(date, DATE(created_at AT TIME ZONE 'Asia/Bangkok'))
ORDER BY effective_snapshot_date DESC
LIMIT 3;

\echo ''
\echo '=== 3. VIEW FILTERING TEST - Simulate today_items CTE ==='
WITH thai_today AS (
    SELECT date((now() AT TIME ZONE 'Asia/Bangkok')) AS today
)
SELECT 
    COUNT(*) as today_count,
    MIN(title) as sample_title,
    (SELECT today FROM thai_today) as filtering_for_date
FROM news_trends nt
WHERE COALESCE(nt.date, DATE(nt.created_at AT TIME ZONE 'Asia/Bangkok')) = (SELECT today FROM thai_today);

\echo ''
\echo '=== 4. CHECK IF TODAY ITEMS MATCH ==='
SELECT 
    nt.id,
    nt.title,
    nt.date as date_column,
    DATE(nt.created_at AT TIME ZONE 'Asia/Bangkok') as created_bangkok_date,
    COALESCE(nt.date, DATE(nt.created_at AT TIME ZONE 'Asia/Bangkok')) as effective_snapshot
FROM news_trends nt
WHERE COALESCE(nt.date, DATE(nt.created_at AT TIME ZONE 'Asia/Bangkok')) = date((now() AT TIME ZONE 'Asia/Bangkok'))
ORDER BY nt.popularity_score DESC NULLS LAST
LIMIT 5;

\echo ''
\echo '=== 5. ACTUAL VIEW QUERY RESULTS ==='
SELECT 
    id,
    title,
    snapshot_date,
    rank,
    popularity_score
FROM public_v_home_news
ORDER BY rank
LIMIT 5;

