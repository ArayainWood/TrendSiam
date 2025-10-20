-- Phase 1: Discovery - Current RLS Policies
-- Date: 2025-10-20
-- Purpose: Capture current policies before remediation

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
