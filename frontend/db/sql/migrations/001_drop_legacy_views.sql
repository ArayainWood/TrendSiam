-- Migration 001: Drop Legacy Views
-- Date: 2025-10-20
-- Purpose: Remove old backup views from Sept 27
-- Risk: LOW - These are backup views no longer needed
-- Idempotent: Yes - uses IF EXISTS

BEGIN;

-- Set statement timeout to prevent long-running queries
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '5s';

-- Drop legacy views (CASCADE to handle dependencies)
DROP VIEW IF EXISTS public.public_v_home_news_old_20250927 CASCADE;
DROP VIEW IF EXISTS public.public_v_ai_images_latest_old_20250927 CASCADE;

-- Verification
DO $$
DECLARE
    legacy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO legacy_count
    FROM pg_views
    WHERE schemaname = 'public'
    AND viewname LIKE '%old_20250927%';
    
    IF legacy_count > 0 THEN
        RAISE EXCEPTION 'Legacy views still exist! Count: %', legacy_count;
    END IF;
    
    RAISE NOTICE 'Migration 001 verification passed. Legacy views dropped.';
END $$;

COMMIT;
