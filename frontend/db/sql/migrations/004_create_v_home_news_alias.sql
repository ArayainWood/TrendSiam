-- Migration 004: Create v_home_news Alias View
-- Date: 2025-10-21
-- Purpose: Create v_home_news as alias to public_v_home_news for backward compatibility
-- Risk: LOW - Creates new view, no data changes
-- Idempotent: Yes - uses CREATE OR REPLACE

-- CONTEXT:
-- The codebase inconsistently uses two view names:
--   1. v_home_news (simple name) - used in useSupabaseNews.ts, SupabaseNewsGrid.tsx
--   2. public_v_home_news (prefixed name) - used in API routes
-- This migration creates v_home_news as an alias so both names work.
-- Long-term: migrate all code to use public_v_home_news consistently.

BEGIN;

-- Set statement timeout to prevent long-running queries
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '5s';

-- =====================================================
-- CREATE v_home_news AS ALIAS TO public_v_home_news
-- =====================================================

CREATE OR REPLACE VIEW public.v_home_news AS
SELECT * FROM public.public_v_home_news;

-- Set ownership
ALTER VIEW public.v_home_news OWNER TO postgres;

-- Grant permissions (Plan-B: anon can read views)
REVOKE ALL ON public.v_home_news FROM PUBLIC;
GRANT SELECT ON public.v_home_news TO anon, authenticated, service_role;

-- Document the alias
COMMENT ON VIEW public.v_home_news IS
'Alias to public_v_home_news for backward compatibility.
Created: 2025-10-21 to fix runtime error from inconsistent view naming.
Apps should migrate to public_v_home_news for clarity and consistency.
This view has the same 26-column contract as public_v_home_news.';

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
    alias_exists BOOLEAN;
    primary_exists BOOLEAN;
    alias_cols INTEGER;
    primary_cols INTEGER;
    anon_can_read BOOLEAN;
BEGIN
    -- Check both views exist
    SELECT EXISTS (
        SELECT 1 FROM pg_views 
        WHERE schemaname = 'public' AND viewname = 'v_home_news'
    ) INTO alias_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM pg_views 
        WHERE schemaname = 'public' AND viewname = 'public_v_home_news'
    ) INTO primary_exists;
    
    IF NOT alias_exists THEN
        RAISE EXCEPTION 'Alias view v_home_news was not created!';
    END IF;
    
    IF NOT primary_exists THEN
        RAISE WARNING 'Primary view public_v_home_news does not exist! Alias will fail at runtime.';
    END IF;
    
    -- Check column count matches (if primary exists)
    IF primary_exists THEN
        SELECT COUNT(*) INTO alias_cols
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'v_home_news';
        
        SELECT COUNT(*) INTO primary_cols
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'public_v_home_news';
        
        IF alias_cols != primary_cols THEN
            RAISE EXCEPTION 'Column count mismatch! v_home_news=%, public_v_home_news=%', 
                alias_cols, primary_cols;
        END IF;
        
        RAISE NOTICE 'Column count verified: % columns', alias_cols;
    END IF;
    
    -- Check anon can read (Plan-B compliance)
    SELECT has_table_privilege('anon', 'public.v_home_news', 'SELECT') INTO anon_can_read;
    
    IF NOT anon_can_read THEN
        RAISE EXCEPTION 'Anon role cannot read v_home_news! Plan-B violation.';
    END IF;
    
    RAISE NOTICE 'Migration 004 verification passed. v_home_news alias created successfully.';
END $$;

COMMIT;

