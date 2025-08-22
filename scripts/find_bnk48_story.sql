-- Find today's BNK48 item and inspect fields
-- This helps identify the target video_id and current field status

WITH today_date AS (
    SELECT CURRENT_DATE AT TIME ZONE 'Asia/Bangkok' AS today
)
SELECT
    id,
    video_id,
    title,
    date,
    rank,
    -- Auxiliary fields we're checking
    growth_rate,
    platform_mentions,
    keywords,
    ai_opinion,
    score_details,
    -- Basic metrics
    view_count,
    like_count,
    published_date,
    popularity_score_precise,
    -- Timestamps
    created_at,
    updated_at
FROM public.news_trends
WHERE (title ILIKE '%11-Gatsu%' OR title ILIKE '%BNK48%')
  AND date = (SELECT today FROM today_date)
ORDER BY updated_at DESC
LIMIT 3;

-- Also get a working story for comparison (e.g., LISA)
SELECT
    video_id,
    title,
    growth_rate,
    platform_mentions,
    keywords,
    ai_opinion,
    score_details
FROM public.news_trends
WHERE title ILIKE '%LISA%'
  AND date = (SELECT today FROM today_date)
  AND growth_rate IS NOT NULL
LIMIT 1;
