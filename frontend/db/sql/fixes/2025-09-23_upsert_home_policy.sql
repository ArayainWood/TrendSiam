-- =========================================================
-- UPSERT HOME POLICY METADATA
-- Date: 2025-09-23
--
-- This migration adds machine-readable policy metadata
-- for the home view to system_meta table.
-- 
-- NOTE: system_meta table has only: key, value, updated_at
-- =========================================================

BEGIN;

-- =========================================
-- 1. UPSERT FRESHNESS POLICY
-- =========================================

-- Insert or update home freshness policy (using only existing columns)
INSERT INTO system_meta (key, value, updated_at)
VALUES (
  'home_freshness_policy',
  'latest_snapshot:72h_primary|30d_fallback',
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- =========================================
-- 2. COMPUTE AND STORE COLUMN HASH
-- =========================================

-- Compute hash of home view columns for integrity checking
WITH column_list AS (
  SELECT 
    encode(sha256(jsonb_agg(column_name ORDER BY ordinal_position)::text::bytea), 'hex') AS columns_hash
  FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'public_v_home_news'
)
INSERT INTO system_meta (key, value, updated_at)
SELECT
  'home_columns_hash',
  columns_hash,
  NOW()
FROM column_list
ON CONFLICT (key) DO UPDATE
SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- =========================================
-- 3. RECREATE PUBLIC_V_SYSTEM_META VIEW
-- =========================================

-- Drop existing view to ensure clean state
DROP VIEW IF EXISTS public.public_v_system_meta CASCADE;

-- Create safe public view exposing only allowed keys
CREATE OR REPLACE VIEW public.public_v_system_meta AS
SELECT 
  key, 
  value, 
  updated_at
FROM system_meta
WHERE key IN (
  'home_limit',
  'top3_max',
  'news_last_updated',
  'home_freshness_policy',
  'home_columns_hash'
);

-- =========================================
-- 4. SET SECURITY AND PERMISSIONS
-- =========================================

-- Ensure SECURITY INVOKER (respects RLS)
ALTER VIEW public.public_v_system_meta SET (security_invoker = true);

-- Grant read access following Plan-B security model
GRANT SELECT ON public.public_v_system_meta TO anon;
GRANT SELECT ON public.public_v_system_meta TO authenticated;

-- =========================================
-- 5. VERIFICATION
-- =========================================

-- Verify the new keys are accessible
DO $$
DECLARE
  v_policy TEXT;
  v_hash TEXT;
  v_key_count INTEGER;
BEGIN
  -- Check policy value
  SELECT value INTO v_policy 
  FROM public.public_v_system_meta 
  WHERE key = 'home_freshness_policy';
  
  IF v_policy IS NULL THEN
    RAISE WARNING 'home_freshness_policy not found in view';
  ELSE
    RAISE NOTICE 'home_freshness_policy: %', v_policy;
  END IF;
  
  -- Check hash value
  SELECT value INTO v_hash 
  FROM public.public_v_system_meta 
  WHERE key = 'home_columns_hash';
  
  IF v_hash IS NULL THEN
    RAISE WARNING 'home_columns_hash not found in view';
  ELSE
    RAISE NOTICE 'home_columns_hash: %', LEFT(v_hash, 16) || '...';
  END IF;
  
  -- Count accessible keys
  SELECT COUNT(*) INTO v_key_count
  FROM public.public_v_system_meta;
  
  RAISE NOTICE 'Total keys exposed via public_v_system_meta: %', v_key_count;
END $$;

COMMIT;
