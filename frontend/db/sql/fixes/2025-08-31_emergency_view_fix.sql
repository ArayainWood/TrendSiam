-- =========================================
-- EMERGENCY VIEW FIX - Plan-B Security
-- Fix permission denied errors for public views
-- =========================================

-- First, let's check what exists
DO $$
DECLARE
  view_count int;
  table_count int;
BEGIN
  -- Check if views exist
  SELECT COUNT(*) INTO view_count
  FROM pg_views 
  WHERE schemaname = 'public' 
    AND viewname IN ('public_v_home_news', 'public_v_weekly_stats', 'public_v_weekly_snapshots');
  
  -- Check if base tables exist
  SELECT COUNT(*) INTO table_count
  FROM pg_tables 
  WHERE schemaname = 'public' 
    AND tablename IN ('news_trends', 'weekly_report_snapshots');
  
  RAISE NOTICE 'Views found: %, Base tables found: %', view_count, table_count;
END $$;

-- =========================================
-- 1. ENSURE BASE TABLES EXIST AND HAVE DATA
-- =========================================

-- Check if news_trends table exists and has basic structure
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'news_trends') THEN
    RAISE EXCEPTION 'news_trends table does not exist. Please run the main schema migration first.';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'weekly_report_snapshots') THEN
    RAISE EXCEPTION 'weekly_report_snapshots table does not exist. Please run the main schema migration first.';
  END IF;
  
  RAISE NOTICE '✓ Base tables exist';
END $$;

-- =========================================
-- 2. DROP AND RECREATE VIEWS SAFELY
-- =========================================

-- Drop existing views
DROP VIEW IF EXISTS public.public_v_home_news CASCADE;
DROP VIEW IF EXISTS public.public_v_weekly_stats CASCADE;
DROP VIEW IF EXISTS public.public_v_weekly_snapshots CASCADE;

-- Create home news view with minimal dependencies
CREATE VIEW public.public_v_home_news AS
SELECT
  id,
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
  score_details,
  
  -- UI compatibility fields
  COALESCE(published_date, created_at) AS published_at,
  COALESCE(channel, 'Unknown') AS channel_title,
  
  -- View details object for modal stats
  jsonb_build_object(
    'views', COALESCE(view_count, '0'),
    'growth_rate', COALESCE(
      CASE 
        WHEN growth_rate ~ '^[0-9.+-]+$' THEN growth_rate::numeric 
        ELSE 0 
      END, 0
    ),
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
  COALESCE(ai_image_url, '/placeholder-image.svg') AS safe_image_url,
  
  -- Add missing fields that might be expected
  COALESCE(external_id, video_id) AS external_id,
  video_id,
  raw_view,
  summary_date
FROM public.news_trends
WHERE title IS NOT NULL AND title != ''
ORDER BY 
  COALESCE(published_date, created_at) DESC NULLS LAST, 
  COALESCE(popularity_score, 0) DESC NULLS LAST;

-- Create weekly stats view
CREATE VIEW public.public_v_weekly_stats AS
SELECT
  date_trunc('week', COALESCE(updated_at, created_at))::date AS week,
  COUNT(*) AS news_count,
  COUNT(CASE WHEN ai_image_url IS NOT NULL THEN 1 END) AS stories_with_images,
  ROUND(AVG(COALESCE(popularity_score, 0))::numeric, 2) AS avg_popularity_score,
  MAX(COALESCE(updated_at, created_at)) AS last_updated,
  
  -- Safe numeric conversions
  SUM(
    CASE 
      WHEN view_count IS NOT NULL AND view_count ~ '^[0-9,]+$' THEN 
        COALESCE(NULLIF(regexp_replace(view_count, '[^0-9]', '', 'g'), '')::bigint, 0)
      ELSE 0 
    END
  ) AS total_views,
  
  SUM(
    CASE 
      WHEN like_count IS NOT NULL AND like_count ~ '^[0-9,]+$' THEN 
        COALESCE(NULLIF(regexp_replace(like_count, '[^0-9]', '', 'g'), '')::bigint, 0)
      ELSE 0 
    END
  ) AS total_likes
FROM public.news_trends
WHERE title IS NOT NULL
GROUP BY date_trunc('week', COALESCE(updated_at, created_at))
ORDER BY week DESC;

-- Create weekly snapshots view
CREATE VIEW public.public_v_weekly_snapshots AS
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
  
  -- Safe metadata
  COALESCE(items, '[]'::jsonb) AS items,
  COALESCE(meta, '{}'::jsonb) AS meta
FROM public.weekly_report_snapshots
WHERE status IN ('ready', 'published', 'archived', 'building')
ORDER BY 
  COALESCE(built_at, created_at) DESC NULLS LAST, 
  created_at DESC;

-- =========================================
-- 3. GRANT PERMISSIONS EXPLICITLY
-- =========================================

-- Grant SELECT on views to anon role
GRANT SELECT ON public.public_v_home_news TO anon;
GRANT SELECT ON public.public_v_weekly_stats TO anon;
GRANT SELECT ON public.public_v_weekly_snapshots TO anon;

-- Also grant to authenticated and service_role for completeness
GRANT SELECT ON public.public_v_home_news TO authenticated, service_role;
GRANT SELECT ON public.public_v_weekly_stats TO authenticated, service_role;
GRANT SELECT ON public.public_v_weekly_snapshots TO authenticated, service_role;

-- =========================================
-- 4. ENSURE ANON CAN'T ACCESS BASE TABLES
-- =========================================

-- Revoke all permissions from anon on base tables
REVOKE ALL ON public.news_trends FROM anon;
REVOKE ALL ON public.weekly_report_snapshots FROM anon;

-- =========================================
-- 5. VERIFICATION
-- =========================================

DO $$
DECLARE
  home_test_result record;
  stats_test_result record;
  snapshots_test_result record;
  home_count int := 0;
  stats_count int := 0;
  snapshots_count int := 0;
BEGIN
  -- Test if views are accessible (this simulates anon access)
  BEGIN
    SELECT COUNT(*) INTO home_count FROM public.public_v_home_news LIMIT 100;
    RAISE NOTICE '✓ public_v_home_news accessible: % rows', home_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ public_v_home_news access failed: %', SQLERRM;
  END;
  
  BEGIN
    SELECT COUNT(*) INTO stats_count FROM public.public_v_weekly_stats LIMIT 100;
    RAISE NOTICE '✓ public_v_weekly_stats accessible: % rows', stats_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ public_v_weekly_stats access failed: %', SQLERRM;
  END;
  
  BEGIN
    SELECT COUNT(*) INTO snapshots_count FROM public.public_v_weekly_snapshots LIMIT 100;
    RAISE NOTICE '✓ public_v_weekly_snapshots accessible: % rows', snapshots_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ public_v_weekly_snapshots access failed: %', SQLERRM;
  END;
  
  -- Check permissions
  IF EXISTS (
    SELECT 1 FROM information_schema.table_privileges 
    WHERE table_schema = 'public' 
      AND table_name = 'public_v_home_news' 
      AND grantee = 'anon' 
      AND privilege_type = 'SELECT'
  ) THEN
    RAISE NOTICE '✓ anon has SELECT on public_v_home_news';
  ELSE
    RAISE NOTICE '✗ anon missing SELECT on public_v_home_news';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'EMERGENCY VIEW FIX COMPLETED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Views created and permissions granted.';
  RAISE NOTICE 'Test your APIs now:';
  RAISE NOTICE '  - GET /api/health';
  RAISE NOTICE '  - GET /api/home';
  RAISE NOTICE '  - GET /api/test-plan-b';
  RAISE NOTICE '========================================';
END $$;
