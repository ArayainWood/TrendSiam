# Weekly Report Refresh Runbook

**Last Updated:** 2025-10-14  
**System:** TrendSiam Weekly Report  
**Purpose:** Canonical commands to build and refresh the Weekly Report

---

## Quick Reference

```bash
# Most common workflow: Build and publish immediately
cd frontend
npm run snapshot:build:publish

# Alternative: Draft first, then publish
cd frontend
npm run snapshot:build              # Creates draft
npm run snapshot:publish -- <id>    # Publish specific snapshot
```

---

## Overview

The Weekly Report displays aggregated trending news from the **last 7 days** using a snapshot-based architecture. Snapshots are stored in the `weekly_report_snapshots` table in Supabase and ensure consistent data display for both web and PDF views.

### Architecture

```
News Trends Table → Snapshot Builder → weekly_report_snapshots → Weekly Report Page
                         ↓                                              ↓
                   (Last 7 days)                              (No caching, force-dynamic)
```

---

## Prerequisites

### 1. Environment Variables

Required in `.env.local` (frontend directory):

```bash
# Supabase Configuration (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Protect build endpoint
SNAPSHOT_BUILD_TOKEN=your-secret-token
```

⚠️ **Security Note:** 
- `SUPABASE_SERVICE_ROLE_KEY` is required for snapshot building
- Never commit this key to version control
- Only use in backend scripts and API routes

### 2. Database Schema

The `weekly_report_snapshots` table must exist:

```sql
-- Verify table exists
SELECT COUNT(*) FROM weekly_report_snapshots;
```

If table doesn't exist, run migration:
```bash
psql $SUPABASE_DB_URL < scripts/sql/create_weekly_snapshots_table.sql
```

### 3. Node.js Dependencies

Ensure you're in the `frontend` directory with dependencies installed:

```bash
cd frontend
npm install
```

---

## Commands

### 1. Build and Publish (Recommended)

**Use Case:** Production updates, cron jobs, most common workflow

```bash
cd frontend
npm run snapshot:build:publish
```

**What it does:**
- Queries `news_trends` table for items from last 7 days
- Creates a new snapshot with `status = 'published'`
- Calculates metadata (total items, date range, algo version)
- Saves to `weekly_report_snapshots` table
- Returns snapshot ID

**Expected Output:**
```
============================================================
Weekly Snapshot Builder
============================================================
Start time: 2025-10-14T11:30:00.000Z
Mode: PRODUCTION
Publish: YES

Building snapshot...
✅ Snapshot build successful!
Snapshot ID: abc123...
Status: published
Items: 150
Date range: 2025-10-07 to 2025-10-14
```

---

### 2. Draft First (Safer Workflow)

**Use Case:** When you want to review before publishing

#### Step 1: Build as Draft

```bash
cd frontend
npm run snapshot:build
```

**Output:**
```
✅ Snapshot build successful!
Snapshot ID: xyz789...
Status: draft
Items: 150
```

#### Step 2: Review the Draft

```bash
# Check via diagnostics endpoint (requires dev server running)
curl http://localhost:3000/api/weekly/diagnostics | jq .

# Or query database directly
psql $SUPABASE_DB_URL -c "SELECT snapshot_id, status, item_count, range_start, range_end FROM weekly_report_snapshots WHERE snapshot_id = 'xyz789...'"
```

#### Step 3: Publish the Draft

```bash
cd frontend
npm run snapshot:publish -- xyz789
```

---

### 3. Dry Run (Testing)

**Use Case:** Test the build process without writing to database

```bash
cd frontend
npm run snapshot:build:dry
```

**What it does:**
- Queries data as normal
- Simulates snapshot creation
- **Does NOT write to database**
- Shows what would be created

**Expected Output:**
```
Mode: DRY RUN
Publish: NO (draft)

✅ DRY RUN completed
Would create snapshot with 150 items
Date range: 2025-10-07 to 2025-10-14
```

---

### 4. Diagnostic Commands

#### Check Current Snapshot

```bash
# Via API (requires dev server)
curl http://localhost:3000/api/weekly/diagnostics | jq .

# Via database
psql $SUPABASE_DB_URL -c "
SELECT 
    snapshot_id, 
    status, 
    item_count, 
    range_start, 
    range_end, 
    built_at 
FROM weekly_report_snapshots 
WHERE status = 'published' 
ORDER BY built_at DESC 
LIMIT 1;"
```

#### Check Snapshot Count

```bash
# Total snapshots
psql $SUPABASE_DB_URL -c "SELECT status, COUNT(*) FROM weekly_report_snapshots GROUP BY status;"

# Recent snapshots (last 7 days)
psql $SUPABASE_DB_URL -c "SELECT snapshot_id, status, item_count, built_at FROM weekly_report_snapshots WHERE built_at >= now() - interval '7 days' ORDER BY built_at DESC;"
```

---

## Verification Steps

After building/publishing a snapshot:

### 1. Check Database

