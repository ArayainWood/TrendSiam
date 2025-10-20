-- ===============================
-- VIEW SECURITY FIX (Plan-B)
-- Supabase Editor Compatible
-- ===============================
-- This script fixes Security Definer warnings by switching to SECURITY INVOKER
-- All views use security_invoker=true and security_barrier=true
-- 
-- USAGE: Copy and paste this entire script into Supabase SQL Editor
-- IDEMPOTENCY: Safe to re-run, checks for existence before altering
-- PLAN-B SECURITY: Eliminates Security Definer warnings
-- ===============================

-- Flip weekly stats to invoker + barrier
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='public_v_weekly_stats') THEN
    EXECUTE 'ALTER VIEW public.public_v_weekly_stats SET (security_invoker = true)';
    EXECUTE 'ALTER VIEW public.public_v_weekly_stats SET (security_barrier = true)';
    RAISE NOTICE 'Updated public_v_weekly_stats to SECURITY INVOKER + barrier';
  ELSE
    RAISE NOTICE 'View public_v_weekly_stats does not exist (normal if not created yet)';
  END IF;
END $$;

-- Ensure home view is invoker as well (safe re-run)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='public_v_home_news') THEN
    EXECUTE 'ALTER VIEW public.public_v_home_news SET (security_invoker = true)';
    EXECUTE 'ALTER VIEW public.public_v_home_news SET (security_barrier = true)';
    RAISE NOTICE 'Updated public_v_home_news to SECURITY INVOKER + barrier';
  ELSE
    RAISE NOTICE 'View public_v_home_news does not exist (run view creation script first)';
  END IF;
END $$;

-- Verify view security settings
DO $$
DECLARE
    view_rec RECORD;
BEGIN
    FOR view_rec IN 
        SELECT schemaname, viewname, 
               CASE WHEN 'security_invoker=true' = ANY(reloptions) THEN 'INVOKER' ELSE 'DEFINER' END as security_type,
               CASE WHEN 'security_barrier=true' = ANY(reloptions) THEN 'YES' ELSE 'NO' END as has_barrier
        FROM pg_views v
        LEFT JOIN pg_class c ON c.relname = v.viewname AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = v.schemaname)
        WHERE schemaname = 'public' 
        AND viewname IN ('public_v_home_news', 'public_v_weekly_stats')
    LOOP
        RAISE NOTICE 'View %.%: Security=%, Barrier=%', view_rec.schemaname, view_rec.viewname, view_rec.security_type, view_rec.has_barrier;
    END LOOP;
END $$;

-- ===============================
-- COMPLETION SUMMARY
-- ===============================
-- ✅ Fixed Security Definer warnings on public views
-- ✅ All views now use SECURITY INVOKER + security_barrier
-- ✅ Idempotent operations with existence checks
-- ✅ Verification output shows security settings
-- 
-- SUPABASE EDITOR COMPATIBLE: No psql meta-commands
-- SECURITY INVOKER: Eliminates Security Advisor warnings
-- PLAN-B COMPLIANT: Views inherit caller permissions with RLS
-- ===============================
