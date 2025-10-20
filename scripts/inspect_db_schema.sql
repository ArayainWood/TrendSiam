-- Inspect database schema for TrendSiam Home pipeline
-- This script queries information_schema to list all columns

-- 1. news_trends table columns
SELECT 
    'news_trends' as table_name,
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'news_trends'
ORDER BY ordinal_position;

-- 2. stories table columns  
SELECT 
    'stories' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'stories'
ORDER BY ordinal_position;

-- 3. snapshots table columns
SELECT 
    'snapshots' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'snapshots'
ORDER BY ordinal_position;

-- 4. ai_images table columns
SELECT 
    'ai_images' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ai_images'
ORDER BY ordinal_position;

-- 5. image_files table columns
SELECT 
    'image_files' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'image_files'
ORDER BY ordinal_position;

-- 6. system_meta table columns
SELECT 
    'system_meta' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'system_meta'
ORDER BY ordinal_position;

-- 7. Check current view columns
SELECT 
    'public_v_home_news (current)' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'public_v_home_news'
ORDER BY ordinal_position;
