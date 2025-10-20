-- Check snapshots and public_v_latest_snapshots schema
\echo '--- snapshots table columns ---'
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'snapshots'
  AND column_name IN ('view_count', 'like_count', 'comment_count', 'rank', 'growth_rate')
ORDER BY ordinal_position;

\echo ''
\echo '--- public_v_latest_snapshots view columns ---'
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'public_v_latest_snapshots'
ORDER BY ordinal_position;

