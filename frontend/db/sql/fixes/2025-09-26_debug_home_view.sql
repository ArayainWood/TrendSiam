-- =========================================================
-- DEBUG HOME VIEW ISSUE
-- Date: 2025-09-26
-- 
-- Quick diagnostics to understand why view returns 0 rows
-- =========================================================

-- 1. Check if base table has data
SELECT 'news_trends table count' AS check_name, COUNT(*) AS result
FROM news_trends
WHERE title IS NOT NULL AND title != '';

-- 2. Check current view definition
SELECT 'View exists' AS check_name, 
       CASE WHEN COUNT(*) > 0 THEN 'YES' ELSE 'NO' END AS result
FROM pg_views 
WHERE schemaname = 'public' AND viewname = 'public_v_home_news';

-- 3. Check if view returns any rows
SELECT 'View row count' AS check_name, COUNT(*) AS result
FROM public.public_v_home_news;

-- 4. Check stories table
SELECT 'stories table count' AS check_name, COUNT(*) AS result
FROM stories;

-- 5. Check snapshots table
SELECT 'snapshots table count' AS check_name, COUNT(*) AS result
FROM snapshots;

-- 6. Test a simplified query mimicking the view logic
SELECT 'Simple news query count' AS check_name, COUNT(*) AS result
FROM news_trends nt
WHERE nt.title IS NOT NULL AND nt.title != '';

-- 7. Check for any news_trends rows at all
SELECT 'Any news_trends rows' AS check_name, COUNT(*) AS result
FROM news_trends;

-- 8. Sample of news_trends data
SELECT 'Sample news_trends data:' AS info;
SELECT id, title, platform, created_at, updated_at 
FROM news_trends 
LIMIT 5;

-- 9. Check view columns
SELECT 'View columns:' AS info;
SELECT column_name, data_type, ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'public_v_home_news'
ORDER BY ordinal_position;

-- 10. Check grants on view
SELECT 'View grants:' AS info;
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'public_v_home_news'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;
