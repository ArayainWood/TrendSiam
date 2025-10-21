-- =========================================================
-- REVOKE BASE TABLE ACCESS FOR SYSTEM_META
-- Date: 2025-09-23
--
-- Remove direct SELECT on base table from anon/authenticated
-- Safe if none exist. Part of views-only security model.
-- =========================================================

BEGIN;

-- =========================================
-- REVOKE BASE TABLE PERMISSIONS
-- =========================================

-- Remove direct SELECT on base table from anon/authenticated (safe if none)
REVOKE SELECT ON TABLE public.system_meta FROM anon, authenticated;

-- =========================================
-- VERIFICATION
-- =========================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Check if any grants remain on base table
  SELECT COUNT(*)
  INTO v_count
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'system_meta'
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type = 'SELECT';

  IF v_count > 0 THEN
    RAISE WARNING 'Found % remaining SELECT grants on system_meta base table!', v_count;
  ELSE
    RAISE NOTICE '✅ No SELECT grants on system_meta base table for anon/authenticated (correct)';
  END IF;
  
  -- Verify view is accessible
  BEGIN
    PERFORM 1 FROM public.public_v_system_meta LIMIT 1;
    RAISE NOTICE '✅ public_v_system_meta is accessible';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ public_v_system_meta is not accessible - run creation script first!';
  END;
END $$;

COMMIT;
