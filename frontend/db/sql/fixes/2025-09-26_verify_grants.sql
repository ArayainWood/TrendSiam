-- =========================================================
-- VERIFY GRANTS AND PERMISSIONS
-- Date: 2025-09-26
--
-- Comprehensive check of permissions to ensure:
-- 1. anon has SELECT on all public_v_* views
-- 2. anon has NO SELECT on base tables
-- 3. All expected views exist and are accessible
-- =========================================================

DO $$
DECLARE
  v_result RECORD;
  v_count INTEGER;
  v_missing_views TEXT[] := '{}';
  v_unauthorized_tables TEXT[] := '{}';
  v_view_grants_ok BOOLEAN := true;
  v_table_grants_ok BOOLEAN := true;
  v_error TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========== PERMISSION VERIFICATION REPORT ==========';
  RAISE NOTICE 'Timestamp: %', NOW();
  RAISE NOTICE '';
  
  -- =========================================
  -- SECTION 1: Check public_v_* view access
  -- =========================================
  RAISE NOTICE '1. CHECKING PUBLIC VIEW ACCESS (should all have SELECT grants)';
  RAISE NOTICE '-----------------------------------------------------------';
  
  -- Expected public views
  FOR v_result IN 
    SELECT unnest(ARRAY[
      'public_v_home_news',
      'public_v_ai_images_latest', 
      'public_v_system_meta',
      'public_v_weekly_stats',
      'public_v_weekly_snapshots'
    ]) AS view_name
  LOOP
    -- Check if view exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_views 
      WHERE schemaname = 'public' AND viewname = v_result.view_name
    ) THEN
      v_missing_views := array_append(v_missing_views, v_result.view_name);
      RAISE NOTICE '❌ View does not exist: %', v_result.view_name;
      v_view_grants_ok := false;
      CONTINUE;
    END IF;
    
    -- Check grants for anon
    SELECT COUNT(*) INTO v_count
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = v_result.view_name
      AND grantee = 'anon'
      AND privilege_type = 'SELECT';
    
    IF v_count > 0 THEN
      -- Try to actually query the view
      BEGIN
        EXECUTE format('SELECT 1 FROM public.%I LIMIT 1', v_result.view_name);
        RAISE NOTICE '✅ %-30s : anon has SELECT (verified)', v_result.view_name;
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
        RAISE NOTICE '⚠️  %-30s : grant exists but query failed: %', v_result.view_name, v_error;
        v_view_grants_ok := false;
      END;
    ELSE
      RAISE NOTICE '❌ %-30s : anon MISSING SELECT grant', v_result.view_name;
      v_view_grants_ok := false;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  
  -- =========================================
  -- SECTION 2: Check base table restrictions
  -- =========================================
  RAISE NOTICE '2. CHECKING BASE TABLE RESTRICTIONS (should have NO grants)';
  RAISE NOTICE '-----------------------------------------------------------';
  
  -- Base tables that should be protected
  FOR v_result IN 
    SELECT unnest(ARRAY[
      'news_trends',
      'stories',
      'snapshots',
      'ai_images',
      'system_meta',
      'stats',
      'image_files',
      'weekly_report_snapshots'
    ]) AS table_name
  LOOP
    -- Check grants
    SELECT COUNT(*) INTO v_count
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = v_result.table_name
      AND grantee IN ('anon', 'authenticated')
      AND privilege_type = 'SELECT';
    
    IF v_count > 0 THEN
      RAISE NOTICE '❌ %-30s : anon/authenticated HAS SELECT (SECURITY ISSUE!)', v_result.table_name;
      v_unauthorized_tables := array_append(v_unauthorized_tables, v_result.table_name);
      v_table_grants_ok := false;
    ELSE
      RAISE NOTICE '✅ %-30s : properly restricted', v_result.table_name;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  
  -- =========================================
  -- SECTION 3: Special checks for system_meta
  -- =========================================
  RAISE NOTICE '3. SYSTEM_META SPECIAL CHECKS';
  RAISE NOTICE '----------------------------';
  
  -- Check view configuration
  SELECT v.viewowner, 
         v.definition LIKE '%system_meta%' as refs_base_table,
         c.reloptions
  INTO v_result
  FROM pg_views v
  LEFT JOIN pg_class c ON c.relname = v.viewname AND c.relnamespace = 'public'::regnamespace
  WHERE v.schemaname = 'public' AND v.viewname = 'public_v_system_meta';
  
  IF FOUND THEN
    RAISE NOTICE '   View owner: %', v_result.viewowner;
    RAISE NOTICE '   References base table: %', v_result.refs_base_table;
    IF v_result.reloptions IS NOT NULL THEN
      RAISE NOTICE '   View options: %', v_result.reloptions;
    END IF;
  END IF;
  
  -- Test actual access
  BEGIN
    SELECT COUNT(*) INTO v_count FROM public.public_v_system_meta;
    RAISE NOTICE '   ✅ View query successful, % keys exposed', v_count;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    RAISE NOTICE '   ❌ View query failed: %', v_error;
  END;
  
  -- Check RPC function if exists
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_public_system_meta' 
    AND pronamespace = 'public'::regnamespace
  ) THEN
    BEGIN
      SELECT COUNT(*) INTO v_count FROM public.get_public_system_meta();
      RAISE NOTICE '   ✅ RPC function exists and works, % keys', v_count;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      RAISE NOTICE '   ⚠️  RPC function exists but failed: %', v_error;
    END;
  ELSE
    RAISE NOTICE '   ℹ️  No RPC fallback function found';
  END IF;
  
  RAISE NOTICE '';
  
  -- =========================================
  -- SECTION 4: Summary
  -- =========================================
  RAISE NOTICE '==================== SUMMARY ====================';
  
  IF array_length(v_missing_views, 1) > 0 THEN
    RAISE NOTICE '❌ Missing views: %', v_missing_views;
  END IF;
  
  IF array_length(v_unauthorized_tables, 1) > 0 THEN
    RAISE NOTICE '❌ Tables with unauthorized access: %', v_unauthorized_tables;
  END IF;
  
  IF v_view_grants_ok AND v_table_grants_ok AND array_length(v_missing_views, 1) IS NULL THEN
    RAISE NOTICE '✅ ALL PERMISSION CHECKS PASSED';
    RAISE NOTICE '   - All public views are accessible by anon';
    RAISE NOTICE '   - All base tables are protected from anon/authenticated';
    RAISE NOTICE '   - Security model is properly enforced';
  ELSE
    RAISE NOTICE '❌ PERMISSION ISSUES DETECTED';
    RAISE NOTICE '   - Run 2025-09-26_fix_system_meta_permissions.sql to fix';
    RAISE NOTICE '   - Check other migration scripts for missing views';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '========== END OF VERIFICATION REPORT ==========';
  RAISE NOTICE '';
  
  -- =========================================
  -- SECTION 5: Quick fixes (optional)
  -- =========================================
  IF NOT v_view_grants_ok THEN
    RAISE NOTICE '';
    RAISE NOTICE 'SUGGESTED FIXES:';
    RAISE NOTICE '-- Grant missing permissions on views:';
    FOR v_result IN 
      SELECT unnest(ARRAY[
        'public_v_home_news',
        'public_v_ai_images_latest', 
        'public_v_system_meta',
        'public_v_weekly_stats',
        'public_v_weekly_snapshots'
      ]) AS view_name
    LOOP
      RAISE NOTICE 'GRANT SELECT ON public.% TO anon, authenticated;', v_result.view_name;
    END LOOP;
  END IF;
  
  IF NOT v_table_grants_ok THEN
    RAISE NOTICE '';
    RAISE NOTICE '-- Revoke unauthorized permissions on base tables:';
    FOR v_result IN 
      SELECT unnest(v_unauthorized_tables) AS table_name
    LOOP
      RAISE NOTICE 'REVOKE ALL ON public.% FROM anon, authenticated;', v_result.table_name;
    END LOOP;
  END IF;
  
END $$;
