# Manual Testing Guide for Diagnostics Permission Fix

## SQL Migrations to Apply First

1. Apply these SQL files in Supabase SQL Editor:

```sql
-- 1. Create public system meta view
-- File: frontend/db/sql/fixes/2025-09-17_public_v_system_meta.sql
BEGIN;

CREATE OR REPLACE VIEW public.public_v_system_meta
AS
SELECT
  key,
  value,
  updated_at
FROM public.system_meta
WHERE key IN ('home_limit','top3_max','news_last_updated');

ALTER VIEW public.public_v_system_meta OWNER TO postgres;
GRANT SELECT ON public.public_v_system_meta TO anon, authenticated;
COMMENT ON VIEW public.public_v_system_meta IS
'Public, read-only subset of system_meta for frontend diagnostics (Plan-B).';

COMMIT;
```

```sql
-- 2. Ensure grants on views
-- File: frontend/db/sql/fixes/2025-09-17_grant_public_v_home_news.sql
BEGIN;

GRANT SELECT ON public.public_v_home_news TO anon, authenticated;
ALTER VIEW public.public_v_home_news SET (security_invoker = true);
GRANT SELECT ON public.public_v_weekly_stats TO anon, authenticated;
GRANT SELECT ON public.public_v_weekly_snapshots TO anon, authenticated;

COMMIT;
```

## Test the APIs

After applying SQL and starting the dev server (`npm run dev`):

### 1. Test Diagnostics API
Open: http://localhost:3000/api/home/diagnostics

Expected response:
```json
{
  "success": true,
  "fetchedCount": [number],
  "columnsFromView": [...],
  "missingColumns": [],
  "unexpectedColumns": [],
  "meta": {
    "home_limit": "20",
    "top3_max": "3",
    "news_last_updated": "..."
  },
  "sampleTitles": [...]
}
```

**Key**: Should NOT have any "permission denied" errors

### 2. Test Home API
Open: http://localhost:3000/api/home

Expected response:
```json
{
  "data": [...],
  "top3Ids": [...],
  "meta": {
    "updatedAt": "..."
  }
}
```

### 3. Test Home Page
Open: http://localhost:3000

Expected:
- News cards should render
- Top-3 items have images and "View AI Prompt" button
- Non-Top-3 items have no images

## Verify in Supabase

Run this query to check the views exist and have proper grants:

```sql
-- Check views exist
SELECT 
  schemaname,
  viewname,
  viewowner
FROM pg_views 
WHERE schemaname = 'public' 
  AND viewname IN ('public_v_home_news', 'public_v_system_meta', 'public_v_weekly_stats', 'public_v_weekly_snapshots')
ORDER BY viewname;

-- Check grants
SELECT 
  grantee,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
  AND table_name IN ('public_v_home_news', 'public_v_system_meta')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;
```

## If No Data Shows

If the APIs return empty data, run the offline pipeline:
```bash
cd ..  # Go to project root
python summarize_all_v2.py --limit 20 --verbose --force-refresh-stats
```

Then refresh the APIs/home page.
