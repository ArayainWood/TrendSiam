/**
 * Database Schema Inventory
 * Part of TrendSiam Comprehensive Audit
 * 
 * Generates complete inventory of:
 * - Tables (with column count, row count)
 * - Views (with dependencies)
 * - RPC Functions
 * - Grants and permissions
 */

\set ON_ERROR_STOP off

\echo ''
\echo '================================================================================'
\echo 'DATABASE SCHEMA INVENTORY - TrendSiam Audit'
\echo '================================================================================'
\echo ''

-- ==============================================================================
-- SECTION 1: Tables Inventory
-- ==============================================================================

\echo '1. TABLES INVENTORY'
\echo '-------------------'
\echo ''

SELECT 
  schemaname AS schema,
  tablename AS table_name,
  CASE 
    WHEN rowsecurity THEN 'RLS ON' 
    ELSE 'RLS OFF' 
  END AS row_security
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT LIKE 'sql_%'
ORDER BY tablename;

\echo ''
\echo 'Column counts per table:'
\echo ''

SELECT 
  table_name,
  COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
  )
GROUP BY table_name
ORDER BY table_name;

\echo ''
\echo 'Approximate row counts (FAST - uses statistics):'
\echo ''

SELECT 
  schemaname AS schema,
  relname AS table_name,
  n_live_tup AS approx_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

\echo ''

-- ==============================================================================
-- SECTION 2: Views Inventory
-- ==============================================================================

\echo '2. VIEWS INVENTORY'
\echo '------------------'
\echo ''

SELECT 
  schemaname AS schema,
  viewname AS view_name,
  viewowner AS owner
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

\echo ''
\echo 'Canonical views status:'
\echo ''

-- Check existence of canonical views
SELECT 
  view_name,
  CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status
FROM (
  SELECT 'home_feed_v1' AS view_name
  UNION ALL
  SELECT 'public_v_home_news'
  UNION ALL
  SELECT 'public_v_system_meta'
  UNION ALL
  SELECT 'public_v_ai_images_latest'
) expected_views
LEFT JOIN information_schema.views v 
  ON v.table_schema = 'public' 
  AND v.table_name = expected_views.view_name
GROUP BY view_name
ORDER BY view_name;

\echo ''

-- ==============================================================================
-- SECTION 3: RPC Functions
-- ==============================================================================

\echo '3. RPC FUNCTIONS INVENTORY'
\echo '--------------------------'
\echo ''

SELECT 
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_result(p.oid) AS return_type,
  pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE 'util_%'
ORDER BY p.proname;

\echo ''
\echo 'Check util_has_column function:'
\echo ''

SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS util_has_column_status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'util_has_column';

\echo ''

-- ==============================================================================
-- SECTION 4: Grants & Permissions
-- ==============================================================================

\echo '4. GRANTS & PERMISSIONS'
\echo '-----------------------'
\echo ''
\echo 'Views accessible to anon/authenticated:'
\echo ''

SELECT 
  table_schema AS schema,
  table_name,
  grantee AS role,
  string_agg(privilege_type, ', ') AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
  AND table_name LIKE '%v_%'
GROUP BY table_schema, table_name, grantee
ORDER BY table_name, grantee;

\echo ''
\echo 'Base tables accessible to anon/authenticated (SHOULD BE EMPTY):' 
\echo ''

SELECT 
  table_schema AS schema,
  table_name,
  grantee AS role,
  string_agg(privilege_type, ', ') AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
  AND table_name IN ('news_trends', 'stories', 'snapshots', 'ai_images', 'system_meta', 'image_files', 'stats')
GROUP BY table_schema, table_name, grantee
ORDER BY table_name, grantee;

\echo ''

-- ==============================================================================
-- SECTION 5: System Metadata
-- ==============================================================================

\echo '5. SYSTEM METADATA'
\echo '------------------'
\echo ''

SELECT key, value, updated_at
FROM system_meta
WHERE key IN (
  'home_view_version',
  'home_view_canonical',
  'home_freshness_policy',
  'published_at_source',
  'home_limit',
  'top3_max',
  'news_last_updated'
)
ORDER BY key;

\echo ''
\echo '================================================================================'
\echo 'END OF DATABASE SCHEMA INVENTORY'
\echo '================================================================================'
\echo ''

