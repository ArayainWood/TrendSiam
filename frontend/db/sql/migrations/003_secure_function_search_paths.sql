-- Migration 003: Secure Function Search Paths
-- Date: 2025-10-20
-- Purpose: Set explicit search_path on functions to prevent injection
-- Risk: LOW - Makes functions more secure without changing behavior
-- Idempotent: Yes - ALTER FUNCTION is idempotent

BEGIN;

-- Set statement timeout
SET LOCAL statement_timeout = '10s';

-- Fix util_has_column function
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'util_has_column'
    ) THEN
        ALTER FUNCTION public.util_has_column(text, text)
            SET search_path = pg_catalog, public;
        RAISE NOTICE 'Search path set for public.util_has_column';
    ELSE
        RAISE NOTICE 'Function public.util_has_column not found. Skipping.';
    END IF;
END $$;

-- Fix get_public_system_meta RPC
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public1'
        AND p.proname = 'get_public_system_meta'
    ) THEN
        ALTER FUNCTION public1.get_public_system_meta()
            SET search_path = pg_catalog, public;
        RAISE NOTICE 'Search path set for public1.get_public_system_meta';
    ELSE
        RAISE NOTICE 'Function public1.get_public_system_meta not found. Skipping.';
    END IF;
END $$;

-- Fix get_public_home_news RPC
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public1'
        AND p.proname = 'get_public_home_news'
    ) THEN
        ALTER FUNCTION public1.get_public_home_news()
            SET search_path = pg_catalog, public;
        RAISE NOTICE 'Search path set for public1.get_public_home_news';
    ELSE
        RAISE NOTICE 'Function public1.get_public_home_news not found. Skipping.';
    END IF;
END $$;

-- Verification
DO $$
DECLARE
    func_count INTEGER;
    secured_count INTEGER;
BEGIN
    -- Count total functions
    SELECT COUNT(*) INTO func_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE (n.nspname = 'public' AND p.proname = 'util_has_column')
    OR (n.nspname = 'public1' AND p.proname IN ('get_public_system_meta', 'get_public_home_news'));
    
    -- Count functions with search_path set
    SELECT COUNT(*) INTO secured_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE ((n.nspname = 'public' AND p.proname = 'util_has_column')
    OR (n.nspname = 'public1' AND p.proname IN ('get_public_system_meta', 'get_public_home_news')))
    AND proconfig IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM unnest(proconfig) AS config
        WHERE config LIKE 'search_path=%'
    );
    
    RAISE NOTICE 'Migration 003 verification: %/% functions have secure search_path', secured_count, func_count;
    
    IF func_count > 0 AND secured_count < func_count THEN
        RAISE WARNING 'Not all functions have secure search_path set';
    END IF;
END $$;

COMMIT;
