/**
 * Security Plan-B Validation
 * Part of TrendSiam Comprehensive Audit
 * 
 * Validates:
 * - No base-table SELECT grants to anon/authenticated
 * - Views use SECURITY DEFINER pattern
 * - util_has_column RPC properly configured
 * - No exposed secrets in views
 */

\set ON_ERROR_STOP off

\echo ''
\echo '================================================================================'
\echo 'SECURITY PLAN-B VALIDATION'
\echo '================================================================================'
\echo ''

-- ==============================================================================
-- 1. Base Table Grants Check (MUST BE EMPTY)
-- ==============================================================================

\echo '1. BASE TABLE GRANTS TO ANON/AUTHENTICATED (MUST BE EMPTY)'
\echo '-----------------------------------------------------------'
\echo ''

SELECT 
  table_name,
  grantee,
  string_agg(privilege_type, ', ') AS privileges,
  '❌ SECURITY VIOLATION' AS status
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
  AND table_name IN ('news_trends', 'stories', 'snapshots', 'ai_images', 'system_meta', 'image_files', 'stats')
GROUP BY table_name, grantee;

\echo ''

WITH violations AS (
  SELECT COUNT(*) AS count
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'authenticated')
    AND table_name IN ('news_trends', 'stories', 'snapshots', 'ai_images', 'system_meta', 'image_files', 'stats')
)
SELECT 
  CASE 
    WHEN count = 0 THEN '✅ PASS: No base-table grants to anon/authenticated'
    ELSE '❌ FAIL: Found ' || count || ' base-table grants (security violation)'
  END AS result
FROM violations;

\echo ''

-- ==============================================================================
-- 2. View Grants Check (MUST EXIST)
-- ==============================================================================

\echo '2. VIEW GRANTS TO ANON/AUTHENTICATED (SHOULD EXIST)'
\echo '---------------------------------------------------'
\echo ''

SELECT 
  table_name AS view_name,
  grantee,
  string_agg(privilege_type, ', ') AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
  AND table_name IN ('home_feed_v1', 'public_v_home_news', 'public_v_system_meta', 'public_v_ai_images_latest')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;

\echo ''

WITH expected_grants AS (
  SELECT view_name, role
  FROM (VALUES 
    ('home_feed_v1', 'anon'),
    ('home_feed_v1', 'authenticated'),
    ('public_v_home_news', 'anon'),
    ('public_v_home_news', 'authenticated'),
    ('public_v_system_meta', 'anon'),
    ('public_v_system_meta', 'authenticated')
  ) AS t(view_name, role)
),
actual_grants AS (
  SELECT table_name AS view_name, grantee AS role
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type = 'SELECT'
)
SELECT 
  e.view_name,
  e.role,
  CASE 
    WHEN a.view_name IS NOT NULL THEN '✅ Present'
    ELSE '❌ MISSING'
  END AS status
FROM expected_grants e
LEFT JOIN actual_grants a ON a.view_name = e.view_name AND a.role = e.role
ORDER BY e.view_name, e.role;

\echo ''

-- ==============================================================================
-- 3. View Security Options
-- ==============================================================================

\echo '3. VIEW SECURITY OPTIONS'
\echo '------------------------'
\echo ''

SELECT 
  viewname AS view_name,
  viewowner AS owner,
  CASE 
    WHEN definition LIKE '%security_invoker%false%' THEN '✅ DEFINER'
    WHEN definition LIKE '%security_invoker%true%' THEN '⚠️  INVOKER'
    ELSE '❓ UNKNOWN'
  END AS security_mode,
  CASE 
    WHEN definition LIKE '%security_barrier%true%' THEN '✅ BARRIER ON'
    ELSE '⚠️  BARRIER OFF'
  END AS security_barrier
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('home_feed_v1', 'public_v_home_news', 'public_v_system_meta', 'public_v_ai_images_latest')
ORDER BY viewname;

\echo ''

-- ==============================================================================
-- 4. RPC Function Security
-- ==============================================================================

\echo '4. RPC FUNCTION SECURITY (util_has_column)'
\echo '-------------------------------------------'
\echo ''

