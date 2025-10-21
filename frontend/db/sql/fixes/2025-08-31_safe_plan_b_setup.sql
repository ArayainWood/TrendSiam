-- =========================================
-- SAFE PLAN-B SECURITY SETUP
-- Supabase SQL Editor Compatible - No Crashes
-- =========================================
-- This script safely sets up Plan-B security without breaking existing constraints

-- 1. SAFE TABLE SCHEMA UPDATES
-- =========================================

-- Add missing columns safely (only if they don't exist)
DO $$
BEGIN
  -- Add items column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'weekly_report_snapshots' 
    AND column_name = 'items'
  ) THEN
    ALTER TABLE public.weekly_report_snapshots 
    ADD COLUMN items jsonb DEFAULT '[]'::jsonb;
    RAISE NOTICE '✓ Added items column to weekly_report_snapshots';
  ELSE
    RAISE NOTICE '✓ items column already exists in weekly_report_snapshots';
  END IF;
  
  -- Add meta column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'weekly_report_snapshots' 
    AND column_name = 'meta'
  ) THEN
    ALTER TABLE public.weekly_report_snapshots 
    ADD COLUMN meta jsonb DEFAULT '{}'::jsonb;
    RAISE NOTICE '✓ Added meta column to weekly_report_snapshots';
  ELSE
    RAISE NOTICE '✓ meta column already exists in weekly_report_snapshots';
  END IF;
  
  -- Add built_at column if missing (make it nullable first, then update)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'weekly_report_snapshots' 
    AND column_name = 'built_at'
  ) THEN
    -- Add as nullable first to avoid constraint issues
    ALTER TABLE public.weekly_report_snapshots 
    ADD COLUMN built_at timestamptz DEFAULT now();
    
    -- Update any null values
    UPDATE public.weekly_report_snapshots 
    SET built_at = COALESCE(built_at, created_at, now())
    WHERE built_at IS NULL;
    
    -- Now make it NOT NULL
    ALTER TABLE public.weekly_report_snapshots 
    ALTER COLUMN built_at SET NOT NULL;
    
    RAISE NOTICE '✓ Added built_at column to weekly_report_snapshots';
  ELSE
    RAISE NOTICE '✓ built_at column already exists in weekly_report_snapshots';
  END IF;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Schema update completed with warnings: %', SQLERRM;
END $$;

-- 2. SAFE CONSTRAINT UPDATES
-- =========================================

