-- =========================================================
-- FIX SYSTEM_META PERMISSIONS WITH DEFINER SEMANTICS
-- Date: 2025-09-26
--
-- Fixes "permission denied for table system_meta" errors by:
-- 1. Recreating public_v_system_meta with definer semantics
-- 2. Ensuring proper ownership and grants
-- 3. Adding fallback RPC function if needed
-- =========================================================

BEGIN;

-- =========================================
-- STEP 1: DROP AND RECREATE VIEW WITH DEFINER SEMANTICS
-- =========================================

-- Drop existing view to ensure clean state
DROP VIEW IF EXISTS public.public_v_system_meta CASCADE;

-- Create view with explicit column selection (no SELECT *)
CREATE OR REPLACE VIEW public.public_v_system_meta AS
SELECT 
  key, 
  value, 
  updated_at
FROM public.system_meta
WHERE key IN (
  'home_freshness_policy',
  'home_limit',
  'top3_max',
  'home_columns_hash',
  'news_last_updated'
);

-- =========================================
-- STEP 2: SET DEFINER SEMANTICS (POSTGRES 15+)
-- =========================================

-- Force definer semantics - view runs with owner's privileges
DO $$
BEGIN
  -- Try to set security_invoker = false (Postgres 15+ / Supabase)
  BEGIN
    ALTER VIEW public.public_v_system_meta SET (security_invoker = false);
    RAISE NOTICE '✅ Set security_invoker = false on public_v_system_meta';
  EXCEPTION
    WHEN undefined_object THEN
      RAISE NOTICE '⚠️  security_invoker not supported - using ownership model';
    WHEN OTHERS THEN
      RAISE NOTICE '⚠️  Could not set security_invoker: %', SQLERRM;
  END;
END $$;

-- Set owner to postgres (or appropriate superuser)
ALTER VIEW public.public_v_system_meta OWNER TO postgres;

-- =========================================
-- STEP 3: GRANT PERMISSIONS
-- =========================================

-- Revoke all existing permissions first
REVOKE ALL ON public.public_v_system_meta FROM PUBLIC;

-- Grant USAGE on schema to anon/authenticated
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant SELECT on view to anon/authenticated
GRANT SELECT ON public.public_v_system_meta TO anon, authenticated;

-- Ensure base table is NOT accessible
REVOKE ALL ON public.system_meta FROM anon, authenticated;

-- =========================================
-- STEP 4: CREATE FALLBACK RPC FUNCTION (IF NEEDED)
-- =========================================

-- Create SECURITY DEFINER function as fallback
CREATE OR REPLACE FUNCTION public.get_public_system_meta()
RETURNS TABLE (
  key text,
  value text,
  updated_at timestamptz
)
LANGUAGE sql 
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    sm.key, 
    sm.value, 
    sm.updated_at
  FROM public.system_meta sm
  WHERE sm.key IN (
    'home_freshness_policy',
    'home_limit',
    'top3_max',
    'home_columns_hash',
    'news_last_updated'
  );
$$;

-- Set function owner
ALTER FUNCTION public.get_public_system_meta() OWNER TO postgres;

-- Grant execute permissions
REVOKE ALL ON FUNCTION public.get_public_system_meta() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_system_meta() TO anon, authenticated;

-- =========================================
-- STEP 5: DOCUMENTATION
-- =========================================

COMMENT ON VIEW public.public_v_system_meta IS
'Public view exposing safe system metadata keys.
Security: Uses definer semantics (security_invoker=false) to access base table.
Keys exposed: home_freshness_policy, home_limit, top3_max, home_columns_hash, news_last_updated.
Updated: 2025-09-26 - Fixed permission issues with definer model';

COMMENT ON FUNCTION public.get_public_system_meta() IS
'Fallback RPC function for system metadata access if view permissions fail.
Returns same data as public_v_system_meta view.
Security: SECURITY DEFINER function owned by postgres.';

-- =========================================
-- STEP 6: VERIFICATION
-- =========================================

DO $$
DECLARE
  v_count INTEGER;
  v_keys TEXT[];
  v_error TEXT;
  v_owner NAME;
  v_has_invoker BOOLEAN;
BEGIN
  -- Check view exists and is accessible
  BEGIN
    SELECT COUNT(*) INTO v_count FROM public.public_v_system_meta;
    RAISE NOTICE '✅ public_v_system_meta accessible, % keys found', v_count;
    
    -- List keys
    SELECT array_agg(key ORDER BY key) INTO v_keys 
    FROM public.public_v_system_meta;
    RAISE NOTICE '   Keys: %', v_keys;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    RAISE WARNING '❌ public_v_system_meta not accessible: %', v_error;
  END;
  
  -- Check view owner
  SELECT viewowner INTO v_owner
  FROM pg_views
  WHERE schemaname = 'public' AND viewname = 'public_v_system_meta';
  RAISE NOTICE '   View owner: %', v_owner;
  
  -- Check if security_invoker exists in options
  SELECT EXISTS (
    SELECT 1 FROM pg_options_to_table(reloptions)
    WHERE option_name = 'security_invoker'
  ) INTO v_has_invoker
  FROM pg_class
  WHERE relname = 'public_v_system_meta' AND relnamespace = 'public'::regnamespace;
  
  IF v_has_invoker THEN
    RAISE NOTICE '   security_invoker setting: applied';
  ELSE
    RAISE NOTICE '   security_invoker setting: not available (using ownership model)';
  END IF;
  
  -- Test RPC function
  BEGIN
    SELECT COUNT(*) INTO v_count FROM public.get_public_system_meta();
    RAISE NOTICE '✅ RPC function get_public_system_meta() works, % keys', v_count;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    RAISE WARNING '❌ RPC function failed: %', v_error;
  END;
  
  -- Verify no base table access
  BEGIN
    -- This should fail with permission denied
    EXECUTE 'SELECT 1 FROM public.system_meta LIMIT 1' INTO v_count;
    RAISE WARNING '❌ SECURITY ISSUE: anon can still access system_meta base table!';
  EXCEPTION 
    WHEN insufficient_privilege THEN
      RAISE NOTICE '✅ Base table system_meta properly protected from anon access';
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      RAISE NOTICE '   Base table check: %', v_error;
  END;
END $$;

COMMIT;
