-- Check the current definition of public_v_home_news view
SELECT 
    view_definition 
FROM information_schema.views
WHERE table_schema = 'public' 
AND table_name = 'public_v_home_news';

-- Check if news_trends has recent data
SELECT 
    'news_trends recent 7d' as check_type,
    COUNT(*) as count,
    MIN(published_at) as oldest,
    MAX(published_at) as newest
FROM public.news_trends
WHERE published_at >= CURRENT_TIMESTAMP - INTERVAL '7 days';

-- Check all news_trends data
SELECT 
    'news_trends all' as check_type,
    COUNT(*) as count,
    MIN(published_at) as oldest,
    MAX(published_at) as newest
FROM public.news_trends;

-- Sample news_trends data
SELECT 
    id,
    title,
    platform,
    published_at,
    popularity_score,
    view_count,
    like_count,
    comment_count
FROM public.news_trends
ORDER BY published_at DESC
LIMIT 5;
