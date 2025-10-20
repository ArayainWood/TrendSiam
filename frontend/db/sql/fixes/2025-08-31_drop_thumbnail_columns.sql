-- =========================================================
-- DROP THUMBNAIL COLUMNS - SAFE MIGRATION
-- TrendSiam policy: AI-generated images for Top-3 only
-- No external thumbnails or YouTube thumbnails allowed
-- Non-Top-3 items have NO images whatsoever
-- =========================================================

-- This migration safely removes thumbnail columns that may have been
-- accidentally added. TrendSiam does NOT use external thumbnails.

-- 1. Drop thumbnail_url from news_trends if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'news_trends' 
        AND column_name = 'thumbnail_url'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.news_trends DROP COLUMN thumbnail_url;
        RAISE NOTICE 'Dropped column: news_trends.thumbnail_url';
    ELSE
        RAISE NOTICE 'Column news_trends.thumbnail_url does not exist (OK)';
    END IF;
END $$;

-- 2. Drop youtube_thumbnail_url from news_trends if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'news_trends' 
        AND column_name = 'youtube_thumbnail_url'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.news_trends DROP COLUMN youtube_thumbnail_url;
        RAISE NOTICE 'Dropped column: news_trends.youtube_thumbnail_url';
    ELSE
        RAISE NOTICE 'Column news_trends.youtube_thumbnail_url does not exist (OK)';
    END IF;
END $$;

-- 3. Drop any thumbnail columns from stories if they exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'stories' 
        AND column_name = 'thumbnail_url'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.stories DROP COLUMN thumbnail_url;
        RAISE NOTICE 'Dropped column: stories.thumbnail_url';
    ELSE
        RAISE NOTICE 'Column stories.thumbnail_url does not exist (OK)';
    END IF;
END $$;

-- 4. Verify no thumbnail columns remain
SELECT 
    table_name,
    column_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name LIKE '%thumbnail%'
ORDER BY table_name, column_name;

-- Expected result: 0 rows (no thumbnail columns should exist)

-- 5. Add check constraint comments to prevent re-addition
COMMENT ON TABLE public.news_trends IS 
'Main trending news table. POLICY: No thumbnail_url allowed - use AI images for Top-3 only via ai_image_url/ai_image_prompt';

COMMENT ON TABLE public.stories IS 
'Story content table. POLICY: No thumbnail_url allowed - use AI images for Top-3 only';

-- =========================================================
-- VERIFICATION QUERIES
-- =========================================================

/*
-- Run this to confirm no thumbnail columns exist:
SELECT COUNT(*) as thumbnail_column_count
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name LIKE '%thumbnail%';
-- Should return 0
*/

/*
-- Run this to see table comments:
SELECT 
    schemaname,
    tablename,
    obj_description(c.oid) as table_comment
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public'
AND tablename IN ('news_trends', 'stories');
*/
