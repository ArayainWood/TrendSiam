-- Quick check for BNK48 story
-- Run this in Supabase SQL editor

-- Find BNK48 story and check auxiliary fields
SELECT
    video_id,
    title,
    rank,
    date,
    -- Auxiliary fields
    growth_rate,
    platform_mentions,
    keywords,
    ai_opinion,
    score_details,
    -- Basic info
    view_count,
    popularity_score_precise,
    published_date,
    updated_at
FROM public.news_trends
WHERE date = CURRENT_DATE AT TIME ZONE 'Asia/Bangkok'
  AND (title ILIKE '%BNK48%' OR title ILIKE '%11-Gatsu%')
LIMIT 1;

-- Also show a working example for comparison
SELECT
    video_id,
    title,
    growth_rate,
    platform_mentions,
    keywords,
    ai_opinion,
    score_details
FROM public.news_trends  
WHERE date = CURRENT_DATE AT TIME ZONE 'Asia/Bangkok'
  AND growth_rate IS NOT NULL
  AND ai_opinion IS NOT NULL
ORDER BY popularity_score_precise DESC
LIMIT 1;
