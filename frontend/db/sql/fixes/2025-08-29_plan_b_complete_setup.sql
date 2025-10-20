-- =========================================
-- PLAN-B SECURITY MODEL - COMPLETE SETUP
-- Supabase Editor Compatible (no psql meta-commands)
-- =========================================
-- This script creates all necessary views, permissions, and security fixes
-- for Plan-B Security Model compliance in one go
-- 
-- USAGE: Copy and paste this entire script into Supabase SQL Editor
-- IDEMPOTENCY: Safe to re-run multiple times
-- PLAN-B SECURITY: Anon reads views only, service_role accesses base tables

-- =========================================
-- 1.1 HOME VIEW (UI-safe projection of news_trends)
-- =========================================

CREATE OR REPLACE VIEW public.public_v_home_news
WITH (security_invoker = true, security_barrier = true) AS
SELECT
  id,
  external_id,
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
  popularity_score AS popularity_score_precise,
  ai_image_url,
  ai_image_prompt,
  reason,
  growth_rate,
  platform_mentions,
  keywords,
  ai_opinion,
  score_details,
  
  -- Additional fields for UI compatibility
  ai_image_url AS image_url,
  ai_image_url AS display_image_url_raw,
  (ai_image_url IS NOT NULL) AS is_ai_image,
  platform AS platforms_raw,
  
  -- Safe fallback for missing fields
  COALESCE(ai_image_url, '/placeholder-image.svg') AS safe_image_url
FROM public.news_trends;

COMMENT ON VIEW public.public_v_home_news IS
'Home feed view (Plan-B): Safe projection of news_trends with SECURITY INVOKER mode';

-- =========================================
-- 1.2 WEEKLY STATS VIEW (KPI source)
-- =========================================

CREATE OR REPLACE VIEW public.public_v_weekly_stats
WITH (security_invoker = true, security_barrier = true) AS
SELECT
  snapshot_id,
  status,
  range_start,
  range_end,
  built_at,
  algo_version,
  data_version,
  items,      -- jsonb
  meta,       -- jsonb
  created_at,
  
  -- Computed stats for KPI cards
  CASE 
    WHEN jsonb_typeof(items) = 'array' THEN jsonb_array_length(items)
    ELSE 0
  END AS total_stories,
  
  -- Extract stats from meta if available
  COALESCE((meta->>'stories_with_images')::int, 0) AS stories_with_images,
  COALESCE((meta->>'avg_popularity_score')::numeric, 0) AS avg_popularity_score,
  COALESCE(updated_at, created_at) AS last_updated
FROM public.weekly_report_snapshots
WHERE status IN ('ready', 'published')
ORDER BY built_at DESC;

COMMENT ON VIEW public.public_v_weekly_stats IS
'Weekly stats view (Plan-B): KPI metrics from snapshots with SECURITY INVOKER mode';

-- =========================================
-- 1.3 WEEKLY SNAPSHOTS LIST VIEW
-- =========================================

CREATE OR REPLACE VIEW public.public_v_weekly_snapshots
WITH (security_invoker = true, security_barrier = true) AS
SELECT
  snapshot_id,
  status,
  range_start,
  range_end,
  built_at,
  created_at,
  created_at AS updated_at,  -- UI compatibility mapping
  algo_version,
  data_version,
  
  -- Safe items count calculation
  CASE 
    WHEN jsonb_typeof(items) = 'array' THEN jsonb_array_length(items)
    ELSE 0
  END AS items_count,
  
  -- Status indicators
  CASE WHEN status = 'ready' THEN true ELSE false END AS is_ready
FROM public.weekly_report_snapshots
ORDER BY built_at DESC NULLS LAST, created_at DESC;

COMMENT ON VIEW public.public_v_weekly_snapshots IS
'Weekly snapshots view (Plan-B): Safe snapshot metadata with SECURITY INVOKER mode';

-- =========================================
-- 1.4 PLAN-B PERMISSIONS (anon blocked from base tables)
-- =========================================

-- Revoke anon access from base tables
REVOKE ALL ON TABLE public.news_trends FROM anon;
REVOKE ALL ON TABLE public.stories FROM anon;
REVOKE ALL ON TABLE public.snapshots FROM anon;
REVOKE ALL ON TABLE public.weekly_report_snapshots FROM anon;
REVOKE ALL ON TABLE public.image_files FROM anon;
REVOKE ALL ON TABLE public.ai_images FROM anon;

-- Grant anon access to views only
GRANT SELECT ON TABLE public.public_v_home_news TO anon;
GRANT SELECT ON TABLE public.public_v_weekly_stats TO anon;
GRANT SELECT ON TABLE public.public_v_weekly_snapshots TO anon;

-- Grant to authenticated and service_role as well
GRANT SELECT ON TABLE public.public_v_home_news TO authenticated, service_role;
GRANT SELECT ON TABLE public.public_v_weekly_stats TO authenticated, service_role;
GRANT SELECT ON TABLE public.public_v_weekly_snapshots TO authenticated, service_role;

-- =========================================
-- 1.5 RLS FOR PLAN-B ON STATS & SYSTEM_META
-- =========================================

ALTER TABLE IF EXISTS public.stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_meta ENABLE ROW LEVEL SECURITY;