```bash
psql $SUPABASE_DB_URL -c "
SELECT 
    snapshot_id,
    status,
    item_count,
    range_start,
    range_end,
    built_at AT TIME ZONE 'Asia/Bangkok' as built_at_bangkok
FROM weekly_report_snapshots
WHERE status = 'published'
ORDER BY built_at DESC
LIMIT 1;"
```

**Expected Result:**
- `status = 'published'`
- `item_count > 0` (typically 50-200 depending on pipeline runs)
- `range_start` and `range_end` span exactly 7 days
- `built_at_bangkok` is recent (within last few minutes)

### 2. Check Weekly Report Page

#### Option A: Via Dev Server

```bash
# Start dev server (from frontend directory)
npm run dev

# Open browser
open http://localhost:3000/weekly-report
```

#### Option B: Via Production Build

```bash
# Build and start (from frontend directory)
npm run build
npm start

# Open browser
open http://localhost:3000/weekly-report
```

**What to verify:**
- ✅ Page shows "Last 7 Days" date range
- ✅ Items displayed match `item_count` from database
- ✅ Top-3 items visible with images
- ✅ No "Invalid Date" or "Jan 1, 1970" displays
- ✅ PDF download button works

### 3. Test PDF Generation

```bash
# Via API
curl http://localhost:3000/api/weekly/pdf2 -o weekly-report.pdf

# Or via browser
open http://localhost:3000/api/weekly/pdf2
```

**Expected:**
- ✅ PDF downloads successfully
- ✅ File size > 50KB
- ✅ PDF opens in viewer without errors
- ✅ Content matches web page

---

## Troubleshooting

### Issue 1: "Missing environment variables"

**Error:**
```
Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

**Solution:**
```bash
# Check environment variables are set
cd frontend
cat .env.local | grep SUPABASE

# If missing, create .env.local:
echo "SUPABASE_URL=https://your-project.supabase.co" >> .env.local
echo "SUPABASE_SERVICE_ROLE_KEY=your-key" >> .env.local

# Try again
npm run snapshot:build:publish
```

---

### Issue 2: "Table does not exist"

**Error:**
```
relation "weekly_report_snapshots" does not exist
```

**Solution:**
```bash
# Run migration
psql $SUPABASE_DB_URL < scripts/sql/create_weekly_snapshots_table.sql

# Verify
psql $SUPABASE_DB_URL -c "\d weekly_report_snapshots"
```

---

### Issue 3: "No items found"

**Error:**
```
Warning: No items found in last 7 days
```

**Cause:** No data in `news_trends` table for the past 7 days

**Solution:**
```bash
# Check database
psql $SUPABASE_DB_URL -c "
SELECT 
    DATE(created_at AT TIME ZONE 'Asia/Bangkok') as date,
    COUNT(*) as count
FROM news_trends
WHERE created_at >= now() - interval '7 days'
GROUP BY DATE(created_at AT TIME ZONE 'Asia/Bangkok')
ORDER BY date DESC;"

# If no data, run pipeline first
cd ..  # back to project root
python summarize_all_v2.py --limit 20 --verbose

# Then rebuild snapshot
cd frontend
npm run snapshot:build:publish
```

---

### Issue 4: "Snapshot ID not found" when publishing

**Error:**
```
Error: Snapshot xyz789 not found or not in draft status
```

**Solution:**
```bash
# List all draft snapshots
psql $SUPABASE_DB_URL -c "SELECT snapshot_id, status, built_at FROM weekly_report_snapshots WHERE status = 'draft' ORDER BY built_at DESC;"

# Use correct snapshot ID
npm run snapshot:publish -- <correct-id>

# Or build and publish in one step
npm run snapshot:build:publish
```

---

### Issue 5: Weekly Report page shows old data

**Cause:** Page is showing previous published snapshot

**Solution:**

#### Option 1: Build new snapshot
```bash
cd frontend
npm run snapshot:build:publish
```

Then refresh browser with hard reload (Ctrl+Shift+R or Cmd+Shift+R)

#### Option 2: Check if dev server is running
```bash
# The page requires the dev server to fetch data
npm run dev

# Then open browser
open http://localhost:3000/weekly-report
```

#### Option 3: Clear Next.js cache
```bash
cd frontend
rm -rf .next
npm run build
npm run dev
```

---

## Automation

### Cron Job Setup (Recommended: Every 6 hours)

Add to crontab or hosting platform (e.g., Render, Vercel Cron):

```bash
# Run every 6 hours
0 */6 * * * cd /path/to/TrendSiam/frontend && npm run snapshot:build:publish

