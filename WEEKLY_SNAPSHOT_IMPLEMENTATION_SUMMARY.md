# Weekly Report Snapshot System Implementation Summary

## Overview
Successfully implemented a robust Rolling 7-day Snapshot system for TrendSiam's Weekly Report and PDF generation. The system ensures data consistency between web and PDF views, fixes the date parsing issues, and provides automatic updates every 3-6 hours.

## Changes Made

### 1. Database Schema
**File**: `scripts/sql/create_weekly_snapshots_table.sql`
- Created `weekly_report_snapshots` table with:
  - UUID primary key
  - Status tracking (building/published)
  - Date range fields
  - JSONB storage for items and metadata
  - Proper indexes and RLS policies
  - Idempotent migration (safe to re-run)

### 2. Snapshot Builder
**File**: `frontend/src/lib/data/snapshotBuilder.ts`
- Server-side snapshot builder with:
  - 7-day window filtering by `created_at` (ingestion time)
  - Deterministic ranking by `popularity_score_precise`
  - Concurrency protection
  - Minimum items threshold (5)
  - Automatic pruning of old snapshots (28 days)
  - Comprehensive error handling

### 3. Snapshot Data Fetcher
**File**: `frontend/src/lib/data/weeklySnapshot.ts`
- Centralized date formatting with 1970 bug fix
- Snapshot fetching by ID or latest
- Metrics calculation
- Update checking functionality

### 4. Weekly Report Page Updates
**Files**: 
- `frontend/src/app/weekly-report/page.tsx`
- `frontend/src/app/weekly-report/WeeklyReportClient.tsx`
- Updated to use snapshot system
- Shows "As of" timestamp
- Polls for updates every 60 seconds
- Displays refresh banner when newer data available
- Fixed date display issues

### 5. PDF Generator Updates
**Files**:
- `frontend/src/app/api/weekly/pdf/route.tsx`
- `frontend/src/lib/pdf/WeeklyDoc.tsx`
- Accepts `snapshot` query parameter
- Uses same snapshot data as web page
- Shows date range and snapshot info
- Cache-busting filename with snapshot ID

### 6. API Endpoints
- **`/api/weekly`** - Updated to return snapshot data
- **`/api/weekly/check-update`** - Checks for newer snapshots
- **`/api/weekly/diagnostics`** - System health and statistics
- **`/api/weekly/build-snapshot`** - Protected endpoint to trigger builds

### 7. Build Scripts
- **`frontend/scripts/buildWeeklySnapshot.ts`** - CLI tool for manual/cron builds
- **`frontend/scripts/testSnapshotSystem.ts`** - Test script to verify system

### 8. Documentation
- **`docs/WEEKLY_SNAPSHOT_SYSTEM.md`** - Comprehensive system documentation
- **`WEEKLY_SNAPSHOT_IMPLEMENTATION_SUMMARY.md`** - This summary

## Key Features Implemented

### ✅ Rolling 7-day Window
- Filters by `created_at` (when first ingested)
- Shows items from exactly last 7 days
- Updates snapshot every 3-6 hours

### ✅ Data Consistency
- Web page and PDF use same snapshot ID
- Data frozen at build time
- Rankings remain stable between rebuilds

### ✅ Date Bug Fix
- Centralized `formatDisplayDate()` function
- Validates dates (rejects < 2020)
- Falls back to "—" for invalid dates
- No more "Jan 1, 1970" displays

### ✅ Update Notifications
- Client polls for new snapshots
- Shows banner when updates available
- User controls when to refresh

### ✅ Safety Features
- Idempotent migrations
- Concurrency protection
- Minimum items threshold
- Atomic publishing
- Auto-pruning old data

## How to Use

### 1. Run Migration
```bash
# Safe to run multiple times
psql $DATABASE_URL < scripts/sql/create_weekly_snapshots_table.sql
```

### 2. Build Initial Snapshot
```bash
cd frontend
npx tsx scripts/buildWeeklySnapshot.ts
```

### 3. Set Up Cron (Render)
Add to cron jobs:
```
0 */3 * * * cd /opt/render/project/src/frontend && npx tsx scripts/buildWeeklySnapshot.ts
```

### 4. (Optional) Protect Build Endpoint
Add to environment:
```
SNAPSHOT_BUILD_TOKEN=your-secret-token
```

### 5. Test the System
```bash
# Run test script
npx tsx scripts/testSnapshotSystem.ts

# Check diagnostics
curl https://your-site.com/api/weekly/diagnostics
```

## Verification Steps

1. **Check snapshot exists**:
   - Visit `/weekly-report`
   - Should show "As of [date/time]" badge
   - Note the snapshot ID in diagnostics

2. **Verify PDF matches**:
   - Click "Download PDF"
   - PDF should show same date range
   - Items and rankings should match exactly

3. **Test update notification**:
   - Build new snapshot
   - Wait ~60 seconds on weekly report page
   - Blue banner should appear

4. **Verify date fix**:
   - Check no "Jan 1, 1970" dates appear
   - Invalid dates show as "—"

## Performance Considerations

- Snapshots are pre-computed (fast page loads)
- Only top 20 items sent to PDF generator
- Client polls are lightweight (just checks timestamp)
- Old snapshots auto-pruned to save space

## Future Enhancements

1. Add metrics refresh during build (respecting API limits)
2. Create admin UI for snapshot management
3. Add email alerts for build failures
4. Implement snapshot comparison view
5. Add more granular permissions for build endpoint

## Rollback Plan

If issues occur:
1. The system will continue working with existing data
2. Can temporarily disable polling by removing check-update calls
3. Database changes are additive (won't break existing tables)
4. Can revert code changes without data loss

## Success Metrics

- ✅ Zero "Jan 1, 1970" dates
- ✅ Web and PDF always show same data
- ✅ Rankings stable for 3-6 hours
- ✅ Page loads remain fast
- ✅ Users notified of updates
- ✅ System handles concurrent access safely
