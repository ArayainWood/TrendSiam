-- Quick Duplicate Cleanup for news_trends table
-- Run this in Supabase SQL Editor

-- Remove duplicates (keep latest by ctid)
WITH duplicates AS (
    SELECT 
        ctid,
        video_id,
        ROW_NUMBER() OVER (PARTITION BY video_id ORDER BY ctid DESC) as rn
    FROM news_trends
    WHERE video_id IS NOT NULL AND video_id != ''
)
DELETE FROM news_trends 
WHERE ctid IN (
    SELECT ctid FROM duplicates WHERE rn > 1
);

-- Add UNIQUE constraint safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_video_id' 
          AND table_name = 'news_trends'
    ) THEN
        ALTER TABLE news_trends ADD CONSTRAINT unique_video_id UNIQUE (video_id);
    END IF;
END $$;
