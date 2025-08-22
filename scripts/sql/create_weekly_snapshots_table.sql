-- Create weekly_report_snapshots table if it doesn't exist
-- This is an idempotent migration that can be safely re-run

-- Create snapshot status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'snapshot_status') THEN
        CREATE TYPE public.snapshot_status AS ENUM ('building', 'published', 'failed');
    END IF;
END
$$;

-- Create the table
CREATE TABLE IF NOT EXISTS public.weekly_report_snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status public.snapshot_status NOT NULL DEFAULT 'building',
    range_start TIMESTAMPTZ NOT NULL,
    range_end TIMESTAMPTZ NOT NULL,
    built_at TIMESTAMPTZ,
    algo_version TEXT,
    data_version TEXT,
    item_count INTEGER NOT NULL DEFAULT 0,
    items JSONB[] NOT NULL DEFAULT ARRAY[]::JSONB[], -- Array of JSON objects for report items
    meta JSONB, -- Additional metadata (e.g., sources, notes)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_weekly_snapshots_built_at ON public.weekly_report_snapshots (built_at DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_snapshots_range ON public.weekly_report_snapshots (range_start, range_end);
CREATE INDEX IF NOT EXISTS idx_weekly_snapshots_status ON public.weekly_report_snapshots (status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.weekly_report_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies:
-- 1. Public read access for published snapshots
DROP POLICY IF EXISTS "Public read access for published snapshots" ON public.weekly_report_snapshots;
CREATE POLICY "Public read access for published snapshots" ON public.weekly_report_snapshots
  FOR SELECT
  USING (status = 'published');

-- 2. Service role can do anything (for backend operations)
-- Ensure your service_role key is only used server-side
DROP POLICY IF EXISTS "Service role full access" ON public.weekly_report_snapshots;
CREATE POLICY "Service role full access" ON public.weekly_report_snapshots
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add an updated_at trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_weekly_report_snapshots_updated_at ON public.weekly_report_snapshots;
CREATE TRIGGER update_weekly_report_snapshots_updated_at
BEFORE UPDATE ON public.weekly_report_snapshots
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add table comment
COMMENT ON TABLE public.weekly_report_snapshots IS 'Stores pre-computed weekly report snapshots for consistent data delivery.';
COMMENT ON COLUMN public.weekly_report_snapshots.items IS 'Array of JSON objects, each representing a news item in the snapshot.';

-- Verify the table was created
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'weekly_report_snapshots') THEN
        RAISE NOTICE 'Table weekly_report_snapshots created successfully';
    ELSE
        RAISE EXCEPTION 'Failed to create weekly_report_snapshots table';
    END IF;
END
$$;