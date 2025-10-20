-- =========================================================
-- CREATE PUBLIC VIEW FOR SYSTEM METADATA
-- Date: 2025-09-23
--
-- Creates a safe view for reading system metadata keys 
-- needed by frontend. Postgres 15 / Supabase compatible.
-- Expose only allowed keys.
-- =========================================================

BEGIN;

-- Drop existing view to ensure clean state
DROP VIEW IF EXISTS public.public_v_system_meta CASCADE;

-- Create safe public view exposing only allowed keys
CREATE OR REPLACE VIEW public.public_v_system_meta AS
SELECT 
  key, 
  value, 
  updated_at
FROM public.system_meta
WHERE key IN (
  'home_freshness_policy',
  'home_limit',
  'top3_max',
  'home_columns_hash',
  'news_last_updated'
);

-- =========================================
-- PERMISSIONS
-- =========================================

-- Ensure view can be read by anon/authenticated
-- No base-table grants here
GRANT SELECT ON public.public_v_system_meta TO anon;
GRANT SELECT ON public.public_v_system_meta TO authenticated;

-- =========================================
-- DOCUMENTATION
-- =========================================

COMMENT ON VIEW public.public_v_system_meta IS
'Public view exposing safe system metadata keys.
Security: Frontend reads this view, not the base system_meta table.
Keys exposed: home_freshness_policy, home_limit, top3_max, home_columns_hash, news_last_updated.
Created: 2025-09-23';

-- =========================================
-- VERIFICATION
-- =========================================

DO $$
DECLARE
  v_count INTEGER;
  v_keys TEXT[];
BEGIN
  -- Count accessible keys
  SELECT COUNT(*) INTO v_count FROM public.public_v_system_meta;
  RAISE NOTICE 'System meta view has % keys exposed', v_count;
  
  -- List keys
  SELECT array_agg(key ORDER BY key) INTO v_keys 
  FROM public.public_v_system_meta;
  
  RAISE NOTICE 'Exposed keys: %', v_keys;
END $$;

COMMIT;
