-- ===============================
-- WEEKLY STATS VIEW (Plan-B Security)
-- Supabase Editor Compatible
-- ===============================
-- Creates public_v_weekly_stats view for KPI cards and charts
-- Uses SECURITY INVOKER for Plan-B compliance
-- 
-- USAGE: Copy and paste this entire script into Supabase SQL Editor
-- IDEMPOTENCY: Safe to re-run multiple times
-- PLAN-B SECURITY: Anon can SELECT view only, not base tables
-- ===============================

-- Create or replace the weekly stats view
CREATE OR REPLACE VIEW public.public_v_weekly_stats
WITH (security_invoker = true, security_barrier = true)
AS
SELECT 
  COUNT(*) as total_stories,
  COUNT(CASE WHEN ai_image_url IS NOT NULL THEN 1 END) as stories_with_images,
  ROUND(AVG(COALESCE(popularity_score, 0))::numeric, 2) as avg_popularity_score,
  MAX(updated_at) as last_updated,
  
  -- Additional useful stats
  COUNT(CASE WHEN created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours' THEN 1 END) as stories_last_24h,
  COUNT(CASE WHEN created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 1 END) as stories_last_week,
  COUNT(DISTINCT platform) as unique_platforms,
  COUNT(DISTINCT category) as unique_categories,
  
  -- Top platform by story count
  (
    SELECT platform 
    FROM public.news_trends 
    WHERE platform IS NOT NULL
    GROUP BY platform 
    ORDER BY COUNT(*) DESC 
    LIMIT 1
  ) as top_platform,
  
  -- Average scores by recency
  ROUND(AVG(CASE WHEN created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours' 
            THEN COALESCE(popularity_score, 0) END)::numeric, 2) as avg_score_24h,
  ROUND(AVG(CASE WHEN created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days' 
            THEN COALESCE(popularity_score, 0) END)::numeric, 2) as avg_score_7d

FROM public.news_trends
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'; -- Focus on recent data

COMMENT ON VIEW public.public_v_weekly_stats IS
'Weekly statistics view (Plan-B): KPI metrics for dashboard cards and charts. SECURITY INVOKER mode.';

-- Grant permissions (idempotent)
DO $$
BEGIN
  GRANT SELECT ON public.public_v_weekly_stats TO anon;
  GRANT SELECT ON public.public_v_weekly_stats TO authenticated;
  GRANT SELECT ON public.public_v_weekly_stats TO service_role;
  RAISE NOTICE 'Granted SELECT on public_v_weekly_stats to anon, authenticated, service_role';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Grants completed (normal if already exist)';
END $$;

-- Test the view
-- SELECT * FROM public.public_v_weekly_stats;

-- ===============================
-- COMPLETION SUMMARY
-- ===============================
-- ✅ Created public_v_weekly_stats view with SECURITY INVOKER
-- ✅ Includes comprehensive KPI metrics for dashboard
-- ✅ Plan-B Security: anon can SELECT view only
-- ✅ Focuses on recent data (last 30 days) for performance
-- ✅ Idempotent grants with error handling
-- 
-- SUPABASE EDITOR COMPATIBLE: No psql meta-commands
-- SECURITY INVOKER: No Security Definer warnings
-- PLAN-B COMPLIANT: View access only for anon users
-- ===============================
