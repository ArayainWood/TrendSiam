-- ===================================================================
-- Check Home Feed View Definition
-- ===================================================================

\echo '=== 1. HOME_FEED_V1 - All Columns ==='
SELECT 
    ordinal_position,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'home_feed_v1'
ORDER BY ordinal_position;

\echo ''
\echo '=== 2. PUBLIC_V_HOME_NEWS - All Columns ==='
SELECT 
    ordinal_position,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'public_v_home_news'
ORDER BY ordinal_position;

\echo ''
\echo '=== 3. VIEW DEFINITION - home_feed_v1 ==='
SELECT pg_get_viewdef('public.home_feed_v1'::regclass, true) as view_definition;

\echo ''
\echo '=== 4. VIEW DEFINITION - public_v_home_news ==='
SELECT pg_get_viewdef('public.public_v_home_news'::regclass, true) as view_definition;

