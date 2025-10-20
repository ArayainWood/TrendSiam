-- =========================================================
-- VERIFY HOME VIEW COLUMNS AND GRANTS
-- Date: 2025-09-26
--
-- Comprehensive verification of:
-- 1. Column names match frontend expectations exactly
-- 2. Grants are properly set for Plan-B security
-- 3. View returns data
-- =========================================================

DO $$
DECLARE
  v_result RECORD;
  v_count INTEGER;
  v_error TEXT;
  v_issues INTEGER := 0;
  v_columns TEXT[];
  v_expected_columns TEXT[] := ARRAY[
    'id', 'title', 'summary', 'summary_en', 'category', 'platform',
    'channel', 'published_at', 'source_url', 'image_url', 'ai_prompt',
    'popularity_score', 'rank', 'is_top3', 'views', 'likes', 'comments',
    'growth_rate_value', 'growth_rate_label', 'ai_opinion', 'score_details',
    'video_id', 'external_id', 'platform_mentions', 'keywords', 'updated_at'
  ];
  v_actual_columns TEXT[];
  v_missing_columns TEXT[];
  v_extra_columns TEXT[];
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========== HOME VIEW COLUMNS AND GRANTS VERIFICATION ==========';
  RAISE NOTICE 'Timestamp: %', NOW();
  RAISE NOTICE '';
  
  -- =========================================
  -- SECTION 1: Column Verification
  -- =========================================
  RAISE NOTICE '1. COLUMN VERIFICATION';
  RAISE NOTICE '---------------------';
  
  -- Get actual columns from view
  SELECT array_agg(column_name ORDER BY ordinal_position)
  INTO v_actual_columns
  FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'public_v_home_news';
  
  IF v_actual_columns IS NULL THEN
    RAISE WARNING '❌ View public_v_home_news does not exist!';
    v_issues := v_issues + 1;
  ELSE
    -- Check if columns match exactly
    IF v_actual_columns = v_expected_columns THEN
      RAISE NOTICE '✅ All 26 columns present in correct order';
    ELSE
      RAISE WARNING '❌ Column mismatch detected!';
      v_issues := v_issues + 1;
      
      -- Find missing columns
      SELECT array_agg(col) INTO v_missing_columns
      FROM unnest(v_expected_columns) AS col
      WHERE col NOT IN (SELECT unnest(v_actual_columns));
      
      IF v_missing_columns IS NOT NULL THEN
        RAISE WARNING '   Missing columns: %', v_missing_columns;
      END IF;
      
      -- Find extra columns
      SELECT array_agg(col) INTO v_extra_columns
      FROM unnest(v_actual_columns) AS col
      WHERE col NOT IN (SELECT unnest(v_expected_columns));
      
      IF v_extra_columns IS NOT NULL THEN
        RAISE WARNING '   Extra columns: %', v_extra_columns;
      END IF;
      
      -- Show column order
      RAISE NOTICE '   Expected order: %', v_expected_columns;
      RAISE NOTICE '   Actual order: %', v_actual_columns;
    END IF;
  END IF;
  
  RAISE NOTICE '';
  
  -- =========================================
  -- SECTION 2: Data Verification
  -- =========================================
  RAISE NOTICE '2. DATA VERIFICATION';
  RAISE NOTICE '--------------------';
  
  -- Check if view returns data
  BEGIN
    SELECT COUNT(*) INTO v_count FROM public.public_v_home_news;
    IF v_count = 0 THEN
      RAISE WARNING '⚠️  View returns 0 rows';
      
      -- Check base table
      SELECT COUNT(*) INTO v_count FROM news_trends WHERE title IS NOT NULL AND title != '';
      RAISE NOTICE '   Base news_trends table has % valid rows', v_count;
      
      IF v_count > 0 THEN
        RAISE WARNING '   ❌ Base table has data but view returns nothing!';
        v_issues := v_issues + 1;
      END IF;
    ELSE
      RAISE NOTICE '✅ View returns % rows', v_count;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    RAISE WARNING '❌ Cannot query view: %', v_error;
    v_issues := v_issues + 1;
  END;
  
  -- Check view definition for meta dependencies
  IF EXISTS (
    SELECT 1 
    FROM pg_views 
    WHERE schemaname = 'public' 
      AND viewname = 'public_v_home_news'
      AND (definition LIKE '%system_meta%' OR definition LIKE '%public_v_system_meta%')
  ) THEN
    RAISE WARNING '❌ View still has system_meta dependencies!';
    v_issues := v_issues + 1;
  ELSE
    RAISE NOTICE '✅ View has no system_meta dependencies';
  END IF;
  
  RAISE NOTICE '';
  
  -- =========================================
  -- SECTION 3: Grant Verification
  -- =========================================
  RAISE NOTICE '3. GRANT VERIFICATION';
  RAISE NOTICE '---------------------';
  
  -- Ensure proper grants on view
  GRANT SELECT ON public.public_v_home_news TO anon, authenticated;
  RAISE NOTICE '✅ Applied: GRANT SELECT ON public_v_home_news TO anon, authenticated';
  
  -- Revoke access to base tables
  REVOKE ALL ON news_trends FROM anon, authenticated;
  REVOKE ALL ON stories FROM anon, authenticated;
  REVOKE ALL ON snapshots FROM anon, authenticated;
  REVOKE ALL ON ai_images FROM anon, authenticated;
  REVOKE ALL ON system_meta FROM anon, authenticated;
  RAISE NOTICE '✅ Applied: REVOKE ALL on base tables FROM anon, authenticated';
  
  -- Verify grants
  FOR v_result IN 
    SELECT 
      rg.grantee::text,
      rg.privilege_type,
      rg.table_name
    FROM information_schema.role_table_grants rg
    WHERE rg.table_schema = 'public'
      AND rg.table_name = 'public_v_home_news'
      AND rg.grantee IN ('anon', 'authenticated')
    ORDER BY rg.grantee, rg.privilege_type
  LOOP
    RAISE NOTICE '   ✅ % has % on %', v_result.grantee, v_result.privilege_type, v_result.table_name;
  END LOOP;
  
  -- Check for unwanted base table access
  FOR v_result IN 
    SELECT 
      rg.table_name,
      rg.grantee::text,
      rg.privilege_type
    FROM information_schema.role_table_grants rg
    WHERE rg.table_schema = 'public'
      AND rg.table_name IN ('news_trends', 'stories', 'snapshots', 'ai_images', 'system_meta')
      AND rg.grantee IN ('anon', 'authenticated')
  LOOP
    RAISE WARNING '   ❌ Unwanted grant: % has % on base table %', 
      v_result.grantee, v_result.privilege_type, v_result.table_name;
    v_issues := v_issues + 1;
  END LOOP;
  
  RAISE NOTICE '';
  
  -- =========================================
  -- SECTION 4: Sample Data Test
  -- =========================================
  RAISE NOTICE '4. SAMPLE DATA TEST';
  RAISE NOTICE '-------------------';
  
  -- Try to fetch a sample row
  BEGIN
    SELECT 
      id IS NOT NULL AS has_id,
      title IS NOT NULL AS has_title,
      source_url IS NOT NULL AS has_source_url,
      published_at IS NOT NULL AS has_published_at,
      rank IS NOT NULL AS has_rank
    INTO v_result
    FROM public.public_v_home_news
    LIMIT 1;
    
    IF FOUND THEN
      RAISE NOTICE '✅ Sample row checks:';
      RAISE NOTICE '   id: %', CASE WHEN v_result.has_id THEN 'present' ELSE 'NULL' END;
      RAISE NOTICE '   title: %', CASE WHEN v_result.has_title THEN 'present' ELSE 'NULL' END;
      RAISE NOTICE '   source_url: %', CASE WHEN v_result.has_source_url THEN 'present' ELSE 'NULL' END;
      RAISE NOTICE '   published_at: %', CASE WHEN v_result.has_published_at THEN 'present' ELSE 'NULL' END;
      RAISE NOTICE '   rank: %', CASE WHEN v_result.has_rank THEN 'present' ELSE 'NULL' END;
    ELSE
      RAISE NOTICE '⚠️  No sample row available';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    RAISE WARNING '❌ Cannot fetch sample row: %', v_error;
  END;
  
  RAISE NOTICE '';
  
  -- =========================================
  -- SECTION 5: Summary
  -- =========================================
  RAISE NOTICE '==================== SUMMARY ====================';
  
  IF v_issues = 0 THEN
    RAISE NOTICE '✅ ALL CHECKS PASSED';
    RAISE NOTICE '   - All 26 columns present in correct order';
    RAISE NOTICE '   - View has no system_meta dependencies';
    RAISE NOTICE '   - Proper grants applied (anon/authenticated can SELECT)';
    RAISE NOTICE '   - Base tables protected from anon/authenticated';
    
    SELECT COUNT(*) INTO v_count FROM public.public_v_home_news;
    IF v_count > 0 THEN
      RAISE NOTICE '   - View returns % rows', v_count;
    ELSE
      RAISE NOTICE '   - WARNING: View returns 0 rows (check if data exists)';
    END IF;
  ELSE
    RAISE WARNING '❌ FOUND % ISSUES - Review warnings above', v_issues;
    RAISE NOTICE '';
    RAISE NOTICE 'Common fixes:';
    RAISE NOTICE '1. Ensure news_trends table has data with non-empty titles';
    RAISE NOTICE '2. Run 2025-09-26_fix_public_v_home_news_rows.sql';
    RAISE NOTICE '3. Check for any custom modifications to the view';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '========== END OF VERIFICATION ==========';
  RAISE NOTICE '';
END $$;
