-- Verify score_details population for today's batch
-- Run this after pipeline execution to confirm score details are written

-- 1. Check today's top 20 stories have score_details
WITH today_stories AS (
    SELECT 
        id,
        video_id,
        title,
        popularity_score_precise,
        view_count,
        score_details,
        LENGTH(COALESCE(score_details, '')) as score_length,
        CASE 
            WHEN score_details IS NULL THEN 'NULL'
            WHEN score_details = '' THEN 'EMPTY'
            ELSE 'POPULATED'
        END as status
    FROM public.news_trends
    WHERE date = (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok')
    ORDER BY popularity_score_precise DESC, view_count DESC
    LIMIT 20
)
SELECT * FROM today_stories;

-- 2. Summary statistics
SELECT 
    COUNT(*) as total_stories,
    COUNT(score_details) as has_score_details,
    COUNT(CASE WHEN score_details != '' THEN 1 END) as non_empty_score_details,
    ROUND(100.0 * COUNT(CASE WHEN score_details != '' THEN 1 END) / COUNT(*), 2) as percent_with_details
FROM public.news_trends
WHERE date = (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok');

-- 3. Sample of actual score_details text
SELECT 
    video_id,
    title,
    score_details
FROM public.news_trends
WHERE date = (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok')
    AND score_details IS NOT NULL 
    AND score_details != ''
ORDER BY popularity_score_precise DESC
LIMIT 5;
