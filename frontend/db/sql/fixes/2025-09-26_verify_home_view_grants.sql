-- =========================================================
-- VERIFY HOME VIEW GRANTS AND PERMISSIONS
-- Date: 2025-09-26
--
-- Comprehensive verification that:
-- 1. All public views are accessible by anon/authenticated
-- 2. No base tables are accessible by anon/authenticated
-- 3. public_v_home_news uses public_v_system_meta (not system_meta)
-- =========================================================

DO $$
DECLARE
  v_result RECORD;
  v_count INTEGER;
  v_error TEXT;
  v_issues INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========== HOME VIEW GRANTS VERIFICATION ==========';
  RAISE NOTICE 'Timestamp: %', NOW();
  RAISE NOTICE '';
  
  -- =========================================
  -- SECTION 1: View Dependencies Check
  -- =========================================
  RAISE NOTICE '1. CHECKING VIEW DEPENDENCIES';
  RAISE NOTICE '-----------------------------';
  
  -- Check if public_v_home_news references system_meta directly
  IF EXISTS (
    SELECT 1 
    FROM pg_views 
    WHERE schemaname = 'public' 
      AND viewname = 'public_v_home_news'
      AND definition LIKE '%FROM system_meta%'
      AND definition NOT LIKE '%public_v_system_meta%'
  ) THEN
    RAISE WARNING '❌ public_v_home_news still references system_meta base table!';
    v_issues := v_issues + 1;
  ELSE
    RAISE NOTICE '✅ public_v_home_news correctly uses public_v_system_meta';
  END IF;
  
  -- Check if other views exist
  FOR v_result IN 
    SELECT viewname, 
           CASE 
             WHEN definition LIKE '%FROM system_meta%' 
                  AND definition NOT LIKE '%public_v_system_meta%' 
             THEN 'REFERENCES system_meta directly'
             ELSE 'OK'
           END AS status
    FROM pg_views 
    WHERE schemaname = 'public' 
      AND viewname IN ('public_v_home_news', 'public_v_ai_images_latest', 'public_v_system_meta')
  LOOP
    RAISE NOTICE '   View: %-30s Status: %', v_result.viewname, v_result.status;
    IF v_result.status != 'OK' THEN
      v_issues := v_issues + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  
  -- =========================================
  -- SECTION 2: Grant Permissions on Views
  -- =========================================
  RAISE NOTICE '2. ENSURING VIEW PERMISSIONS';
  RAISE NOTICE '----------------------------';
  
  -- Grant SELECT on all public views
  GRANT SELECT ON public.public_v_home_news TO anon, authenticated;
  GRANT SELECT ON public.public_v_ai_images_latest TO anon, authenticated;
  GRANT SELECT ON public.public_v_system_meta TO anon, authenticated;
  
  RAISE NOTICE '✅ Granted SELECT on public_v_home_news to anon, authenticated';
  RAISE NOTICE '✅ Granted SELECT on public_v_ai_images_latest to anon, authenticated';
  RAISE NOTICE '✅ Granted SELECT on public_v_system_meta to anon, authenticated';
  
  RAISE NOTICE '';
  
  -- =========================================
  -- SECTION 3: Revoke Base Table Access
  -- =========================================
  RAISE NOTICE '3. REVOKING BASE TABLE ACCESS';
  RAISE NOTICE '-----------------------------';
  
  -- Revoke all permissions on base tables from anon/authenticated
  REVOKE ALL ON news_trends FROM anon, authenticated;
  REVOKE ALL ON stories FROM anon, authenticated;
  REVOKE ALL ON snapshots FROM anon, authenticated;
  REVOKE ALL ON ai_images FROM anon, authenticated;
  REVOKE ALL ON system_meta FROM anon, authenticated;
  REVOKE ALL ON stats FROM anon, authenticated;
  REVOKE ALL ON weekly_report_snapshots FROM anon, authenticated;
  
  RAISE NOTICE '✅ Revoked all permissions on base tables from anon/authenticated';
  
  RAISE NOTICE '';
  
  -- =========================================
  -- SECTION 4: Verify Access Patterns
  -- =========================================
  RAISE NOTICE '4. VERIFYING ACCESS PATTERNS';
  RAISE NOTICE '----------------------------';
  
  -- Check view access
  FOR v_result IN 
    SELECT 
      t.table_name,
      string_agg(DISTINCT rg.grantee::text, ', ') AS grantees,
      string_agg(DISTINCT rg.privilege_type, ', ') AS privileges
    FROM information_schema.tables t
    LEFT JOIN information_schema.role_table_grants rg 
      ON rg.table_schema = t.table_schema 
      AND rg.table_name = t.table_name
      AND rg.grantee IN ('anon', 'authenticated')
    WHERE t.table_schema = 'public'
      AND t.table_name IN (
        'public_v_home_news', 
        'public_v_ai_images_latest', 
        'public_v_system_meta'
      )
    GROUP BY t.table_name
    ORDER BY t.table_name
  LOOP
    IF v_result.privileges IS NULL THEN
      RAISE WARNING '❌ View % has NO grants to anon/authenticated!', v_result.table_name;
      v_issues := v_issues + 1;
    ELSE
      RAISE NOTICE '✅ View %-30s Grantees: %-20s Privileges: %', 
        v_result.table_name, v_result.grantees, v_result.privileges;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  
  -- Check base table access (should be empty)
  FOR v_result IN 
    SELECT 
      t.table_name,
      rg.grantee,
      rg.privilege_type
    FROM information_schema.role_table_grants rg
    JOIN information_schema.tables t 
      ON rg.table_schema = t.table_schema 
      AND rg.table_name = t.table_name
    WHERE rg.table_schema = 'public'
      AND rg.table_name IN (
        'news_trends', 'stories', 'snapshots', 
        'ai_images', 'system_meta', 'stats',
        'weekly_report_snapshots'
      )
      AND rg.grantee IN ('anon', 'authenticated')
    ORDER BY t.table_name, rg.grantee
  LOOP
    RAISE WARNING '❌ Base table % still has % grant to %!', 
      v_result.table_name, v_result.privilege_type, v_result.grantee;
    v_issues := v_issues + 1;
  END LOOP;
  
  IF v_issues = 0 THEN
    RAISE NOTICE '✅ No base table access found for anon/authenticated (correct)';
  END IF;
  
  RAISE NOTICE '';
  
  -- =========================================
  -- SECTION 5: Functional Tests
  -- =========================================
  RAISE NOTICE '5. FUNCTIONAL ACCESS TESTS';
  RAISE NOTICE '--------------------------';
  
  -- Test public_v_home_news
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public.public_v_home_news' INTO v_count;
    RAISE NOTICE '✅ public_v_home_news accessible, % rows', v_count;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    RAISE WARNING '❌ public_v_home_news error: %', v_error;
    v_issues := v_issues + 1;
  END;
  
  -- Test public_v_system_meta
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public.public_v_system_meta' INTO v_count;
    RAISE NOTICE '✅ public_v_system_meta accessible, % keys', v_count;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    RAISE WARNING '❌ public_v_system_meta error: %', v_error;
    v_issues := v_issues + 1;
  END;
  
  -- Test public_v_ai_images_latest
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public.public_v_ai_images_latest' INTO v_count;
    RAISE NOTICE '✅ public_v_ai_images_latest accessible, % images', v_count;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    RAISE WARNING '❌ public_v_ai_images_latest error: %', v_error;
    v_issues := v_issues + 1;
  END;
  
  -- Test that system_meta is NOT accessible
  BEGIN
    EXECUTE 'SELECT 1 FROM public.system_meta LIMIT 1' INTO v_count;
    RAISE WARNING '❌ SECURITY ISSUE: system_meta is still accessible!';
    v_issues := v_issues + 1;
  EXCEPTION 
    WHEN insufficient_privilege THEN
      RAISE NOTICE '✅ system_meta properly protected (permission denied)';
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      RAISE NOTICE '✅ system_meta protected with error: %', v_error;
  END;
  
  RAISE NOTICE '';
  
  -- =========================================
  -- SECTION 6: Summary
  -- =========================================
  RAISE NOTICE '==================== SUMMARY ====================';
  
  IF v_issues = 0 THEN
    RAISE NOTICE '✅ ALL CHECKS PASSED';
    RAISE NOTICE '   - public_v_home_news uses public_v_system_meta (not system_meta)';
    RAISE NOTICE '   - All public views are accessible by anon/authenticated';
    RAISE NOTICE '   - All base tables are protected from anon/authenticated';
    RAISE NOTICE '   - Security model is properly enforced';
  ELSE
    RAISE WARNING '❌ FOUND % ISSUES - Review warnings above', v_issues;
    RAISE NOTICE '';
    RAISE NOTICE 'To fix remaining issues:';
    RAISE NOTICE '1. Run 2025-09-26_fix_public_v_home_news_definer.sql';
    RAISE NOTICE '2. Run 2025-09-26_fix_system_meta_permissions.sql';
    RAISE NOTICE '3. Check for any custom views referencing base tables';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '========== END OF VERIFICATION ==========';
  RAISE NOTICE '';
END $$;