-- Create minimal service_role policies
DO $$
BEGIN
  -- Stats table policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='stats' AND policyname='sr can read stats'
  ) THEN
    CREATE POLICY "sr can read stats" ON public.stats
      FOR SELECT TO service_role USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='stats' AND policyname='sr can insert stats'
  ) THEN
    CREATE POLICY "sr can insert stats" ON public.stats
      FOR INSERT TO service_role WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='stats' AND policyname='sr can update stats'
  ) THEN
    CREATE POLICY "sr can update stats" ON public.stats
      FOR UPDATE TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- System_meta table policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='system_meta' AND policyname='sr can read system_meta'
  ) THEN
    CREATE POLICY "sr can read system_meta" ON public.system_meta
      FOR SELECT TO service_role USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='system_meta' AND policyname='sr can insert system_meta'
  ) THEN
    CREATE POLICY "sr can insert system_meta" ON public.system_meta
      FOR INSERT TO service_role WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='system_meta' AND policyname='sr can update system_meta'
  ) THEN
    CREATE POLICY "sr can update system_meta" ON public.system_meta
      FOR UPDATE TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Allow anon to read system_meta for cache invalidation
GRANT SELECT ON TABLE public.system_meta TO anon;

-- =========================================
-- 1.6 HARDEN FUNCTIONS (fix Function Search Path Mutable)
-- =========================================

DO $$
DECLARE 
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS sch, p.proname AS fn, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('update_updated_at_column', 'update_news_last_updated')
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = pg_catalog', r.sch, r.fn, r.args);
    RAISE NOTICE 'Fixed search_path for function %.%(%)', r.sch, r.fn, r.args;
  END LOOP;
END $$;

-- =========================================
-- 1.7 MOVE PG_TRGM OUT OF PUBLIC (if present)
-- =========================================

CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace ns ON ns.oid = e.extnamespace
    WHERE e.extname = 'pg_trgm' AND ns.nspname = 'public'
  ) THEN
    EXECUTE 'ALTER EXTENSION pg_trgm SET SCHEMA extensions';
    RAISE NOTICE 'Moved pg_trgm extension from public to extensions schema';
  ELSE
    RAISE NOTICE 'pg_trgm extension not in public schema or does not exist';
  END IF;
END $$;

-- =========================================
-- 1.8 CREATE PERFORMANCE INDEXES (if not exist)
-- =========================================

-- Home view performance indexes
CREATE INDEX IF NOT EXISTS idx_news_trends_home_ordering 
ON public.news_trends(popularity_score DESC, published_date DESC NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_trends_updated_at 
ON public.news_trends(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_trends_category 
ON public.news_trends(category) WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_news_trends_platform 
ON public.news_trends(platform) WHERE platform IS NOT NULL;

-- Weekly snapshots performance indexes
CREATE INDEX IF NOT EXISTS idx_weekly_snapshots_status_built 
ON public.weekly_report_snapshots(status, built_at DESC) WHERE status IN ('ready', 'published');

-- =========================================
-- VALIDATION QUERIES
-- =========================================

-- Verify views exist and have data
DO $$
DECLARE
  home_count INTEGER;
  stats_count INTEGER;
  snapshots_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO home_count FROM public.public_v_home_news;
  SELECT COUNT(*) INTO stats_count FROM public.public_v_weekly_stats;
  SELECT COUNT(*) INTO snapshots_count FROM public.public_v_weekly_snapshots;
  
  RAISE NOTICE 'Validation Results:';
  RAISE NOTICE '  - Home view rows: %', home_count;
  RAISE NOTICE '  - Weekly stats rows: %', stats_count;
  RAISE NOTICE '  - Weekly snapshots rows: %', snapshots_count;
  
  IF home_count = 0 THEN
    RAISE WARNING 'No data in public_v_home_news - check if news_trends table has data';
  END IF;
  
  IF snapshots_count = 0 THEN
    RAISE WARNING 'No data in public_v_weekly_snapshots - run ETL pipeline to create snapshots';
  END IF;
END $$;

-- Verify view security settings
SELECT 
  schemaname, 
  viewname,
  CASE WHEN 'security_invoker=true' = ANY(reloptions) THEN 'INVOKER' ELSE 'DEFINER' END AS security_type,
  CASE WHEN 'security_barrier=true' = ANY(reloptions) THEN 'YES' ELSE 'NO' END AS has_barrier
FROM pg_views v
LEFT JOIN pg_class c ON c.relname = v.viewname AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = v.schemaname)
WHERE schemaname = 'public' 
AND viewname LIKE 'public_v_%'
ORDER BY viewname;

-- Verify extension location
SELECT e.extname, ns.nspname AS schema
FROM pg_extension e 
JOIN pg_namespace ns ON ns.oid = e.extnamespace
WHERE e.extname = 'pg_trgm';

-- =========================================
-- COMPLETION SUMMARY
-- =========================================
-- ✅ Created all public_v_* views with SECURITY INVOKER + barrier
-- ✅ Revoked anon access from base tables
-- ✅ Granted anon access to views only (Plan-B Security)
-- ✅ Created RLS policies for stats and system_meta tables
-- ✅ Fixed function search_path issues
-- ✅ Moved pg_trgm extension to extensions schema
-- ✅ Added performance indexes for views
-- ✅ Included validation queries and security verification
-- 
-- SUPABASE EDITOR COMPATIBLE: No psql meta-commands
-- PLAN-B COMPLIANT: Anon uses views only, service_role accesses base tables
-- SECURITY INVOKER: All views use caller permissions with RLS
-- READY FOR PRODUCTION: Complete security model implementation
-- =========================================
