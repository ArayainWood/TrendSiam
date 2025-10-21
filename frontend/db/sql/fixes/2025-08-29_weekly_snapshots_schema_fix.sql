-- =========================================
-- Weekly Snapshots Schema Alignment Fix
-- =========================================
-- This script aligns the weekly_report_snapshots table schema
-- to match what the builder and views expect

BEGIN;

-- 1. Check current schema and add missing columns if needed
-- =========================================

DO $$
BEGIN
  -- Add items column if it doesn't exist (JSONB array of snapshot items)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'weekly_report_snapshots' 
    AND column_name = 'items'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.weekly_report_snapshots 
    ADD COLUMN items jsonb DEFAULT '[]'::jsonb;
    RAISE NOTICE 'Added items column to weekly_report_snapshots';
  END IF;
  
  -- Add meta column if it doesn't exist (JSONB metadata object)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'weekly_report_snapshots' 
    AND column_name = 'meta'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.weekly_report_snapshots 
    ADD COLUMN meta jsonb DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Added meta column to weekly_report_snapshots';
  END IF;
  
  -- Add built_at column if it doesn't exist (timestamp when snapshot was built)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'weekly_report_snapshots' 
    AND column_name = 'built_at'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.weekly_report_snapshots 
    ADD COLUMN built_at timestamptz NOT NULL DEFAULT now();
    RAISE NOTICE 'Added built_at column to weekly_report_snapshots';
  END IF;
END $$;

-- 2. Update status constraint to match expected values
-- =========================================

DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'weekly_report_snapshots' 
    AND constraint_type = 'CHECK'
    AND constraint_name LIKE '%status%'
  ) THEN
    -- Find and drop the constraint
    EXECUTE (
      SELECT 'ALTER TABLE public.weekly_report_snapshots DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints 
      WHERE table_name = 'weekly_report_snapshots' 
      AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%status%'
      LIMIT 1
    );
    RAISE NOTICE 'Dropped existing status constraint';
  END IF;
  
  -- Add new constraint with correct values
  ALTER TABLE public.weekly_report_snapshots 
  ADD CONSTRAINT weekly_report_snapshots_status_check 
  CHECK (status IN ('building', 'ready', 'failed', 'archived'));
  
  RAISE NOTICE 'Added updated status constraint: building, ready, failed, archived';
END $$;

-- 3. Add RLS policy for service role access to weekly_report_snapshots
-- =========================================

-- Enable RLS on weekly_report_snapshots if not already enabled
ALTER TABLE public.weekly_report_snapshots ENABLE ROW LEVEL SECURITY;

-- Create service role policy for full access
DO $$
BEGIN
  -- Drop existing policy if it exists
  DROP POLICY IF EXISTS "service_role_weekly_snapshots_policy" ON public.weekly_report_snapshots;
  
  -- Create new policy allowing service role full access
  CREATE POLICY "service_role_weekly_snapshots_policy" ON public.weekly_report_snapshots
    FOR ALL TO service_role USING (true) WITH CHECK (true);
  
  RAISE NOTICE 'Created service_role policy for weekly_report_snapshots';
END $$;

-- 4. Create performance indexes
-- =========================================

CREATE INDEX IF NOT EXISTS idx_weekly_snapshots_status_built_at 
ON public.weekly_report_snapshots(status, built_at DESC);

CREATE INDEX IF NOT EXISTS idx_weekly_snapshots_range_dates 
ON public.weekly_report_snapshots(range_start, range_end);

-- 5. Verification
-- =========================================

DO $$
DECLARE
  items_exists boolean;
  meta_exists boolean;
  built_at_exists boolean;
  status_constraint_exists boolean;
BEGIN
  -- Check if all required columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'weekly_report_snapshots' 
    AND column_name = 'items'
    AND table_schema = 'public'
  ) INTO items_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'weekly_report_snapshots' 
    AND column_name = 'meta'
    AND table_schema = 'public'
  ) INTO meta_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'weekly_report_snapshots' 
    AND column_name = 'built_at'
    AND table_schema = 'public'
  ) INTO built_at_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'weekly_report_snapshots' 
    AND constraint_name = 'weekly_report_snapshots_status_check'
  ) INTO status_constraint_exists;
  
  -- Report results
  RAISE NOTICE 'Schema verification:';
  RAISE NOTICE '  - items column: %', CASE WHEN items_exists THEN '✓' ELSE '✗' END;
  RAISE NOTICE '  - meta column: %', CASE WHEN meta_exists THEN '✓' ELSE '✗' END;
  RAISE NOTICE '  - built_at column: %', CASE WHEN built_at_exists THEN '✓' ELSE '✗' END;
  RAISE NOTICE '  - status constraint: %', CASE WHEN status_constraint_exists THEN '✓' ELSE '✗' END;
  
  IF items_exists AND meta_exists AND built_at_exists AND status_constraint_exists THEN
    RAISE NOTICE '✅ Weekly snapshots schema is properly aligned';
  ELSE
    RAISE WARNING '❌ Weekly snapshots schema alignment incomplete';
  END IF;
END $$;

COMMIT;

-- =========================================
-- Usage Notes:
-- =========================================
-- After running this script:
-- 1. The weekly_report_snapshots table will have items, meta, and built_at columns
-- 2. Status constraint allows: building, ready, failed, archived
-- 3. Service role has full access via RLS policy
-- 4. Performance indexes are in place
-- 5. The snapshot builder should work without schema errors