# Alternative: Run daily at 6 AM Bangkok time (23:00 UTC)
0 23 * * * cd /path/to/TrendSiam/frontend && npm run snapshot:build:publish
```

### Render Cron Jobs

In Render dashboard:
1. Go to your service
2. Add "Cron Job"
3. Command: `cd frontend && npm run snapshot:build:publish`
4. Schedule: `0 */6 * * *` (every 6 hours)

---

## Data Freshness

### Snapshot Window: Rolling 7 Days

The snapshot builder uses:
```sql
WHERE created_at >= now() - interval '7 days'
AND created_at <= now()
```

**Example Timeline:**

| Today | Snapshot includes data from |
|-------|---------------------------|
| Oct 14 | Oct 7 - Oct 14 |
| Oct 15 | Oct 8 - Oct 15 |
| Oct 16 | Oct 9 - Oct 16 |

### Recommended Refresh Frequency

- **Minimum:** Daily (1x per day)
- **Recommended:** Every 6 hours (4x per day)
- **Maximum:** Every 3 hours (8x per day)

**Rationale:**
- Weekly Report shows 7-day aggregates (slower change)
- Building too frequently adds DB load without user benefit
- Every 6 hours balances freshness with resource usage

---

## API Endpoints

### `/api/weekly`

Returns the latest published snapshot data

```bash
curl http://localhost:3000/api/weekly | jq .
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "snapshotId": "abc123...",
    "totalItems": 150,
    "dateRange": { "start": "2025-10-07", "end": "2025-10-14" }
  }
}
```

### `/api/weekly/diagnostics`

Returns detailed system information

```bash
curl http://localhost:3000/api/weekly/diagnostics | jq .
```

**Response:**
```json
{
  "latest": {
    "snapshot_id": "abc123...",
    "status": "published",
    "item_count": 150,
    "range": "2025-10-07 to 2025-10-14",
    "built_at": "2025-10-14T11:30:00Z"
  },
  "top3": [...],
  "stats": {
    "total_snapshots": 42,
    "published": 35,
    "drafts": 7
  }
}
```

---

## File Locations

### Scripts

- **Builder:** `frontend/scripts/buildWeeklySnapshot.ts`
- **Publisher:** `frontend/scripts/publishWeeklySnapshot.ts`
- **Test:** `frontend/scripts/testSnapshotSystem.ts`

### Core Logic

- **Builder Core:** `frontend/src/lib/snapshots/builderCore.ts`
- **Repository:** `frontend/src/lib/weekly/weeklyRepo.ts`
- **Data Fetcher:** `frontend/src/lib/data/weeklySnapshot.ts`

### API Routes

- **Weekly Data:** `frontend/src/app/api/weekly/route.ts`
- **Diagnostics:** `frontend/src/app/api/weekly/diagnostics/route.ts`
- **PDF:** `frontend/src/app/api/weekly/pdf2/route.ts`

### Page

- **Weekly Report:** `frontend/src/app/weekly-report/page.tsx`

---

## Acceptance Criteria

After running snapshot refresh commands, verify:

- ✅ **Database:** Latest snapshot has `status = 'published'` and recent `built_at`
- ✅ **Item Count:** Snapshot contains > 0 items (typically 50-200)
- ✅ **Date Range:** Exactly 7 days from `range_start` to `range_end`
- ✅ **Web Page:** `/weekly-report` displays correct item count and date range
- ✅ **PDF:** Downloads successfully and matches web content
- ✅ **No Errors:** Console/logs show no permission errors or missing columns
- ✅ **Plan-B Security:** Builder uses `service_role` key, web page uses `anon` key

---

## Security Compliance (Plan-B)

### Builder Script (Backend)

✅ **Uses:** `SUPABASE_SERVICE_ROLE_KEY`  
✅ **Access:** Full read/write to `news_trends` and `weekly_report_snapshots`  
✅ **Environment:** Server-side only (never exposed to client)

### Weekly Report Page (Frontend)

✅ **Uses:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
✅ **Access:** Read-only from `weekly_report_snapshots` table  
✅ **Grants:** SELECT permission on table for `anon` role  
✅ **No base-table reads:** Does NOT query `news_trends` directly

### API Routes

✅ **`/api/weekly`:** Uses `anon` key, reads from `weekly_report_snapshots`  
✅ **`/api/weekly/diagnostics`:** Uses `anon` key, read-only queries  
✅ **`/api/weekly/pdf2`:** Uses `anon` key, generates PDF from snapshot data

---

## Related Documentation

- **System Overview:** `docs/WEEKLY_SNAPSHOT_SYSTEM.md`
- **Implementation Summary:** `WEEKLY_SNAPSHOT_IMPLEMENTATION_SUMMARY.md`
- **Developer Notes:** `DEV_NOTES_WEEKLY_SNAPSHOT.md`
- **SQL Schema:** `scripts/sql/create_weekly_snapshots_table.sql`
- **Memory Bank:** `memory-bank/03_frontend_homepage_freshness.mb` (includes weekly patterns)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-10-14 | Initial runbook creation | AI Assistant |

---

**Questions or Issues?**

1. Check diagnostics: `curl http://localhost:3000/api/weekly/diagnostics`
2. Review logs in console during snapshot build
3. Verify database state with SQL queries above
4. Ensure dev server is running for web page access

**End of Runbook**

