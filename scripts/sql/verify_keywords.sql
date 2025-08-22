-- Verify keywords extraction and storage
-- Run this in Supabase SQL Editor to check keyword quality

-- 1. Show keywords for today's top 10 items
SELECT 
    video_id,
    title,
    channel,
    keywords,
    -- Parse JSON array length (PostgreSQL 9.3+)
    CASE 
        WHEN keywords IS NOT NULL AND keywords != '' AND keywords != '[]'
        THEN json_array_length(keywords::json)
        ELSE 0
    END as keyword_count,
    popularity_score_precise
FROM public.news_trends
WHERE date = (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok')
ORDER BY popularity_score_precise DESC, view_count DESC
LIMIT 10;

-- 2. Check keyword format distribution
SELECT 
    CASE 
        WHEN keywords IS NULL OR keywords = '' THEN 'Empty/NULL'
        WHEN keywords LIKE '[%]' THEN 'JSON Array'
        WHEN keywords LIKE '%,%' THEN 'Comma Separated'
        ELSE 'Other'
    END as format,
    COUNT(*) as count
FROM public.news_trends
WHERE date = (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok')
GROUP BY format
ORDER BY count DESC;

-- 3. Sample of actual keywords (expanded from JSON)
WITH keywords_expanded AS (
    SELECT 
        video_id,
        title,
        json_array_elements_text(keywords::json) as keyword
    FROM public.news_trends
    WHERE date = (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok')
        AND keywords IS NOT NULL 
        AND keywords != ''
        AND keywords != '[]'
        AND keywords LIKE '[%]'
    LIMIT 50
)
SELECT 
    keyword,
    COUNT(*) as frequency
FROM keywords_expanded
GROUP BY keyword
ORDER BY frequency DESC
LIMIT 30;

-- 4. Keywords by language detection
WITH keywords_with_lang AS (
    SELECT 
        video_id,
        title,
        json_array_elements_text(keywords::json) as keyword,
        CASE 
            WHEN json_array_elements_text(keywords::json) ~ '[ก-๙]' THEN 'Thai'
            WHEN json_array_elements_text(keywords::json) ~ '[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]' THEN 'Japanese/Chinese'
            WHEN json_array_elements_text(keywords::json) ~ '^[A-Za-z0-9\s]+$' THEN 'English'
            ELSE 'Mixed/Other'
        END as language
    FROM public.news_trends
    WHERE date = (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok')
        AND keywords IS NOT NULL 
        AND keywords != ''
        AND keywords != '[]'
        AND keywords LIKE '[%]'
    LIMIT 200
)
SELECT 
    language,
    COUNT(*) as keyword_count,
    STRING_AGG(DISTINCT keyword, ', ' ORDER BY keyword) as sample_keywords
FROM keywords_with_lang
GROUP BY language
ORDER BY keyword_count DESC;

-- 5. Check for items missing keywords
SELECT 
    video_id,
    title,
    channel,
    CASE 
        WHEN keywords IS NULL THEN 'NULL'
        WHEN keywords = '' THEN 'Empty String'
        WHEN keywords = '[]' THEN 'Empty Array'
        ELSE 'Has Keywords'
    END as keyword_status
FROM public.news_trends
WHERE date = (CURRENT_DATE AT TIME ZONE 'Asia/Bangkok')
    AND (keywords IS NULL OR keywords = '' OR keywords = '[]')
ORDER BY popularity_score_precise DESC
LIMIT 10;
