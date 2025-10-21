-- ===================================================================
-- TrendSiam Evidence Gathering - Stale Home Feed Investigation
-- Created: 2025-10-14
-- Purpose: Gather evidence about current DB state vs expected state
-- ===================================================================

\echo '=== 1. CURRENT TIMESTAMPS (UTC vs Asia/Bangkok) ==='
SELECT 
    now() AT TIME ZONE 'UTC' as db_utc_now,
    now() AT TIME ZONE 'Asia/Bangkok' as db_bangkok_now,
    CURRENT_DATE AT TIME ZONE 'Asia/Bangkok' as db_bangkok_date;

\echo ''
\echo '=== 2. SYSTEM_META - Schema Versions & Timestamps ==='
SELECT 
    key, 
    value, 
    updated_at AT TIME ZONE 'Asia/Bangkok' as updated_at_bangkok
FROM system_meta 
WHERE key IN (
    'home_view_version', 
    'home_view_canonical', 
    'home_freshness_policy',
    'news_last_updated',
    'last_pipeline_run',
    'last_successful_run'
)
ORDER BY key;

\echo ''
\echo '=== 3. NEWS_TRENDS - Row Count by Date (Last 7 Days) ==='
SELECT 
    DATE(created_at AT TIME ZONE 'Asia/Bangkok') as bangkok_date,
    COUNT(*) as row_count,
    MIN(created_at AT TIME ZONE 'Asia/Bangkok') as first_created_bangkok,
    MAX(created_at AT TIME ZONE 'Asia/Bangkok') as last_created_bangkok
FROM news_trends
WHERE created_at >= now() - interval '7 days'
GROUP BY DATE(created_at AT TIME ZONE 'Asia/Bangkok')
ORDER BY bangkok_date DESC;

\echo ''
\echo '=== 4. NEWS_TRENDS - Check for "date" Column (snapshot_date source) ==='
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'news_trends' 
    AND column_name IN ('date', 'snapshot_date', 'summary_date', 'created_at')
ORDER BY column_name;

\echo ''
\echo '=== 5. NEWS_TRENDS - Sample Row Dates ==='
SELECT 
    id,
    title,
    CASE 
        WHEN column_name = 'date' THEN 
            (SELECT date FROM news_trends WHERE id = nt.id)
        ELSE NULL
    END as date_field,
    DATE(created_at AT TIME ZONE 'Asia/Bangkok') as created_bangkok_date,
    published_at AT TIME ZONE 'Asia/Bangkok' as published_at_bangkok,
    created_at,
    updated_at
FROM news_trends nt
CROSS JOIN (SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'news_trends' AND column_name = 'date' LIMIT 1) cols
ORDER BY created_at DESC
LIMIT 5;

\echo ''
\echo '=== 6. HOME VIEWS - Row Counts ==='
SELECT 
    'home_feed_v1' as view_name,
    COUNT(*) as row_count
FROM home_feed_v1
UNION ALL
SELECT 
    'public_v_home_news' as view_name,
    COUNT(*) as row_count
FROM public_v_home_news;

\echo ''
\echo '=== 7. HOME_FEED_V1 - Column Count ==='
SELECT COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'home_feed_v1';

\echo ''
\echo '=== 8. HOME_FEED_V1 - Sample Top 3 Rows ==='
SELECT 
    id,
    title,
    rank,
    is_top3,
    popularity_score,
    image_url IS NOT NULL as has_image,
    video_views,
    web_view_count,
    DATE(updated_at AT TIME ZONE 'Asia/Bangkok') as updated_bangkok_date
FROM home_feed_v1
ORDER BY rank ASC
LIMIT 3;

\echo ''
\echo '=== 9. PIPELINE METADATA - Last Update Indicators ==='
SELECT 
    key,
    value,
    updated_at AT TIME ZONE 'Asia/Bangkok' as updated_at_bangkok,
    age(now(), updated_at) as time_since_update
FROM system_meta
WHERE key LIKE '%last%' OR key LIKE '%updated%'
ORDER BY updated_at DESC
LIMIT 10;

\echo ''
\echo '=== 10. AI_IMAGES - Recent Activity ==='
SELECT 
    COUNT(*) as total_ai_images,
    COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours') as created_last_24h,
    MAX(created_at AT TIME ZONE 'Asia/Bangkok') as last_created_bangkok
FROM ai_images;

\echo ''
\echo '=== EVIDENCE GATHERING COMPLETE ==='

