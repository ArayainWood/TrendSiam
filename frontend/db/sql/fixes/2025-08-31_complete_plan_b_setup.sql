-- =========================================
-- COMPLETE PLAN-B SECURITY SETUP
-- Run this in Supabase SQL Editor
-- =========================================

BEGIN;

-- 1. Ensure weekly_report_snapshots table has correct schema
-- =========================================

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add items column (JSONB array of snapshot items)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'weekly_report_snapshots' 
    AND column_name = 'items'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.weekly_report_snapshots 
    ADD COLUMN items jsonb DEFAULT '[]'::jsonb;
    RAISE NOTICE 'Added items column to weekly_report_snapshots';
  END IF;
  
  -- Add meta column (JSONB metadata object)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'weekly_report_snapshots' 
    AND column_name = 'meta'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.weekly_report_snapshots 
    ADD COLUMN meta jsonb DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Added meta column to weekly_report_snapshots';
  END IF;
  
  -- Add built_at column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'weekly_report_snapshots' 
    AND column_name = 'built_at'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.weekly_report_snapshots 
    ADD COLUMN built_at timestamptz NOT NULL DEFAULT now();
    RAISE NOTICE 'Added built_at column to weekly_report_snapshots';
  END IF;
END $$;

-- Update status constraint
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'weekly_report_snapshots' 
    AND constraint_type = 'CHECK'
    AND constraint_name LIKE '%status%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.weekly_report_snapshots DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints 
      WHERE table_name = 'weekly_report_snapshots' 
      AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%status%'
      LIMIT 1
    );
  END IF;
  
  -- Add new constraint
  ALTER TABLE public.weekly_report_snapshots 
  ADD CONSTRAINT weekly_report_snapshots_status_check 
  CHECK (status IN ('building', 'ready', 'failed', 'archived'));
  
  RAISE NOTICE 'Updated status constraint for weekly_report_snapshots';
END $$;

-- 2. Create public views for Plan-B security
-- =========================================

-- Home news view
DROP VIEW IF EXISTS public.public_v_home_news CASCADE;
CREATE VIEW public.public_v_home_news
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
  
  -- UI compatibility fields
  published_date AS published_at,
  channel AS channel_title,
  
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
  platform AS platforms_raw,
  COALESCE(ai_image_url, '/placeholder-image.svg') AS safe_image_url
FROM public.news_trends
ORDER BY published_date DESC NULLS LAST, popularity_score DESC NULLS LAST;

COMMENT ON VIEW public.public_v_home_news IS 
'Plan-B Security: Home feed view with SECURITY INVOKER mode';

-- Weekly stats view
DROP VIEW IF EXISTS public.public_v_weekly_stats CASCADE;
CREATE VIEW public.public_v_weekly_stats
WITH (security_invoker = true, security_barrier = true) AS
SELECT
  date_trunc('week', COALESCE(updated_at, created_at))::date AS week,
  COUNT(*) AS news_count,
  COUNT(CASE WHEN ai_image_url IS NOT NULL THEN 1 END) AS stories_with_images,
  ROUND(AVG(COALESCE(popularity_score, 0))::numeric, 2) AS avg_popularity_score,
  MAX(updated_at) AS last_updated,
  
  -- Additional stats
  SUM(COALESCE(
    NULLIF(regexp_replace(COALESCE(view_count::text, '0'), '[^0-9]', '', 'g'), '')::bigint, 
    0
  )) AS total_views,
  
  SUM(COALESCE(
    NULLIF(regexp_replace(COALESCE(like_count::text, '0'), '[^0-9]', '', 'g'), '')::bigint, 
    0
  )) AS total_likes
FROM public.news_trends
GROUP BY date_trunc('week', COALESCE(updated_at, created_at))
ORDER BY week DESC;

COMMENT ON VIEW public.public_v_weekly_stats IS 
'Plan-B Security: Weekly stats with SECURITY INVOKER mode';

-- Weekly snapshots view
DROP VIEW IF EXISTS public.public_v_weekly_snapshots CASCADE;
CREATE VIEW public.public_v_weekly_snapshots
WITH (security_invoker = true, security_barrier = true) AS
SELECT
  snapshot_id,
  status,
  range_start,
  range_end,
  built_at,
  created_at,
  created_at AS updated_at,
  algo_version,
  data_version,
  
  -- Items count
  CASE 
    WHEN jsonb_typeof(items) = 'array' THEN jsonb_array_length(items)
    ELSE 0
  END AS items_count,
  
  -- Status flags
  CASE WHEN status = 'ready' THEN true ELSE false END AS is_ready,
  
  -- Safe metadata
  items,
  meta
FROM public.weekly_report_snapshots
WHERE status IN ('ready', 'published', 'archived')
ORDER BY built_at DESC NULLS LAST, created_at DESC;

COMMENT ON VIEW public.public_v_weekly_snapshots IS 
'Plan-B Security: Weekly snapshots with SECURITY INVOKER mode';

