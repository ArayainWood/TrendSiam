-- Phase 1: Discovery - Current Database State
-- Date: 2025-10-20
-- Purpose: Capture current grants before remediation

-- Capture all grants on views
SELECT 
    table_schema,
    table_name,
    grantee,
    privilege_type,
    'GRANT ' || privilege_type || ' ON ' || table_schema || '.' || table_name || ' TO ' || grantee AS grant_statement
FROM information_schema.table_privileges
WHERE table_schema = 'public'
AND (table_name LIKE 'public_v_%' OR table_name LIKE '%_v%' OR table_name = 'home_feed_v1')
ORDER BY table_name, grantee;

-- Capture view definitions
SELECT 
    schemaname,
    viewname,
    definition,
    viewowner
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;
