-- =========================================
-- WEEKLY SNAPSHOTS VIEW (Plan-B Security)
-- Supabase Editor Compatible (no psql meta-commands)
-- =========================================

-- Creates public_v_weekly_snapshots for snapshot history & status
-- SECURITY INVOKER for Plan-B compliance (anon reads view only)

CREATE OR REPLACE VIEW public.public_v_weekly_snapshots
WITH (security_invoker = true, security_barrier = true) AS
SELECT
  s.snapshot_id,
  s.status,
  s.range_start,
  s.range_end,
  s.built_at,
  s.created_at,                 -- real timestamp in base table
  s.created_at AS updated_at,   -- UI compatibility: expose as updated_at
  s.algo_version,
  s.data_version,
  CASE
    WHEN jsonb_typeof(s.items) = 'array' THEN jsonb_array_length(s.items)
    ELSE 0
  END                         AS items_count
FROM public.weekly_report_snapshots AS s
ORDER BY s.built_at DESC NULLS LAST, s.created_at DESC;

-- Safe grants (re-running is OK)
GRANT SELECT ON public.public_v_weekly_snapshots TO anon, authenticated;

-- =========================================
-- Quick validation
-- =========================================
-- Expect: at least 0 rows, columns present, items_count numeric
-- SELECT * FROM public.public_v_weekly_snapshots LIMIT 3;
-- SELECT COUNT(*) FROM public.public_v_weekly_snapshots;
-- SELECT snapshot_id, items_count FROM public.public_v_weekly_snapshots ORDER BY created_at DESC LIMIT 5;
