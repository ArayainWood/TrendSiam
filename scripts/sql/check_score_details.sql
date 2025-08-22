-- Check score_details column and data for today's batch
-- 1. First check if column exists
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'news_trends'
    AND column_name = 'score_details';

-- 2. Check score_details for today's batch
WITH today_data AS (
    SELECT 
        id,
        video_id,
        title,
        popularity_score_precise,
        view_count,
        score_details,
        LENGTH(COALESCE(score_details, '')) as score_details_length,
        CASE 
            WHEN score_details IS NULL THEN 'NULL'
            WHEN score_details = '' THEN 'EMPTY'
            ELSE 'HAS_VALUE'
        END as score_status,
        updated_at
    FROM public.news_trends
    WHERE date = (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok')
    ORDER BY popularity_score_precise DESC, view_count DESC
    LIMIT 20
)
SELECT * FROM today_data;

-- 3. Summary statistics
SELECT 
    COUNT(*) as total_stories,
    COUNT(score_details) as has_score_details,
    COUNT(CASE WHEN score_details != '' THEN 1 END) as non_empty_score_details
FROM public.news_trends
WHERE date = (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok');
