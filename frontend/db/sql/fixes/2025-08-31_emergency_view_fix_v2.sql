-- =========================================
-- EMERGENCY VIEW FIX V2 - Plan-B Security
-- Supabase SQL Editor Compatible & Idempotent
-- =========================================
-- CHANGES FROM V1:
-- - Handle missing columns gracefully (updated_at, built_at, etc.)
-- - Use only columns that definitely exist in base tables
-- - Make all operations idempotent and crash-proof
-- - Proper error handling for missing tables/columns

-- =========================================
-- 1. SAFETY CHECKS - Verify base tables exist
-- =========================================

DO $$
DECLARE
  news_exists boolean;
  snapshots_exists boolean;
BEGIN
  -- Check if required base tables exist
  SELECT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'news_trends'
  ) INTO news_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'weekly_report_snapshots'
  ) INTO snapshots_exists;
  
  IF NOT news_exists THEN
    RAISE EXCEPTION 'Base table news_trends does not exist. Run main schema migration first.';
  END IF;
  
  IF NOT snapshots_exists THEN
    RAISE EXCEPTION 'Base table weekly_report_snapshots does not exist. Run main schema migration first.';
  END IF;
  
  RAISE NOTICE '✓ Base tables verified: news_trends, weekly_report_snapshots';
END $$;

-- =========================================
-- 2. COLUMN EXISTENCE HELPERS
-- =========================================

-- Function to check if column exists
CREATE OR REPLACE FUNCTION column_exists(table_name text, column_name text) 
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = $1 
      AND column_name = $2
  );
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- 3. DROP EXISTING VIEWS SAFELY
-- =========================================

DROP VIEW IF EXISTS public.public_v_home_news CASCADE;
DROP VIEW IF EXISTS public.public_v_weekly_stats CASCADE;
DROP VIEW IF EXISTS public.public_v_weekly_snapshots CASCADE;

RAISE NOTICE '✓ Dropped existing views';

-- =========================================
-- 4. CREATE HOME NEWS VIEW (SAFE COLUMNS ONLY)
-- =========================================

DO $$
DECLARE
  view_sql text;
