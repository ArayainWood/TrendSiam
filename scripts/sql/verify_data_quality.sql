-- Verify data quality for today's items
-- Run this in Supabase SQL Editor to check score_details and other fields

-- 1. Check today's top 20 items with all relevant fields
WITH today_data AS (
    SELECT 
        id,
        video_id,
        title,
        channel,
        published_date,
        view_count,
        like_count,
        comment_count,
        popularity_score_precise,
        score_details,
        growth_rate,
        platform_mentions,
        keywords,
        ai_opinion,
        summary,
        summary_en,
        description,
        date,
        updated_at
    FROM public.news_trends
    WHERE date = (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok')
    ORDER BY popularity_score_precise DESC, view_count DESC
    LIMIT 20
)
SELECT * FROM today_data;

-- 2. Summary statistics for data completeness
SELECT 
    'Total Stories' as metric,
    COUNT(*) as value
FROM public.news_trends
WHERE date = (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok')
UNION ALL
SELECT 
    'Has Score Details',
    COUNT(CASE WHEN score_details IS NOT NULL AND score_details != '' THEN 1 END)
FROM public.news_trends
WHERE date = (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok')
UNION ALL
SELECT 
    'Has Growth Rate',
    COUNT(CASE WHEN growth_rate IS NOT NULL AND growth_rate != '' AND growth_rate != 'N/A' THEN 1 END)
FROM public.news_trends
WHERE date = (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok')
UNION ALL
SELECT 
    'Has Keywords',
    COUNT(CASE WHEN keywords IS NOT NULL AND keywords != '' THEN 1 END)
FROM public.news_trends
WHERE date = (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok')
UNION ALL
SELECT 
    'Has AI Opinion',
    COUNT(CASE WHEN ai_opinion IS NOT NULL AND ai_opinion != '' THEN 1 END)
FROM public.news_trends
WHERE date = (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok')
UNION ALL
SELECT 
    'Has Platform Mentions',
    COUNT(CASE WHEN platform_mentions IS NOT NULL AND platform_mentions != '' AND platform_mentions != 'Primary platform only' THEN 1 END)
FROM public.news_trends
WHERE date = (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok');

-- 3. Sample score_details for verification
SELECT 
    video_id,
    title,
    view_count,
    like_count,
    comment_count,
    ROUND((like_count::numeric / NULLIF(view_count::numeric, 0)) * 100, 1) as calculated_like_rate,
    ROUND((comment_count::numeric / NULLIF(view_count::numeric, 0)) * 100, 1) as calculated_comment_rate,
    growth_rate,
    score_details
FROM public.news_trends
WHERE date = (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok')
    AND score_details IS NOT NULL 
    AND score_details != ''
ORDER BY popularity_score_precise DESC
LIMIT 5;

-- 4. Check for missing critical fields
SELECT 
    video_id,
    title,
    CASE WHEN channel IS NULL OR channel = '' THEN 'Missing Channel' END as channel_issue,
    CASE WHEN published_date IS NULL THEN 'Missing Published Date' END as date_issue,
    CASE WHEN view_count IS NULL OR view_count = '0' THEN 'Missing/Zero Views' END as views_issue,
    CASE WHEN score_details IS NULL OR score_details = '' THEN 'Missing Score Details' END as score_issue,
    CASE WHEN summary IS NULL OR summary = '' THEN 'Missing Summary' END as summary_issue
FROM public.news_trends
WHERE date = (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok')
    AND (
        channel IS NULL OR channel = '' OR
        published_date IS NULL OR
        view_count IS NULL OR view_count = '0' OR
        score_details IS NULL OR score_details = '' OR
        summary IS NULL OR summary = ''
    )
LIMIT 10;
