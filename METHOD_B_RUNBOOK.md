# Method B Implementation Runbook

## Quick Deployment Guide

### 1. Apply SQL Views (5 minutes)

Copy and paste the entire contents of this file into Supabase SQL Editor:

```
frontend/db/sql/security/create_public_views.sql
```

This single file creates all public views with proper schema fixes.

**Expected output:**
- CREATE VIEW (multiple times)
- GRANT (multiple times)  
- Verification query results showing row counts

### 2. Verify Views Created

In Supabase SQL Editor, run:
```sql
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name LIKE '%_public_v%'
ORDER BY table_name;
```

Should show:
- news_public_v (with published_at alias)
- weekly_report_public_v (published snapshots only)
- stories_public_v (with id alias, if stories table exists)
- snapshots_public_v (if snapshots table exists)
- weekly_public_view (legacy compatibility view)

### 3. Test Views Locally

```bash
cd frontend

# Set environment if not already done
cp .env.example .env
# Edit .env with your Supabase credentials

# Test views
npx tsx scripts/testViews.ts
```

### 4. Test the Three Core Flows

```bash
# Flow 1: Data ingestion (unchanged - writes to base tables)
cd ..
python summarize_all_v2.py --limit 20

# Flow 2: Weekly snapshot (unchanged - writes to base tables)
cd frontend
npm run snapshot:build:publish

# Flow 3: Production server
npm run build
npm run start

# Open browser to http://localhost:3000
# Verify home page shows news items
# Verify /weekly-report shows latest snapshot
```

### 5. Production Deployment

```bash
# Commit changes
git add .
git commit -m "feat: implement Method B secure views for public data access"

# Deploy (your deployment method)
git push origin main
```

## Verification Steps

### A. Home Page
1. Open http://localhost:3000
2. Should see trending news items
3. Check Network tab: `/api/home` returns data
4. No errors in console

### B. Weekly Report  
1. Open http://localhost:3000/weekly-report
2. Should see "Total Stories: X" (not 0)
3. Download PDF should work
4. No "No snapshots available" error

### C. Security Check
```bash
# This should FAIL or return empty (good!)
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/news_trends?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"

# This should SUCCEED
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/news_public_v?select=*&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

## Troubleshooting

### "View does not exist" Error
- Make sure you ran the SQL script in Supabase
- Check you're in the right project
- Verify with: `SELECT * FROM information_schema.views WHERE table_name = 'news_public_v';`

### No Data Returned
- Views filter for published/recent content
- Run: `SELECT COUNT(*) FROM news_public_v;`
- If 0, check base table has recent data: `SELECT COUNT(*) FROM news_trends WHERE created_at > NOW() - INTERVAL '7 days';`

### Type Errors
- Clear Next.js cache: `rm -rf .next`
- Rebuild: `npm run build`
- Check TypeScript: `npx tsc --noEmit`

### Weekly Report Shows No Data
- Ensure weekly_report_public_v exists
- Check for published snapshots: `SELECT COUNT(*) FROM weekly_report_snapshots WHERE status = 'published';`
- Run snapshot build if needed: `npm run snapshot:build:publish`

## Monitoring

### Check View Performance
```sql
-- In Supabase SQL Editor
EXPLAIN ANALYZE
SELECT * FROM news_public_v 
ORDER BY popularity_score_precise DESC 
LIMIT 20;
```

### View Usage Stats
```sql
-- See which views are being queried
SELECT 
  schemaname,
  viewname,
  n_tup_ins,
  n_tup_upd,
  n_tup_del
FROM pg_stat_user_tables
WHERE schemaname = 'public' 
AND tablename LIKE '%_public_v%';
```

## Emergency Rollback

If critical issues arise:

```bash
# 1. Quick code rollback (1 minute)
cd frontend
git checkout HEAD -- src/app/api/home/route.ts

# 2. Restart server
npm run build && npm run start

# 3. Later: Drop views if needed (they're harmless though)
# In Supabase SQL Editor:
# DROP VIEW IF EXISTS news_public_v CASCADE;
```

System will immediately revert to direct table access.

## Success Metrics

After deployment, verify:
- ✅ Home page loads with news items
- ✅ Weekly report shows data and PDF works  
- ✅ No performance degradation
- ✅ No errors in server logs
- ✅ Direct table access blocked (via RLS)
- ✅ Views return filtered data only

## Contact for Issues

If you encounter issues:
1. Check this runbook first
2. Run diagnostics: `npx tsx scripts/testViews.ts`
3. Check view data: `/api/diagnostics/views` (needs admin secret)
4. Review logs for SQL errors

The implementation is designed to be safe and reversible. Views add a security layer without changing core functionality.
