-- =====================================================
-- LSP Read-Only Role Hardening for TrendSiam
-- Date: 2025-09-27
-- Purpose: Harden the lsp_ro role for safe LSP usage
-- =====================================================
-- 
-- IMPORTANT: Run this in Supabase SQL Editor as admin
-- This creates and hardens a read-only role for the
-- Postgrestools LSP extension
--
-- Security Model: Plan-B compliant (read-only access)
-- =====================================================

-- Step 1: Create the read-only role if it doesn't exist
-- Note: Skip this if role already exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lsp_ro') THEN
    CREATE ROLE lsp_ro WITH LOGIN PASSWORD 'CHANGE_THIS_PASSWORD';
    COMMENT ON ROLE lsp_ro IS 'Read-only role for Postgrestools LSP';
  END IF;
END
$$;

-- Step 2: Set connection limits and timeouts for safety
ALTER ROLE lsp_ro SET statement_timeout = '5s';
ALTER ROLE lsp_ro SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE lsp_ro SET lock_timeout = '3s';

-- Step 3: Grant minimal required permissions
-- Only SELECT on public schema tables
GRANT USAGE ON SCHEMA public TO lsp_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO lsp_ro;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO lsp_ro;

-- Step 4: Set default permissions for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  GRANT SELECT ON TABLES TO lsp_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  GRANT SELECT ON SEQUENCES TO lsp_ro;

-- Step 5: Revoke any dangerous permissions
REVOKE CREATE ON SCHEMA public FROM lsp_ro;
REVOKE ALL ON DATABASE postgres FROM lsp_ro;
GRANT CONNECT ON DATABASE postgres TO lsp_ro;

-- Step 6: Set read-only transaction mode as default
ALTER ROLE lsp_ro SET default_transaction_read_only = on;

-- =====================================================
-- Verification queries (run these to confirm setup):
-- =====================================================

-- Check role configuration
SELECT 
  rolname,
  rolsuper,
  rolinherit,
  rolcreaterole,
  rolcreatedb,
  rolcanlogin,
  rolreplication,
  rolconnlimit,
  rolvaliduntil
FROM pg_roles 
WHERE rolname = 'lsp_ro';

-- Check role parameters
SELECT 
  rolname,
  setconfig
FROM pg_db_role_setting r
JOIN pg_roles s ON r.setrole = s.oid
WHERE s.rolname = 'lsp_ro';

-- =====================================================
-- IMPORTANT NOTES:
-- 1. Change the password in line 18 before running
-- 2. This role can ONLY read data, cannot modify
-- 3. Connection timeouts prevent long-running queries
-- 4. Use this role ONLY for LSP/development tools
-- =====================================================
