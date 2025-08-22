# Weekly Report & Home Page Regression Fix Summary

## ✅ Issues Fixed

### 1. **Home Page Shows No Stories**
- **Cause**: Overly strict date filtering (`date = todayBangkok`) with no data for exactly today
- **Fix**: Added fallback to show recent 24h stories if no data for today
- **File**: `frontend/src/lib/data/homeData.ts`

### 2. **Weekly Report Table Not Found**
- **Cause**: `weekly_report_snapshots` table missing from Supabase schema cache
- **Fix**: Added graceful error handling and provided SQL migration script
- **File**: `frontend/src/lib/data/weeklySnapshot.ts`
- **Migration**: `scripts/sql/create_weekly_snapshots_table.sql`

### 3. **CLI Build Fails with `server-only` Error**
- **Cause**: Node.js scripts importing Next.js server-only modules
- **Fix**: Created runtime-agnostic core module that works in both environments
- **Files**: 
  - `frontend/src/lib/snapshots/builderCore.ts` (new)
  - `frontend/src/lib/data/snapshotBuilder.ts` (updated to re-export)
  - `frontend/scripts/buildWeeklySnapshot.ts` (updated import)

## 📁 Files Changed

### New Files
1. `frontend/src/lib/snapshots/builderCore.ts` - Runtime-agnostic snapshot builder
2. `frontend/src/app/api/health/route.ts` - Health check endpoint
3. `frontend/scripts/testSnapshotSystem.ts` - Integration test script
4. `scripts/sql/create_weekly_snapshots_table.sql` - Table creation SQL

### Modified Files
1. `frontend/src/lib/data/snapshotBuilder.ts` - Now re-exports from core
2. `frontend/scripts/buildWeeklySnapshot.ts` - Imports from core
3. `frontend/src/lib/data/weeklySnapshot.ts` - Added table existence check
4. `frontend/src/lib/data/homeData.ts` - Added flexible date filtering
5. `frontend/package.json` - Added snapshot scripts

## 🚀 How to Deploy

### 1. Create Database Table (if not exists)
```sql
-- Run in Supabase SQL editor
-- File: scripts/sql/create_weekly_snapshots_table.sql
```

### 2. Test the System
```bash
# Test snapshot builder (dry run)
npm run snapshot:build:dry

# Run integration tests
npm run snapshot:test

# Check health endpoint
curl http://localhost:3000/api/health
```

### 3. Build a Production Snapshot
```bash
# Ensure environment variables are set
export SUPABASE_URL=your_url
export SUPABASE_SERVICE_ROLE_KEY=your_key

# Build snapshot
npm run snapshot:build
```

### 4. Set Up Cron Job (Render example)
```bash
# Every 3 hours
0 */3 * * * cd /app && npm run snapshot:build
```

## 🔍 Diagnostics

### Health Check Endpoint
```bash
GET /api/health
```
Returns:
- Database connectivity status
- Table counts (news_trends, weekly_report_snapshots)
- Latest snapshot info
- Server timezone info

### Weekly Diagnostics
```bash
GET /api/weekly/diagnostics
```
Returns:
- Latest snapshot details
- Top 3 items
- Diff with previous snapshot

## ✅ Acceptance Criteria Met

1. **Home lists recent stories again** ✅
   - Shows today's data if available
   - Falls back to last 24h if no data for today
   - Proper timezone handling (Asia/Bangkok)

2. **Weekly Report loads from published snapshots** ✅
   - Graceful error handling for missing table
   - Shows instructive error message
   - PDF uses same snapshot data

3. **CLI snapshot builder runs without errors** ✅
   - No more `server-only` import errors
   - Works with `tsx` command
   - Suitable for cron jobs

4. **No changes to .env files** ✅
   - All fixes are code-based
   - Uses existing environment variables

5. **Diagnostics and tests added** ✅
   - Health check endpoint
   - Integration test script
   - Comprehensive logging

## 🔧 Minimal Changes

All changes were surgical and focused:
- No breaking changes to existing APIs
- Backward compatible
- Well-commented code
- Idempotent operations

## 📝 Follow-up Actions

1. Run the SQL migration to create the snapshots table
2. Build initial snapshots using `npm run snapshot:build`
3. Set up cron job for regular rebuilds (every 3-6 hours)
4. Monitor health endpoint for system status