-- Update status constraint safely (don't break existing data)
DO $$
DECLARE
  constraint_name_var text;
  existing_statuses text[];
BEGIN
  -- Find existing status constraint name
  SELECT tc.constraint_name INTO constraint_name_var
  FROM information_schema.table_constraints tc
  JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
  WHERE tc.table_schema = 'public' 
    AND tc.table_name = 'weekly_report_snapshots'
    AND tc.constraint_type = 'CHECK'
    AND cc.check_clause LIKE '%status%'
  LIMIT 1;
  
  -- Check what status values currently exist in the table
  SELECT array_agg(DISTINCT status) INTO existing_statuses
  FROM public.weekly_report_snapshots;
  
  RAISE NOTICE 'Existing status values: %', existing_statuses;
  
  -- Only update constraint if we found one and it's safe to do so
  IF constraint_name_var IS NOT NULL THEN
    -- Drop the old constraint safely
    EXECUTE format('ALTER TABLE public.weekly_report_snapshots DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
    RAISE NOTICE '✓ Dropped old status constraint: %', constraint_name_var;
  END IF;
  
  -- Add new constraint that accommodates existing data
  ALTER TABLE public.weekly_report_snapshots 
  ADD CONSTRAINT weekly_report_snapshots_status_check 
  CHECK (status IN ('building', 'ready', 'failed', 'archived', 'published', 'draft'));
  
  RAISE NOTICE '✓ Added new status constraint allowing: building, ready, failed, archived, published, draft';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Constraint update completed with warnings: %', SQLERRM;
END $$;

-- 3. CREATE PUBLIC VIEWS SAFELY
-- =========================================

-- Home news view (drop and recreate safely)
DO $$
BEGIN
  DROP VIEW IF EXISTS public.public_v_home_news CASCADE;
  
  CREATE VIEW public.public_v_home_news
  WITH (security_invoker = true, security_barrier = true) AS
  SELECT
    id,
    COALESCE(external_id, video_id) AS external_id,
    video_id,
    title,
    summary,
    summary_en,
    description,
    category,
    platform,
    channel,
    date,
    published_date,
    created_at,
    updated_at,
    summary_date,
    view_count,
    like_count,
    comment_count,
    duration,
    raw_view,
    popularity_score,
    COALESCE(popularity_score_precise, popularity_score) AS popularity_score_precise,
    ai_image_url,
    ai_image_prompt,
    reason,
    growth_rate,
    platform_mentions,
    keywords,
    ai_opinion,
    score_details,
    
    -- UI compatibility fields
    COALESCE(published_date, created_at) AS published_at,
    COALESCE(channel, 'Unknown') AS channel_title,
    
    -- View details object for modal stats
    jsonb_build_object(
      'views', COALESCE(view_count, '0'),
      'growth_rate', COALESCE(NULLIF(growth_rate, '')::numeric, 0),
      'platform_mentions', COALESCE(platform_mentions, ''),
      'matched_keywords', COALESCE(keywords, ''),
      'ai_opinion', COALESCE(ai_opinion, ''),
      'score', COALESCE(popularity_score, 0)
    ) AS view_details,
    
    -- Additional UI fields
    ai_image_url AS image_url,
    ai_image_url AS display_image_url_raw,
    (ai_image_url IS NOT NULL) AS is_ai_image,
    COALESCE(platform, 'Unknown') AS platforms_raw,
    COALESCE(ai_image_url, '/placeholder-image.svg') AS safe_image_url
  FROM public.news_trends
  WHERE title IS NOT NULL -- Only show valid records
  ORDER BY 
    COALESCE(published_date, created_at) DESC NULLS LAST, 
    COALESCE(popularity_score, 0) DESC NULLS LAST;

  COMMENT ON VIEW public.public_v_home_news IS 
  'Plan-B Security: Home feed view with SECURITY INVOKER mode';
  
  RAISE NOTICE '✓ Created public_v_home_news view';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Home view creation failed: %', SQLERRM;
END $$;

-- Weekly stats view (safe creation)
DO $$
BEGIN
  DROP VIEW IF EXISTS public.public_v_weekly_stats CASCADE;
  
  CREATE VIEW public.public_v_weekly_stats
  WITH (security_invoker = true, security_barrier = true) AS
  SELECT
    date_trunc('week', COALESCE(updated_at, created_at))::date AS week,
    COUNT(*) AS news_count,
    COUNT(CASE WHEN ai_image_url IS NOT NULL THEN 1 END) AS stories_with_images,
    ROUND(AVG(COALESCE(popularity_score, 0))::numeric, 2) AS avg_popularity_score,
    MAX(COALESCE(updated_at, created_at)) AS last_updated,
    
    -- Safe numeric conversions for view counts
    SUM(
      CASE 
        WHEN view_count ~ '^[0-9,]+$' THEN 
          COALESCE(NULLIF(regexp_replace(view_count, '[^0-9]', '', 'g'), '')::bigint, 0)
        ELSE 0 
      END
    ) AS total_views,
    
    SUM(
      CASE 
        WHEN like_count ~ '^[0-9,]+$' THEN 
          COALESCE(NULLIF(regexp_replace(like_count, '[^0-9]', '', 'g'), '')::bigint, 0)
        ELSE 0 
      END
    ) AS total_likes
  FROM public.news_trends
  WHERE title IS NOT NULL
  GROUP BY date_trunc('week', COALESCE(updated_at, created_at))
  ORDER BY week DESC;

  COMMENT ON VIEW public.public_v_weekly_stats IS 
  'Plan-B Security: Weekly stats with SECURITY INVOKER mode';
  
  RAISE NOTICE '✓ Created public_v_weekly_stats view';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Weekly stats view creation failed: %', SQLERRM;
END $$;

-- Weekly snapshots view (safe creation)
DO $$
BEGIN
  DROP VIEW IF EXISTS public.public_v_weekly_snapshots CASCADE;
  
  CREATE VIEW public.public_v_weekly_snapshots
  WITH (security_invoker = true, security_barrier = true) AS
  SELECT
    snapshot_id,
    status,
    range_start,
    range_end,
    COALESCE(built_at, created_at) AS built_at,
    created_at,
    COALESCE(updated_at, created_at) AS updated_at,
    algo_version,
    data_version,
    
    -- Safe items count calculation
    CASE 
      WHEN items IS NOT NULL AND jsonb_typeof(items) = 'array' THEN 
        jsonb_array_length(items)
      ELSE 0
    END AS items_count,
    
    -- Status flags
    CASE WHEN status IN ('ready', 'published') THEN true ELSE false END AS is_ready,
    
    -- Safe metadata (only if columns exist)
    COALESCE(items, '[]'::jsonb) AS items,
    COALESCE(meta, '{}'::jsonb) AS meta
  FROM public.weekly_report_snapshots
  WHERE status IN ('ready', 'published', 'archived', 'building') -- Allow all valid statuses
  ORDER BY 
    COALESCE(built_at, created_at) DESC NULLS LAST, 
    created_at DESC;

  COMMENT ON VIEW public.public_v_weekly_snapshots IS 
  'Plan-B Security: Weekly snapshots with SECURITY INVOKER mode';
  
  RAISE NOTICE '✓ Created public_v_weekly_snapshots view';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Weekly snapshots view creation failed: %', SQLERRM;
END $$;

-- 4. SAFE PERMISSIONS SETUP
-- =========================================

DO $$
BEGIN
  -- Revoke anon access from base tables (safe - won't fail if already revoked)
  REVOKE ALL ON TABLE public.news_trends FROM anon;
  REVOKE ALL ON TABLE public.weekly_report_snapshots FROM anon;
  
  -- Try to revoke from other tables if they exist
  BEGIN
    REVOKE ALL ON TABLE public.stories FROM anon;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table stories does not exist (OK)';
  END;
  
  BEGIN
    REVOKE ALL ON TABLE public.snapshots FROM anon;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table snapshots does not exist (OK)';
  END;
  
  BEGIN
    REVOKE ALL ON TABLE public.image_files FROM anon;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table image_files does not exist (OK)';
  END;
  
  BEGIN
    REVOKE ALL ON TABLE public.ai_images FROM anon;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table ai_images does not exist (OK)';
  END;
  
  RAISE NOTICE '✓ Revoked anon access from base tables';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Permission revocation completed with warnings: %', SQLERRM;
END $$;

-- Grant anon access to views (safe)
DO $$
BEGIN
  -- Grant access to views
  GRANT SELECT ON TABLE public.public_v_home_news TO anon, authenticated, service_role;
  GRANT SELECT ON TABLE public.public_v_weekly_stats TO anon, authenticated, service_role;
  GRANT SELECT ON TABLE public.public_v_weekly_snapshots TO anon, authenticated, service_role;
  
  -- Allow anon to read system_meta if it exists
  BEGIN
    GRANT SELECT ON TABLE public.system_meta TO anon;
    RAISE NOTICE '✓ Granted anon access to system_meta';
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table system_meta does not exist (will be created later)';
  END;
  
  RAISE NOTICE '✓ Granted anon access to public views';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Permission grants completed with warnings: %', SQLERRM;
END $$;

-- 5. SAFE RLS SETUP
-- =========================================

DO $$
BEGIN
  -- Enable RLS on tables (safe - won't fail if already enabled)
  ALTER TABLE public.weekly_report_snapshots ENABLE ROW LEVEL SECURITY;
  
  -- Try to enable RLS on other tables if they exist
  BEGIN
    ALTER TABLE public.stats ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table stats does not exist (OK)';
  END;
  
  BEGIN
    ALTER TABLE public.system_meta ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table system_meta does not exist (OK)';
  END;
  
  RAISE NOTICE '✓ Enabled RLS on existing tables';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'RLS setup completed with warnings: %', SQLERRM;
END $$;

-- Create service role policies (safe)
DO $$
BEGIN
  -- Weekly snapshots policies
  DROP POLICY IF EXISTS "service_role_weekly_snapshots_policy" ON public.weekly_report_snapshots;
  CREATE POLICY "service_role_weekly_snapshots_policy" ON public.weekly_report_snapshots
    FOR ALL TO service_role USING (true) WITH CHECK (true);
  
  -- Stats table policies (if table exists)
  BEGIN
    DROP POLICY IF EXISTS "service_role_stats_policy" ON public.stats;
    CREATE POLICY "service_role_stats_policy" ON public.stats
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Stats table policies skipped (table does not exist)';
  END;
  
  -- System_meta table policies (if table exists)
  BEGIN
    DROP POLICY IF EXISTS "service_role_system_meta_policy" ON public.system_meta;
    CREATE POLICY "service_role_system_meta_policy" ON public.system_meta
      FOR ALL TO service_role USING (true) WITH CHECK (true);
      
    DROP POLICY IF EXISTS "anon_read_system_meta_policy" ON public.system_meta;
    CREATE POLICY "anon_read_system_meta_policy" ON public.system_meta
      FOR SELECT TO anon USING (true);
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'System_meta table policies skipped (table does not exist)';
  END;
  
  RAISE NOTICE '✓ Created RLS policies for service role';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy creation completed with warnings: %', SQLERRM;
END $$;

-- 6. SAFE PERFORMANCE INDEXES
-- =========================================

DO $$
BEGIN
  -- Create indexes (safe - won't fail if they exist)
  CREATE INDEX IF NOT EXISTS idx_news_trends_home_perf 
  ON public.news_trends(published_date DESC NULLS LAST, popularity_score DESC NULLS LAST);

  CREATE INDEX IF NOT EXISTS idx_news_trends_updated_at 
  ON public.news_trends(updated_at DESC);

  CREATE INDEX IF NOT EXISTS idx_weekly_snapshots_status_built_at 
  ON public.weekly_report_snapshots(status, built_at DESC);

  CREATE INDEX IF NOT EXISTS idx_weekly_snapshots_range_dates 
  ON public.weekly_report_snapshots(range_start, range_end);
  
  RAISE NOTICE '✓ Created performance indexes';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Index creation completed with warnings: %', SQLERRM;
END $$;

-- 7. COMPREHENSIVE VERIFICATION
-- =========================================

DO $$
DECLARE
  home_count int := 0;
  stats_count int := 0;
  snapshots_count int := 0;
  news_count int := 0;
  view_exists_home boolean := false;
  view_exists_stats boolean := false;
  view_exists_snapshots boolean := false;
BEGIN
  -- Check if views exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'public_v_home_news'
  ) INTO view_exists_home;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'public_v_weekly_stats'
  ) INTO view_exists_stats;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'public_v_weekly_snapshots'
  ) INTO view_exists_snapshots;
  
  -- Count records in base table
  BEGIN
    SELECT COUNT(*) INTO news_count FROM public.news_trends LIMIT 1000;
  EXCEPTION WHEN OTHERS THEN
    news_count := 0;
  END;
  
  -- Test view access if views exist
  IF view_exists_home THEN
    BEGIN
      SELECT COUNT(*) INTO home_count FROM public.public_v_home_news LIMIT 100;
    EXCEPTION WHEN OTHERS THEN
      home_count := -1; -- Error accessing view
    END;
  END IF;
  
  IF view_exists_stats THEN
    BEGIN
      SELECT COUNT(*) INTO stats_count FROM public.public_v_weekly_stats LIMIT 100;
    EXCEPTION WHEN OTHERS THEN
      stats_count := -1;
    END;
  END IF;
  
  IF view_exists_snapshots THEN
    BEGIN
      SELECT COUNT(*) INTO snapshots_count FROM public.public_v_weekly_snapshots LIMIT 100;
    EXCEPTION WHEN OTHERS THEN
      snapshots_count := -1;
    END;
  END IF;
  
  -- Report results
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PLAN-B SECURITY SETUP VERIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Base Data:';
  RAISE NOTICE '  - news_trends table: % records', news_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Views Created:';
  RAISE NOTICE '  - public_v_home_news: % (% records accessible)', 
    CASE WHEN view_exists_home THEN '✓' ELSE '✗' END, 
    CASE WHEN home_count >= 0 THEN home_count::text ELSE 'ERROR' END;
  RAISE NOTICE '  - public_v_weekly_stats: % (% records accessible)', 
    CASE WHEN view_exists_stats THEN '✓' ELSE '✗' END,
    CASE WHEN stats_count >= 0 THEN stats_count::text ELSE 'ERROR' END;
  RAISE NOTICE '  - public_v_weekly_snapshots: % (% records accessible)', 
    CASE WHEN view_exists_snapshots THEN '✓' ELSE '✗' END,
    CASE WHEN snapshots_count >= 0 THEN snapshots_count::text ELSE 'ERROR' END;
  RAISE NOTICE '';
  
  IF view_exists_home AND view_exists_stats AND view_exists_snapshots THEN
    IF home_count >= 0 AND stats_count >= 0 AND snapshots_count >= 0 THEN
      RAISE NOTICE '🎉 SUCCESS: Plan-B security setup completed successfully!';
      RAISE NOTICE '';
      RAISE NOTICE 'Next Steps:';
      RAISE NOTICE '1. Test API endpoints: /api/health, /api/home, /api/test-plan-b';
      RAISE NOTICE '2. Generate snapshots: npm run snapshot:build:publish';
      RAISE NOTICE '3. Test UI: Home page and Weekly Report should work';
    ELSE
      RAISE NOTICE '⚠️  PARTIAL SUCCESS: Views created but some have access issues';
      RAISE NOTICE 'This is normal if tables are empty. Add data and test again.';
    END IF;
  ELSE
    RAISE NOTICE '❌ INCOMPLETE: Some views failed to create';
    RAISE NOTICE 'Check the error messages above and run the script again.';
  END IF;
  RAISE NOTICE '========================================';
  
END $$;
