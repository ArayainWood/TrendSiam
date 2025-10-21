-- =========================================================
-- VERIFY VIEW-ONLY PERMISSIONS
-- Date: 2025-09-23
--
-- Ensures anon/authenticated can ONLY access views,
-- never base tables. Critical security verification.
-- =========================================================

\echo '========================================='
\echo 'VIEW-ONLY PERMISSIONS VERIFICATION'
\echo '========================================='
\echo ''

-- 1. List all SELECT grants on public views
\echo '1. PUBLIC VIEW GRANTS (Should have SELECT for anon/authenticated):'
\echo ''

SELECT 
  table_name,
  grantee,
  privilege_type,
  'VIEW' as object_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name IN ('public_v_home_news','public_v_system_meta','public_v_ai_images_latest')
  AND privilege_type='SELECT'
ORDER BY table_name, grantee;

-- 2. Check for any base table grants (CRITICAL SECURITY CHECK)
\echo ''
\echo '2. BASE TABLE GRANTS CHECK (Must be EMPTY for anon/authenticated):'
\echo ''

WITH base_table_grants AS (
  SELECT t.table_name, g.grantee, g.privilege_type
  FROM information_schema.role_table_grants g
  JOIN information_schema.tables t
    ON t.table_name=g.table_name AND t.table_schema=g.table_schema
  WHERE t.table_schema='public'
    AND t.table_type='BASE TABLE'
    AND g.grantee IN ('anon','authenticated')
    AND g.privilege_type='SELECT'
)
SELECT * FROM base_table_grants;

-- Summary
\echo ''
\echo '3. SECURITY SUMMARY:'
\echo ''

WITH security_check AS (
  SELECT 
    (SELECT COUNT(*) 
     FROM information_schema.role_table_grants
     WHERE table_schema='public'
       AND table_name IN ('public_v_home_news','public_v_system_meta','public_v_ai_images_latest')
       AND grantee IN ('anon','authenticated')
       AND privilege_type='SELECT') as view_grants,
    (SELECT COUNT(*)
     FROM information_schema.role_table_grants g
     JOIN information_schema.tables t
       ON t.table_name=g.table_name AND t.table_schema=g.table_schema
     WHERE t.table_schema='public'
       AND t.table_type='BASE TABLE'
       AND g.grantee IN ('anon','authenticated')
       AND g.privilege_type='SELECT') as base_grants
)
SELECT 
  CASE 
    WHEN view_grants >= 6 AND base_grants = 0 THEN 
      '✅ SECURE: Views accessible, base tables protected'
    WHEN base_grants > 0 THEN 
      '❌ SECURITY RISK: anon/authenticated can access ' || base_grants || ' base tables!'
    WHEN view_grants < 6 THEN 
      '⚠️  WARNING: Only ' || view_grants || ' view grants found (expected ≥6)'
    ELSE 
      '❓ Unknown state'
  END as security_status,
  view_grants || ' view grants' as views,
  base_grants || ' base table grants' as base_tables
FROM security_check;

-- 4. Detailed base table check
\echo ''
\echo '4. DETAILED BASE TABLE CHECK:'
\echo ''

SELECT 
  t.table_name,
  CASE 
    WHEN COUNT(g.grantee) FILTER (WHERE g.grantee IN ('anon','authenticated')) > 0 
    THEN '❌ EXPOSED to anon/authenticated'
    ELSE '✅ Protected'
  END as status
FROM information_schema.tables t
LEFT JOIN information_schema.role_table_grants g
  ON t.table_name = g.table_name 
  AND t.table_schema = g.table_schema
  AND g.privilege_type = 'SELECT'
  AND g.grantee IN ('anon','authenticated')
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND t.table_name IN ('news_trends', 'stories', 'snapshots', 'ai_images', 'system_meta', 'stats', 'image_files', 'weekly_report_snapshots')
GROUP BY t.table_name
ORDER BY status DESC, t.table_name;

\echo ''
\echo '========================================='
\echo 'VERIFICATION COMPLETE'
\echo '========================================='
