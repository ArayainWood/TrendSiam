-- =============================================
-- TrendSiam: Cleanup Duplicates and Add UNIQUE Constraint
-- =============================================
-- This script safely removes duplicate video_id entries and adds a UNIQUE constraint
-- Run this in your Supabase SQL Editor
-- =============================================

-- Step 1: Check for existing duplicates (optional - for information only)
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT video_id, COUNT(*) as cnt
        FROM news_trends 
        WHERE video_id IS NOT NULL 
        GROUP BY video_id 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    RAISE NOTICE 'Found % duplicate video_id groups before cleanup', duplicate_count;
END $$;

-- Step 2: Delete duplicates, keeping only the latest entry (by ctid)
-- ctid is PostgreSQL's internal row identifier - later ctid means more recent insert
WITH duplicates AS (
    SELECT 
        ctid,
        video_id,
        ROW_NUMBER() OVER (
            PARTITION BY video_id 
            ORDER BY ctid DESC  -- Keep the latest inserted row (highest ctid)
        ) as rn
    FROM news_trends
    WHERE video_id IS NOT NULL
      AND video_id != ''
),
to_delete AS (
    SELECT ctid 
    FROM duplicates 
    WHERE rn > 1  -- Delete all but the first (latest) row for each video_id
)
DELETE FROM news_trends 
WHERE ctid IN (SELECT ctid FROM to_delete);

-- Step 3: Get count of deleted rows
GET DIAGNOSTICS deleted_count = ROW_COUNT;
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Note: We can't directly access the deleted_count from the previous statement
    -- So we'll do a final check instead
    SELECT COUNT(*) INTO deleted_count
    FROM (
        SELECT video_id, COUNT(*) as cnt
        FROM news_trends 
        WHERE video_id IS NOT NULL 
        GROUP BY video_id 
        HAVING COUNT(*) > 1
    ) remaining_duplicates;
    
    RAISE NOTICE 'Remaining duplicate video_id groups after cleanup: %', deleted_count;
END $$;

-- Step 4: Safely add UNIQUE constraint if it doesn't exist
DO $$
BEGIN
    -- Check if the constraint already exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_video_id' 
          AND table_name = 'news_trends'
          AND constraint_type = 'UNIQUE'
    ) THEN
        -- Add the UNIQUE constraint
        ALTER TABLE news_trends 
        ADD CONSTRAINT unique_video_id 
        UNIQUE (video_id);
        
        RAISE NOTICE 'UNIQUE constraint "unique_video_id" added successfully';
    ELSE
        RAISE NOTICE 'UNIQUE constraint "unique_video_id" already exists, skipping';
    END IF;
    
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error adding UNIQUE constraint: %', SQLERRM;
        -- Don't re-raise the exception to prevent script failure
END $$;

-- Step 5: Verify the results
DO $$
DECLARE
    total_rows INTEGER;
    unique_video_ids INTEGER;
    null_video_ids INTEGER;
    constraint_exists BOOLEAN;
BEGIN
    -- Count total rows
    SELECT COUNT(*) INTO total_rows FROM news_trends;
    
    -- Count unique video_ids (excluding NULL)
    SELECT COUNT(DISTINCT video_id) INTO unique_video_ids 
    FROM news_trends 
    WHERE video_id IS NOT NULL;
    
    -- Count NULL video_ids
    SELECT COUNT(*) INTO null_video_ids 
    FROM news_trends 
    WHERE video_id IS NULL;
    
    -- Check if constraint exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_video_id' 
          AND table_name = 'news_trends'
          AND constraint_type = 'UNIQUE'
    ) INTO constraint_exists;
    
    RAISE NOTICE '=== CLEANUP RESULTS ===';
    RAISE NOTICE 'Total rows in news_trends: %', total_rows;
    RAISE NOTICE 'Unique video_ids (non-NULL): %', unique_video_ids;
    RAISE NOTICE 'Rows with NULL video_id: %', null_video_ids;
    RAISE NOTICE 'UNIQUE constraint exists: %', constraint_exists;
    RAISE NOTICE '=======================';
END $$;

-- Optional Step 6: Show sample of remaining data
SELECT 
    video_id,
    title,
    created_at,
    ctid
FROM news_trends 
WHERE video_id IS NOT NULL
ORDER BY video_id, ctid DESC
LIMIT 10;
