# Weekly Report Snapshot System

## Overview

The Weekly Report now uses a robust Rolling 7-day Snapshot system that:
- Computes rankings from the last 7 days (by ingested_at/created_at)
- Publishes stable snapshots that don't change between page loads
- Ensures the web page and PDF always show identical data
- Updates every 3-6 hours via scheduled rebuilds
- Shows "As of" timestamp and notifies users of newer snapshots

## Key Features

### 1. Stable Snapshots
- Data is frozen at build time and stored in `weekly_report_snapshots` table
- Each snapshot has a unique ID and timestamp
- Rankings remain consistent until the next snapshot is published

### 2. Date Handling  
- **Filter Window**: Uses `created_at` (when first seen by TrendSiam) for the 7-day window
- **Display Dates**: Shows `published_at` with fallback to `created_at` 
- **1970 Bug Fix**: Centralized date parsing with proper validation and "—" fallback

### 3. Synchronized Web & PDF
- Weekly page passes `snapshot_id` to PDF generator
- Both use the exact same data from the snapshot
- PDF filename includes snapshot ID for cache-busting

### 4. Update Notifications
- Client polls every 60 seconds for newer snapshots
- Shows banner when new data is available
- User controls when to refresh (no auto-switching)

## Database Schema

```sql
-- Table: weekly_report_snapshots
snapshot_id         UUID (Primary Key)
status              TEXT ('building' | 'published')  
range_start         TIMESTAMPTZ
range_end           TIMESTAMPTZ
built_at            TIMESTAMPTZ
algo_version        TEXT
data_version        TEXT
items               JSONB[] (array of ranked items)
meta                JSONB (build metadata)
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

## API Endpoints

### GET /api/weekly
Returns latest snapshot data (or specific snapshot by ID)
- Query params: `?snapshot=<id>`
- Headers: `X-TS-Snapshot-ID`

### GET /api/weekly/pdf
Generates PDF from snapshot data
- Query params: `?snapshot=<id>` (uses same as page)
- Filename includes snapshot ID

### GET /api/weekly/check-update
Checks if newer snapshot exists
- Query params: `?current=<id>`
- Returns: `{ hasNewer: boolean }`

### GET /api/weekly/diagnostics
Read-only diagnostics and statistics
- Shows latest snapshot info
- Top 3 items with scores
- Diff vs previous snapshot

### POST /api/weekly/build-snapshot
Triggers a new snapshot build (protected)
- Header: `X-Build-Token: <token>`
- Body: `{ dryRun: boolean }`

## Building Snapshots

### Manual Build
```bash
# Dry run (test without saving)
npx tsx scripts/buildWeeklySnapshot.ts --dry-run

# Production build
npx tsx scripts/buildWeeklySnapshot.ts
```

### Via API
```bash
# With configured token
curl -X POST https://your-site.com/api/weekly/build-snapshot \
  -H "X-Build-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}'

# Local development (no token required)
curl -X POST http://localhost:3000/api/weekly/build-snapshot \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}'
```

### Scheduled Builds (Render Cron)
Add to your Render cron jobs:
```
# Every 3 hours
0 */3 * * * cd /opt/render/project/src/frontend && npx tsx scripts/buildWeeklySnapshot.ts
```

## Environment Variables

```env
# Required for snapshot system
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Optional: Protection for build endpoint
SNAPSHOT_BUILD_TOKEN=your-secret-token
```

## Safety Features

1. **Concurrency Protection**: Only one build can run at a time
2. **Minimum Threshold**: Won't publish if < 5 items found
3. **Idempotent Operations**: Safe to re-run migrations and builds
4. **Atomic Publishing**: Snapshots marked "published" only when complete
5. **Retention Policy**: Auto-prunes snapshots older than 28 days

## Monitoring

### Check System Health
```bash
# View diagnostics
curl https://your-site.com/api/weekly/diagnostics

# Check latest snapshot
psql -c "SELECT snapshot_id, status, built_at, 
         jsonb_array_length(items) as item_count 
         FROM weekly_report_snapshots 
         ORDER BY built_at DESC LIMIT 5;"
```

### Common Issues

1. **No snapshots found**: Run initial build with `npx tsx scripts/buildWeeklySnapshot.ts`
2. **PDF doesn't match page**: Ensure PDF URL includes `?snapshot=<id>` parameter
3. **1970 dates showing**: Check `published_at` field quality in source data
4. **Build fails**: Check minimum item threshold and date range filters

## Migration Safety

The migration script is idempotent and safe to run multiple times:
```bash
psql < scripts/sql/create_weekly_snapshots_table.sql
```

## Future Improvements

- [ ] Add metrics refresh during snapshot build (with API limits)
- [ ] Implement snapshot comparison/diff view
- [ ] Add email notifications for build failures
- [ ] Create admin UI for snapshot management
