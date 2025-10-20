-- ============================================================================
-- Utility Function: Column Existence Checker
-- ============================================================================
-- Date: 2025-10-06
-- Purpose: Check if a column exists in a view/table (for schema guards)
-- Security: SECURITY DEFINER (can read information_schema)
-- Idempotent: Safe to run multiple times
-- ============================================================================

-- Create or replace the utility function
CREATE OR REPLACE FUNCTION public.util_has_column(
  view_name text,
  col_name text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = view_name
      AND column_name = col_name
  );
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.util_has_column(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.util_has_column(text, text) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.util_has_column(text, text) IS 
  'Check if a column exists in a view/table. Used by API schema guards to detect column availability without exposing information_schema to PostgREST.';

-- ============================================================================
-- NOTE: Verification queries moved to separate file to keep PostgresTools LSP clean
-- Run: frontend/db/sql/verify/2025-10-06_util_has_column_VERIFY.sql
-- ============================================================================
