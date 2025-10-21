-- =====================================================
-- LSP Connection Sanity Check for TrendSiam
-- Date: 2025-09-27
-- Purpose: Test queries to verify LSP connection
-- =====================================================
--
-- Run these queries after setting up Postgrestools
-- to verify the connection is working correctly
-- =====================================================

-- Test 1: Basic connection test
SELECT 1 AS connection_test;

-- Test 2: Check current user and schema
SELECT 
  current_user AS connected_as,
  current_schema() AS default_schema,
  current_database() AS database_name,
  version() AS postgres_version;

-- Test 3: List available schemas
SELECT 
  schema_name,
  schema_owner
FROM information_schema.schemata
WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
ORDER BY schema_name;

-- Test 4: Count tables in public schema
SELECT 
  count(*) AS table_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';

-- Test 5: List first 10 tables in public schema
SELECT 
  table_schema,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name
LIMIT 10;

-- Test 6: Check permissions on a sample view
SELECT 
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
  AND table_name = 'public_v_home_news'
  AND grantee IN ('lsp_ro', 'anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- Test 7: Verify read-only mode
SHOW default_transaction_read_only;

-- Test 8: Check timeout settings
SHOW statement_timeout;
SHOW idle_in_transaction_session_timeout;
SHOW lock_timeout;

-- Test 9: Sample query on public view (if exists)
SELECT 
  id,
  title,
  platform,
  published_at
FROM public.public_v_home_news
LIMIT 5;

-- Test 10: Verify cannot write (should fail)
-- This should produce an error: "cannot execute INSERT in a read-only transaction"
-- Uncomment to test:
-- INSERT INTO test_table_that_does_not_exist (id) VALUES (1);

-- =====================================================
-- Expected Results:
-- 1. Connection test returns 1
-- 2. Current user should be 'lsp_ro'
-- 3. Public schema should be visible
-- 4. Tables/views should be accessible for SELECT
-- 5. All write operations should fail
-- =====================================================
