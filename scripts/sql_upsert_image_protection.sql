-- SQL Upsert Pattern with Image URL Protection
-- This shows how to protect ai_image_url from being overwritten with NULL or empty strings
-- at the database level, even if the application accidentally sends bad values.

-- Example UPSERT with protection for ai_image_url
-- Adjust the conflict columns based on your actual unique constraints

-- Method 1: Using CASE statement (most explicit)
INSERT INTO public.news_trends (
    video_id,
    title,
    summary,
    ai_image_url,
    popularity_score,
    date,
    updated_at
    -- ... other columns
) VALUES (
    :video_id,
    :title,
    :summary,
    :ai_image_url,
    :popularity_score,
    :date,
    NOW()
    -- ... other values
) 
ON CONFLICT (video_id, date) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    popularity_score = EXCLUDED.popularity_score,
    -- Protected update for ai_image_url
    ai_image_url = CASE
        -- Only update if new value is not null and not empty
        WHEN EXCLUDED.ai_image_url IS NOT NULL AND EXCLUDED.ai_image_url <> ''
            THEN EXCLUDED.ai_image_url
        -- Otherwise keep the existing value
        ELSE public.news_trends.ai_image_url
    END,
    updated_at = EXCLUDED.updated_at;

-- Method 2: Using COALESCE with validation (simpler but less explicit)
-- This approach works if you consider empty string as NULL
ON CONFLICT (video_id, date) DO UPDATE SET
    ai_image_url = COALESCE(
        NULLIF(EXCLUDED.ai_image_url, ''),  -- Convert empty string to NULL
        public.news_trends.ai_image_url     -- Fallback to existing value
    );

-- Method 3: For Supabase RPC function (if you need more complex logic)
CREATE OR REPLACE FUNCTION upsert_news_with_image_protection(
    p_video_id TEXT,
    p_title TEXT,
    p_ai_image_url TEXT,
    -- ... other parameters
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.news_trends (video_id, title, ai_image_url, ...)
    VALUES (p_video_id, p_title, p_ai_image_url, ...)
    ON CONFLICT (video_id, date) DO UPDATE SET
        title = EXCLUDED.title,
        ai_image_url = CASE
            WHEN p_ai_image_url IS NOT NULL AND p_ai_image_url <> '' THEN p_ai_image_url
            ELSE public.news_trends.ai_image_url
        END;
END;
$$ LANGUAGE plpgsql;

-- Verification query to check image URLs are preserved
SELECT 
    video_id,
    title,
    ai_image_url,
    updated_at,
    CASE 
        WHEN ai_image_url IS NULL THEN 'NULL'
        WHEN ai_image_url = '' THEN 'EMPTY'
        ELSE 'HAS_VALUE'
    END AS url_status
FROM public.news_trends
WHERE date = CURRENT_DATE
ORDER BY updated_at DESC
LIMIT 10;