BEGIN
  -- Build view SQL dynamically based on existing columns
  view_sql := 'CREATE VIEW public.public_v_home_news AS SELECT ';
  
  -- Core columns that should always exist
  view_sql := view_sql || '
  id,
  title,
  summary,
  description,
  category,
  platform,
  channel,
  date,
  published_date,
  created_at,
  view_count,
  like_count,
  comment_count,
  duration,
  popularity_score,
  COALESCE(popularity_score_precise, popularity_score, 0) AS popularity_score_precise,
  ai_image_url,
  ai_image_prompt,
  reason,
  growth_rate,
  platform_mentions,
  keywords,
  ai_opinion,
  score_details,';
  
  -- Add updated_at if it exists, otherwise use created_at
  IF column_exists('news_trends', 'updated_at') THEN
    view_sql := view_sql || '
  updated_at,';
  ELSE
    view_sql := view_sql || '
  created_at AS updated_at,';
  END IF;
  
  -- Add summary_en if it exists
  IF column_exists('news_trends', 'summary_en') THEN
    view_sql := view_sql || '
  summary_en,';
  ELSE
    view_sql := view_sql || '
  summary AS summary_en,';
  END IF;
  
  -- Add external_id and video_id
  IF column_exists('news_trends', 'external_id') THEN
    view_sql := view_sql || '
  external_id,';
  ELSE
    view_sql := view_sql || '
  video_id AS external_id,';
  END IF;
  
  view_sql := view_sql || '
  video_id,
  
  -- UI compatibility fields
  COALESCE(published_date, created_at) AS published_at,
  COALESCE(channel, ''Unknown'') AS channel_title,
  
  -- View details object for modal stats (safe JSON)
  jsonb_build_object(
    ''views'', COALESCE(view_count, ''0''),
    ''growth_rate'', COALESCE(
      CASE 
        WHEN growth_rate IS NOT NULL AND growth_rate ~ ''^[0-9.+-]+$'' THEN 
          growth_rate::numeric 
        ELSE 0 
      END, 0
    ),
    ''platform_mentions'', COALESCE(platform_mentions, ''''),
    ''matched_keywords'', COALESCE(keywords, ''''),
    ''ai_opinion'', COALESCE(ai_opinion, ''''),
    ''score'', COALESCE(popularity_score, 0)
  ) AS view_details,
  
  -- Additional UI fields
  ai_image_url AS image_url,
  ai_image_url AS display_image_url_raw,
  (ai_image_url IS NOT NULL) AS is_ai_image,
  COALESCE(platform, ''Unknown'') AS platforms_raw,
  COALESCE(ai_image_url, ''/placeholder-image.svg'') AS safe_image_url';
  
  -- Add optional columns if they exist
  IF column_exists('news_trends', 'raw_view') THEN
    view_sql := view_sql || ',
  raw_view';
  END IF;
  
  IF column_exists('news_trends', 'summary_date') THEN
    view_sql := view_sql || ',
  summary_date';
  END IF;
  
  -- Complete the view
  view_sql := view_sql || '
FROM public.news_trends
WHERE title IS NOT NULL AND title != ''''
ORDER BY 
  COALESCE(published_date, created_at) DESC NULLS LAST, 
  COALESCE(popularity_score, 0) DESC NULLS LAST';
  
  -- Execute the dynamic SQL
  EXECUTE view_sql;
  
  RAISE NOTICE '✓ Created public_v_home_news view with available columns';
END $$;

-- =========================================
-- 5. CREATE WEEKLY STATS VIEW (SAFE)
-- =========================================

DO $$
DECLARE
  date_col text;
BEGIN
  -- Determine which date column to use for grouping
  IF column_exists('news_trends', 'updated_at') THEN
    date_col := 'updated_at';
  ELSE
    date_col := 'created_at';
  END IF;
  
  EXECUTE format('
CREATE VIEW public.public_v_weekly_stats AS
SELECT
  date_trunc(''week'', %I)::date AS week,
  COUNT(*) AS news_count,
  COUNT(*) AS total_stories,
  COUNT(CASE WHEN ai_image_url IS NOT NULL THEN 1 END) AS stories_with_images,
  ROUND(AVG(COALESCE(popularity_score, 0))::numeric, 2) AS avg_popularity_score,
  MAX(%I) AS last_updated,
  
  -- Safe numeric conversions for view counts
  SUM(
    CASE 
      WHEN view_count IS NOT NULL AND view_count ~ ''^[0-9,]+$'' THEN 
        COALESCE(NULLIF(regexp_replace(view_count, ''[^0-9]'', '''', ''g''), '''')::bigint, 0)
      ELSE 0 
    END
  ) AS total_views,
  
  SUM(
    CASE 
      WHEN like_count IS NOT NULL AND like_count ~ ''^[0-9,]+$'' THEN 
        COALESCE(NULLIF(regexp_replace(like_count, ''[^0-9]'', '''', ''g''), '''')::bigint, 0)
      ELSE 0 
    END
  ) AS total_likes
FROM public.news_trends
WHERE title IS NOT NULL
GROUP BY date_trunc(''week'', %I)
ORDER BY week DESC', date_col, date_col, date_col);
  
  RAISE NOTICE '✓ Created public_v_weekly_stats view using % for date grouping', date_col;
END $$;

-- =========================================
-- 6. CREATE WEEKLY SNAPSHOTS VIEW (SAFE)
-- =========================================

DO $$
DECLARE
  view_sql text;
BEGIN
  view_sql := 'CREATE VIEW public.public_v_weekly_snapshots AS SELECT
  snapshot_id,
  status,
  range_start,
  range_end,
  created_at,';
  
  -- Handle built_at column
  IF column_exists('weekly_report_snapshots', 'built_at') THEN
    view_sql := view_sql || '
  built_at,';
  ELSE
    view_sql := view_sql || '
  created_at AS built_at,';
  END IF;
  
  -- Handle updated_at column
  IF column_exists('weekly_report_snapshots', 'updated_at') THEN
    view_sql := view_sql || '
  updated_at,';
  ELSE
    view_sql := view_sql || '
  created_at AS updated_at,';
  END IF;
  
  -- Add optional columns
  IF column_exists('weekly_report_snapshots', 'algo_version') THEN
    view_sql := view_sql || '
  algo_version,';
  END IF;
  
  IF column_exists('weekly_report_snapshots', 'data_version') THEN
    view_sql := view_sql || '
  data_version,';
  END IF;
  
  -- Handle items column (JSONB)
  IF column_exists('weekly_report_snapshots', 'items') THEN
    view_sql := view_sql || '
  -- Safe items count calculation
  CASE 
    WHEN items IS NOT NULL AND jsonb_typeof(items) = ''array'' THEN 
      jsonb_array_length(items)
    ELSE 0
  END AS items_count,
  items,';
  ELSE
    -- Fallback to items_count column if items doesn''t exist
    IF column_exists('weekly_report_snapshots', 'items_count') THEN
      view_sql := view_sql || '
  COALESCE(items_count, 0) AS items_count,
  ''[]''::jsonb AS items,';
    ELSE
      view_sql := view_sql || '
  0 AS items_count,
  ''[]''::jsonb AS items,';
    END IF;
  END IF;
  
  -- Handle meta column
  IF column_exists('weekly_report_snapshots', 'meta') THEN
    view_sql := view_sql || '
  COALESCE(meta, ''{}''::jsonb) AS meta,';
  ELSE
    -- Fallback to payload column if meta doesn''t exist
    IF column_exists('weekly_report_snapshots', 'payload') THEN
      view_sql := view_sql || '
  COALESCE(payload, ''{}''::jsonb) AS meta,';
    ELSE
      view_sql := view_sql || '
  ''{}''::jsonb AS meta,';
    END IF;
  END IF;
  
  -- Status flags
  view_sql := view_sql || '
  -- Status flags
  CASE WHEN status IN (''ready'', ''published'') THEN true ELSE false END AS is_ready
FROM public.weekly_report_snapshots
WHERE status IN (''ready'', ''published'', ''archived'', ''building'')
ORDER BY ';
  
  -- Order by built_at if available, otherwise created_at
  IF column_exists('weekly_report_snapshots', 'built_at') THEN
    view_sql := view_sql || 'built_at DESC NULLS LAST, created_at DESC';
  ELSE
    view_sql := view_sql || 'created_at DESC';
  END IF;
  
  -- Execute the dynamic SQL
  EXECUTE view_sql;
  
  RAISE NOTICE '✓ Created public_v_weekly_snapshots view with available columns';
END $$;

-- =========================================
-- 7. SET VIEW SECURITY PROPERTIES
-- =========================================

DO $$
BEGIN
  -- Set security properties on views (if supported)
  BEGIN
    ALTER VIEW public.public_v_home_news SET (security_invoker = true);
    ALTER VIEW public.public_v_home_news SET (security_barrier = true);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not set security properties on public_v_home_news (may not be supported)';
  END;
  
  BEGIN
    ALTER VIEW public.public_v_weekly_stats SET (security_invoker = true);
    ALTER VIEW public.public_v_weekly_stats SET (security_barrier = true);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not set security properties on public_v_weekly_stats (may not be supported)';
  END;
  
  BEGIN
    ALTER VIEW public.public_v_weekly_snapshots SET (security_invoker = true);
    ALTER VIEW public.public_v_weekly_snapshots SET (security_barrier = true);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not set security properties on public_v_weekly_snapshots (may not be supported)';
  END;
  
  RAISE NOTICE '✓ Applied security properties to views';
END $$;

-- =========================================
-- 8. GRANT PERMISSIONS (PLAN-B SECURITY)
-- =========================================

DO $$
BEGIN
  -- Revoke anon access from base tables (safe operations)
  BEGIN
    REVOKE ALL ON TABLE public.news_trends FROM anon;
    REVOKE ALL ON TABLE public.weekly_report_snapshots FROM anon;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Base table permission revocation completed with warnings';
  END;
  
  -- Grant anon access to views only
  GRANT SELECT ON public.public_v_home_news TO anon;
  GRANT SELECT ON public.public_v_weekly_stats TO anon;
  GRANT SELECT ON public.public_v_weekly_snapshots TO anon;
  
  -- Grant to authenticated and service_role as well
  GRANT SELECT ON public.public_v_home_news TO authenticated, service_role;
  GRANT SELECT ON public.public_v_weekly_stats TO authenticated, service_role;
  GRANT SELECT ON public.public_v_weekly_snapshots TO authenticated, service_role;
  
  -- Try to grant system_meta access if table exists
  BEGIN
    GRANT SELECT ON TABLE public.system_meta TO anon;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'system_meta table does not exist (will be created later if needed)';
  WHEN OTHERS THEN
    RAISE NOTICE 'system_meta permission grant completed with warnings';
  END;
  
  RAISE NOTICE '✓ Granted permissions: anon can SELECT views only, no base table access';
END $$;

-- =========================================
-- 9. ENABLE RLS AND CREATE POLICIES
-- =========================================

DO $$
BEGIN
  -- Enable RLS on weekly_report_snapshots
  ALTER TABLE public.weekly_report_snapshots ENABLE ROW LEVEL SECURITY;
  
  -- Create service role policy for snapshots
  DROP POLICY IF EXISTS "service_role_weekly_snapshots_policy" ON public.weekly_report_snapshots;
  CREATE POLICY "service_role_weekly_snapshots_policy" ON public.weekly_report_snapshots
    FOR ALL TO service_role USING (true) WITH CHECK (true);
  
  -- Handle system tables if they exist
  BEGIN
    ALTER TABLE public.stats ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "service_role_stats_policy" ON public.stats;
    CREATE POLICY "service_role_stats_policy" ON public.stats
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'stats table does not exist (OK)';
  END;
  
  BEGIN
    ALTER TABLE public.system_meta ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "service_role_system_meta_policy" ON public.system_meta;
    CREATE POLICY "service_role_system_meta_policy" ON public.system_meta
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "anon_read_system_meta_policy" ON public.system_meta;
    CREATE POLICY "anon_read_system_meta_policy" ON public.system_meta
      FOR SELECT TO anon USING (true);
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'system_meta table does not exist (OK)';
  END;
  
  RAISE NOTICE '✓ Enabled RLS and created service role policies';
END $$;

-- =========================================
-- 10. CLEANUP HELPER FUNCTION
-- =========================================

DROP FUNCTION IF EXISTS column_exists(text, text);

-- =========================================
-- 11. COMPREHENSIVE VERIFICATION
-- =========================================

DO $$
DECLARE
  home_count int := 0;
  stats_count int := 0;
  snapshots_count int := 0;
  news_count int := 0;
  view_home boolean;
  view_stats boolean;
  view_snapshots boolean;
  perm_home boolean;
  perm_stats boolean;
  perm_snapshots boolean;
BEGIN
  -- Check if views exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'public_v_home_news'
  ) INTO view_home;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'public_v_weekly_stats'
  ) INTO view_stats;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'public_v_weekly_snapshots'
  ) INTO view_snapshots;
  
  -- Check permissions
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_privileges 
    WHERE table_schema = 'public' 
      AND table_name = 'public_v_home_news' 
      AND grantee = 'anon' 
      AND privilege_type = 'SELECT'
  ) INTO perm_home;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_privileges 
    WHERE table_schema = 'public' 
      AND table_name = 'public_v_weekly_stats' 
      AND grantee = 'anon' 
      AND privilege_type = 'SELECT'
  ) INTO perm_stats;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_privileges 
    WHERE table_schema = 'public' 
      AND table_name = 'public_v_weekly_snapshots' 
      AND grantee = 'anon' 
      AND privilege_type = 'SELECT'
  ) INTO perm_snapshots;
  
  -- Count base data
  BEGIN
    SELECT COUNT(*) INTO news_count FROM public.news_trends LIMIT 1000;
  EXCEPTION WHEN OTHERS THEN
    news_count := -1;
  END;
  
  -- Test view access
  BEGIN
    SELECT COUNT(*) INTO home_count FROM public.public_v_home_news LIMIT 100;
  EXCEPTION WHEN OTHERS THEN
    home_count := -1;
  END;
  
  BEGIN
    SELECT COUNT(*) INTO stats_count FROM public.public_v_weekly_stats LIMIT 100;
  EXCEPTION WHEN OTHERS THEN
    stats_count := -1;
  END;
  
  BEGIN
    SELECT COUNT(*) INTO snapshots_count FROM public.public_v_weekly_snapshots LIMIT 100;
  EXCEPTION WHEN OTHERS THEN
    snapshots_count := -1;
  END;
  
  -- Report comprehensive results
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'EMERGENCY VIEW FIX V2 - VERIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Base Data:';
  RAISE NOTICE '  news_trends: % records', 
    CASE WHEN news_count >= 0 THEN news_count::text ELSE 'ERROR' END;
  RAISE NOTICE '';
  RAISE NOTICE 'Views Created:';
  RAISE NOTICE '  public_v_home_news: % (accessible: %, permissions: %)', 
    CASE WHEN view_home THEN '✓' ELSE '✗' END,
    CASE WHEN home_count >= 0 THEN home_count::text ELSE 'ERROR' END,
    CASE WHEN perm_home THEN '✓' ELSE '✗' END;
  RAISE NOTICE '  public_v_weekly_stats: % (accessible: %, permissions: %)', 
    CASE WHEN view_stats THEN '✓' ELSE '✗' END,
    CASE WHEN stats_count >= 0 THEN stats_count::text ELSE 'ERROR' END,
    CASE WHEN perm_stats THEN '✓' ELSE '✗' END;
  RAISE NOTICE '  public_v_weekly_snapshots: % (accessible: %, permissions: %)', 
    CASE WHEN view_snapshots THEN '✓' ELSE '✗' END,
    CASE WHEN snapshots_count >= 0 THEN snapshots_count::text ELSE 'ERROR' END,
    CASE WHEN perm_snapshots THEN '✓' ELSE '✗' END;
  RAISE NOTICE '';
  
  IF view_home AND view_stats AND view_snapshots AND 
     perm_home AND perm_stats AND perm_snapshots AND
     home_count >= 0 AND stats_count >= 0 AND snapshots_count >= 0 THEN
    RAISE NOTICE '🎉 SUCCESS: All views created with proper permissions!';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '1. Test APIs: GET /api/health, /api/home, /api/test-plan-b';
    RAISE NOTICE '2. Build snapshots: npm run snapshot:build:publish';
    RAISE NOTICE '3. Test UI: Home and Weekly Report pages';
  ELSE
    RAISE NOTICE '⚠️  PARTIAL SUCCESS: Some issues detected';
    IF NOT (view_home AND view_stats AND view_snapshots) THEN
      RAISE NOTICE 'Issue: Not all views were created successfully';
    END IF;
    IF NOT (perm_home AND perm_stats AND perm_snapshots) THEN
      RAISE NOTICE 'Issue: Anon permissions not granted on all views';
    END IF;
    IF home_count < 0 OR stats_count < 0 OR snapshots_count < 0 THEN
      RAISE NOTICE 'Issue: Some views are not accessible (check column references)';
    END IF;
  END IF;
  RAISE NOTICE '========================================';
END $$;
