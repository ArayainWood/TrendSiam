-- Inspect current schema to understand data sources for home feed
-- This is a read-only inspection script

-- Check if public_v_home_news view exists and its columns
SELECT 
    'View Exists' as check_type,
    EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = 'public_v_home_news'
    ) as result;

-- List columns if view exists
SELECT 
    ordinal_position,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'public_v_home_news'
ORDER BY ordinal_position;

-- Check available source tables
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('stories', 'snapshots', 'news_trends', 'image_files', 'ai_images', 'system_meta', 'stats')
ORDER BY table_name;

-- Count rows in key tables to understand data availability
SELECT 'stories' as table_name, COUNT(*) as row_count FROM public.stories
UNION ALL
SELECT 'snapshots', COUNT(*) FROM public.snapshots
UNION ALL  
SELECT 'news_trends', COUNT(*) FROM public.news_trends
UNION ALL
SELECT 'image_files', COUNT(*) FROM public.image_files
UNION ALL
SELECT 'ai_images', COUNT(*) FROM public.ai_images;

-- Check for recent data in snapshots (last 7 days)
SELECT 
    'Recent snapshots (7d)' as check_type,
    COUNT(*) as count
FROM public.snapshots
WHERE snapshot_date >= CURRENT_TIMESTAMP - INTERVAL '7 days';

-- Check for recent data in stories (last 7 days)
SELECT 
    'Recent stories (7d)' as check_type,
    COUNT(*) as count
FROM public.stories
WHERE publish_time >= CURRENT_TIMESTAMP - INTERVAL '7 days';

-- Sample a few rows from snapshots to understand the data
SELECT 
    s.story_id,
    s.snapshot_date,
    s.view_count,
    s.popularity_score,
    s.rank
FROM public.snapshots s
ORDER BY s.snapshot_date DESC
LIMIT 5;