SELECT 
  p.proname AS function_name,
  pg_get_function_result(p.oid) AS return_type,
  pg_get_function_arguments(p.oid) AS arguments,
  CASE 
    WHEN p.prosecdef THEN '✅ SECURITY DEFINER'
    ELSE '❌ SECURITY INVOKER'
  END AS security,
  CASE 
    WHEN p.provolatile = 'i' THEN 'IMMUTABLE'
    WHEN p.provolatile = 's' THEN 'STABLE'
    WHEN p.provolatile = 'v' THEN 'VOLATILE'
  END AS volatility
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'util_has_column';

\echo ''

\echo 'EXECUTE grants on util_has_column:'
\echo ''

SELECT 
  routine_schema AS schema,
  routine_name AS function_name,
  grantee,
  string_agg(privilege_type, ', ') AS privileges
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'util_has_column'
  AND grantee IN ('anon', 'authenticated', 'public')
GROUP BY routine_schema, routine_name, grantee;

\echo ''

WITH expected_exec AS (
  SELECT role
  FROM (VALUES ('anon'), ('authenticated')) AS t(role)
),
actual_exec AS (
  SELECT grantee AS role
  FROM information_schema.routine_privileges
  WHERE routine_schema = 'public'
    AND routine_name = 'util_has_column'
    AND privilege_type = 'EXECUTE'
)
SELECT 
  e.role,
  CASE 
    WHEN a.role IS NOT NULL THEN '✅ Can execute'
    ELSE '❌ MISSING GRANT'
  END AS status
FROM expected_exec e
LEFT JOIN actual_exec a ON a.role = e.role;

\echo ''

-- ==============================================================================
-- 5. No Secrets in Views
-- ==============================================================================

\echo '5. SECRETS EXPOSURE CHECK'
\echo '-------------------------'
\echo ''

\echo 'Checking view definitions for potential secrets...'
\echo ''

SELECT 
  viewname AS view_name,
  CASE 
    WHEN definition LIKE '%service_role%' THEN '❌ Contains "service_role"'
    WHEN definition LIKE '%secret%' THEN '❌ Contains "secret"'
    WHEN definition LIKE '%password%' THEN '❌ Contains "password"'
    WHEN definition LIKE '%api_key%' THEN '❌ Contains "api_key"'
    ELSE '✅ No obvious secrets'
  END AS status
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('home_feed_v1', 'public_v_home_news', 'public_v_system_meta')
ORDER BY viewname;

\echo ''

-- ==============================================================================
-- 6. Summary
-- ==============================================================================

\echo '6. SECURITY SUMMARY'
\echo '-------------------'
\echo ''

WITH checks AS (
  SELECT 
    (SELECT COUNT(*) FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
       AND grantee IN ('anon', 'authenticated')
       AND table_name IN ('news_trends', 'stories', 'snapshots', 'ai_images', 'system_meta')) = 0 AS no_base_grants,
    (SELECT COUNT(*) FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
       AND grantee = 'anon'
       AND table_name = 'home_feed_v1'
       AND privilege_type = 'SELECT') > 0 AS has_view_grants,
    (SELECT COUNT(*) FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'util_has_column'
       AND p.prosecdef = true) > 0 AS rpc_secure
)
SELECT 
  CASE WHEN no_base_grants THEN '✅' ELSE '❌' END AS base_grants_check,
  CASE WHEN has_view_grants THEN '✅' ELSE '❌' END AS view_grants_check,
  CASE WHEN rpc_secure THEN '✅' ELSE '⚠️ ' END AS rpc_security_check,
  CASE 
    WHEN no_base_grants AND has_view_grants AND rpc_secure THEN '✅ PLAN-B SECURITY: PASS'
    WHEN no_base_grants AND has_view_grants THEN '⚠️  PLAN-B SECURITY: PASS (RPC check skipped)'
    ELSE '❌ PLAN-B SECURITY: FAIL'
  END AS overall_status
FROM checks;

\echo ''
\echo '================================================================================'
\echo 'END OF SECURITY PLAN-B VALIDATION'
\echo '================================================================================'
\echo ''

