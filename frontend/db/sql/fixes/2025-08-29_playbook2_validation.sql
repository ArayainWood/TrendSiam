-- ===============================
-- PLAYBOOK 2.0 VALIDATION QUERIES
-- Supabase Editor Compatible
-- ===============================
-- This script validates that all Playbook 2.0 fixes are working correctly
-- Run after applying all other fix scripts
-- 
-- USAGE: Copy and paste this entire script into Supabase SQL Editor
-- PURPOSE: Verify Plan-B Security, performance indexes, and view functionality
-- ===============================

-- 1) View exists & columns are correct
SELECT 'VIEW STRUCTURE CHECK' as test_name;
SELECT jsonb_object_keys(to_jsonb(t)) as available_columns 
FROM public.public_v_home_news AS t LIMIT 1;

SELECT 'VIEW ROW COUNT' as test_name;
SELECT COUNT(*) AS home_rows FROM public.public_v_home_news;

-- 2) View security flags
SELECT 'VIEW SECURITY SETTINGS' as test_name;
SELECT 
    relname as view_name, 
    CASE WHEN 'security_invoker=true' = ANY(reloptions) THEN 'INVOKER' ELSE 'DEFINER' END as security_type,
    CASE WHEN 'security_barrier=true' = ANY(reloptions) THEN 'YES' ELSE 'NO' END as has_barrier,
    reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' 
AND relname IN ('public_v_home_news','public_v_weekly_stats')
AND relkind = 'v';

-- 3) Policies present (stats, system_meta)
SELECT 'RLS POLICIES CHECK' as test_name;
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname='public' 
AND tablename IN ('stats','system_meta')
ORDER BY tablename, policyname;

-- 4) pg_trgm moved out of public
SELECT 'EXTENSION LOCATION CHECK' as test_name;
SELECT extname, n.nspname AS schema_name
FROM pg_extension e 
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE extname='pg_trgm';

-- 5) Function search_path settings
SELECT 'FUNCTION SECURITY CHECK' as test_name;
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    COALESCE(array_to_string(p.proconfig, ', '), 'default') as search_path_config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public' 
AND p.proname IN ('update_updated_at_column', 'update_news_last_updated');

-- 6) Index validation (no volatile predicates)
SELECT 'INDEX VALIDATION CHECK' as test_name;
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename = 'news_trends'
AND indexname LIKE 'idx_%'
ORDER BY indexname;

-- 7) RLS status on key tables
SELECT 'RLS STATUS CHECK' as test_name;
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = t.schemaname AND tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public' 
AND tablename IN ('news_trends', 'stories', 'snapshots', 'image_files', 'stats', 'system_meta')
ORDER BY tablename;

-- 8) Cache invalidation system check
SELECT 'CACHE SYSTEM CHECK' as test_name;
SELECT key, value, updated_at 
FROM public.system_meta 
WHERE key = 'news_last_updated';

-- 9) Trigger validation
SELECT 'TRIGGER VALIDATION CHECK' as test_name;
SELECT 
    schemaname,
    tablename,
    triggername,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
AND table_name IN ('news_trends', 'system_meta')
ORDER BY table_name, triggername;

-- 10) Sample data validation
SELECT 'SAMPLE DATA CHECK' as test_name;
SELECT 
    COUNT(*) as total_items,
    COUNT(CASE WHEN ai_image_url IS NOT NULL AND ai_image_url != '/placeholder-image.svg' THEN 1 END) as items_with_images,
    COUNT(CASE WHEN popularity_score > 0 THEN 1 END) as items_with_scores,
    MAX(updated_at) as latest_update
FROM public.public_v_home_news;

-- 11) Performance check (should use indexes)
SELECT 'PERFORMANCE CHECK' as test_name;
EXPLAIN (ANALYZE false, BUFFERS false, COSTS false) 
SELECT * FROM public.public_v_home_news 
ORDER BY popularity_score DESC 
LIMIT 20;

-- ===============================
-- EXPECTED RESULTS SUMMARY
-- ===============================
-- VIEW STRUCTURE CHECK: Should show all expected columns (id, title, summary, etc.)
-- VIEW ROW COUNT: Should be > 0 if data exists
-- VIEW SECURITY SETTINGS: Should show INVOKER + YES for barrier
-- RLS POLICIES CHECK: Should show service_role policies for stats/system_meta
-- EXTENSION LOCATION CHECK: Should show pg_trgm in 'extensions' schema
-- FUNCTION SECURITY CHECK: Should show pg_catalog or pg_catalog,public search_path
-- INDEX VALIDATION CHECK: Should show indexes without volatile WHERE clauses
-- RLS STATUS CHECK: Should show rls_enabled=true and policy_count>0
-- CACHE SYSTEM CHECK: Should show recent timestamp
-- TRIGGER VALIDATION CHECK: Should show cache invalidation trigger
-- SAMPLE DATA CHECK: Should show reasonable data distribution
-- PERFORMANCE CHECK: Should use index scans, not sequential scans
-- ===============================