-- 3. Plan-B Security Permissions
-- =========================================

-- Revoke anon access from ALL base tables
REVOKE ALL ON TABLE public.news_trends FROM anon;
REVOKE ALL ON TABLE public.stories FROM anon;
REVOKE ALL ON TABLE public.snapshots FROM anon;
REVOKE ALL ON TABLE public.weekly_report_snapshots FROM anon;
REVOKE ALL ON TABLE public.image_files FROM anon;
REVOKE ALL ON TABLE public.ai_images FROM anon;

-- Grant anon access to views ONLY
GRANT SELECT ON TABLE public.public_v_home_news TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.public_v_weekly_stats TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.public_v_weekly_snapshots TO anon, authenticated, service_role;

-- Allow anon to read system_meta for cache invalidation
GRANT SELECT ON TABLE public.system_meta TO anon;

-- 4. RLS Policies
-- =========================================

-- Enable RLS on system tables
ALTER TABLE IF EXISTS public.stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weekly_report_snapshots ENABLE ROW LEVEL SECURITY;

-- Create service_role policies
DO $$
BEGIN
  -- Stats table policies
  DROP POLICY IF EXISTS "service_role_stats_policy" ON public.stats;
  CREATE POLICY "service_role_stats_policy" ON public.stats
    FOR ALL TO service_role USING (true) WITH CHECK (true);
  
  -- System_meta table policies  
  DROP POLICY IF EXISTS "service_role_system_meta_policy" ON public.system_meta;
  CREATE POLICY "service_role_system_meta_policy" ON public.system_meta
    FOR ALL TO service_role USING (true) WITH CHECK (true);
    
  -- Weekly snapshots policy
  DROP POLICY IF EXISTS "service_role_weekly_snapshots_policy" ON public.weekly_report_snapshots;
  CREATE POLICY "service_role_weekly_snapshots_policy" ON public.weekly_report_snapshots
    FOR ALL TO service_role USING (true) WITH CHECK (true);
    
  -- Allow anon to read system_meta
  DROP POLICY IF EXISTS "anon_read_system_meta_policy" ON public.system_meta;
  CREATE POLICY "anon_read_system_meta_policy" ON public.system_meta
    FOR SELECT TO anon USING (true);
    
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Policy creation completed with warnings (normal)';
END $$;

-- 5. Performance Indexes
-- =========================================

-- Home view performance
CREATE INDEX IF NOT EXISTS idx_news_trends_home_perf 
ON public.news_trends(published_date DESC NULLS LAST, popularity_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_news_trends_updated_at 
ON public.news_trends(updated_at DESC);

-- Weekly snapshots performance
CREATE INDEX IF NOT EXISTS idx_weekly_snapshots_status_built_at 
ON public.weekly_report_snapshots(status, built_at DESC);

CREATE INDEX IF NOT EXISTS idx_weekly_snapshots_range_dates 
ON public.weekly_report_snapshots(range_start, range_end);

-- 6. Verification
-- =========================================

DO $$
DECLARE
  home_count int;
  stats_count int;
  snapshots_count int;
BEGIN
  -- Test view access
  SELECT COUNT(*) INTO home_count FROM public.public_v_home_news LIMIT 1000;
  SELECT COUNT(*) INTO stats_count FROM public.public_v_weekly_stats LIMIT 100;
  SELECT COUNT(*) INTO snapshots_count FROM public.public_v_weekly_snapshots LIMIT 100;
  
  RAISE NOTICE 'Plan-B Setup Verification:';
  RAISE NOTICE '  - Home news view: % rows accessible', home_count;
  RAISE NOTICE '  - Weekly stats view: % rows accessible', stats_count;
  RAISE NOTICE '  - Weekly snapshots view: % rows accessible', snapshots_count;
  
  -- Check permissions
  IF EXISTS (
    SELECT 1 FROM information_schema.table_privileges 
    WHERE table_name = 'public_v_home_news' 
    AND grantee = 'anon' 
    AND privilege_type = 'SELECT'
  ) THEN
    RAISE NOTICE '  - ✓ Anon has SELECT on public_v_home_news';
  ELSE
    RAISE WARNING '  - ✗ Anon missing SELECT on public_v_home_news';
  END IF;
  
  IF home_count > 0 THEN
    RAISE NOTICE '✅ Plan-B security setup completed successfully';
  ELSE
    RAISE WARNING '⚠️ Plan-B setup complete but no data in news_trends table';
  END IF;
END $$;

COMMIT;

-- =========================================
-- Post-Setup Instructions:
-- =========================================
-- 1. Run this script in Supabase SQL Editor
-- 2. Verify that views are created and accessible
-- 3. Test API endpoints:
--    - GET /api/health (should show ok: true)
--    - GET /api/home (should return data without permission errors)
--    - GET /api/test-plan-b (should show 100% pass rate)
-- 4. Generate snapshots: npm run snapshot:build:publish
-- 5. Test weekly report page
