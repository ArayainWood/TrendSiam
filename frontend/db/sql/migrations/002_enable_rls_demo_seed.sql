-- Migration 002: Enable RLS on Demo Seed Table
-- Date: 2025-10-20
-- Purpose: Enable RLS on public.home_demo_seed table
-- Risk: LOW - Demo/seed table
-- Idempotent: Yes - checks current state

BEGIN;

-- Set statement timeout
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '5s';

-- Check if table exists and if it contains data
DO $$
DECLARE
    table_exists BOOLEAN;
    row_count INTEGER;
BEGIN
    -- Check if table exists
    SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'home_demo_seed'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        RAISE NOTICE 'Table public.home_demo_seed does not exist. Skipping.';
        RETURN;
    END IF;
    
    -- Check row count
    EXECUTE 'SELECT COUNT(*) FROM public.home_demo_seed' INTO row_count;
    RAISE NOTICE 'Table public.home_demo_seed has % rows', row_count;
    
    -- Enable RLS if not already enabled
    IF NOT (SELECT rowsecurity FROM pg_tables 
            WHERE schemaname = 'public' AND tablename = 'home_demo_seed') THEN
        ALTER TABLE public.home_demo_seed ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS enabled on public.home_demo_seed';
    ELSE
        RAISE NOTICE 'RLS already enabled on public.home_demo_seed';
    END IF;
    
    -- Create policy if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'home_demo_seed'
        AND policyname = 'Allow public read access to demo seed'
    ) THEN
        CREATE POLICY "Allow public read access to demo seed"
            ON public.home_demo_seed
            FOR SELECT
            TO anon, authenticated
            USING (true);
        RAISE NOTICE 'Policy created for public.home_demo_seed';
    ELSE
        RAISE NOTICE 'Policy already exists for public.home_demo_seed';
    END IF;
END $$;

-- Verification
DO $$
DECLARE
    rls_enabled BOOLEAN;
    policy_count INTEGER;
BEGIN
    -- Check RLS enabled
    SELECT COALESCE(rowsecurity, FALSE) INTO rls_enabled
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'home_demo_seed';
    
    IF NOT rls_enabled THEN
        RAISE EXCEPTION 'RLS not enabled on public.home_demo_seed';
    END IF;
    
    -- Check policy exists
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'home_demo_seed';
    
    IF policy_count = 0 THEN
        RAISE WARNING 'No policies found for public.home_demo_seed (table may not exist)';
    END IF;
    
    RAISE NOTICE 'Migration 002 verification passed. RLS enabled with % policies.', policy_count;
END $$;

COMMIT;
