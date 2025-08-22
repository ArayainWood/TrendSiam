# Weekly Snapshot Pipeline - Developer Notes

## Overview

The Weekly Report page displays aggregated trending news data from the past 7 days using a snapshot-based architecture. This ensures consistent data display and prevents real-time query performance issues.

## Architecture

### Data Flow
```
1. Builder Script → 2. Supabase DB → 3. Weekly Report Page
   ↓                    ↓                  ↓
   Collects data       Stores snapshot    Displays data
   from news_trends    with status        with no caching
```

### Key Components

1. **Builder Script** (`scripts/buildWeeklySnapshot.ts`)
   - Queries last 7 days of data from `news_trends`
   - Creates snapshot with items, metadata, and date ranges
   - Can save as draft or published based on `--publish` flag

2. **Repository Layer** (`lib/weekly/weeklyRepo.ts`)
   - Centralized data access with validation
   - Fallback logic: published → draft → error
   - Consistent counting and coverage calculations

3. **Data Fetcher** (`lib/data/weeklySnapshot.ts`)
   - UI-focused data transformation
   - Uses repository for robust data access
   - Formats data for display components

4. **Weekly Report Page** (`app/weekly-report/page.tsx`)
   - Force dynamic rendering (`export const dynamic = 'force-dynamic'`)
   - No caching (`export const revalidate = 0`)
   - Always shows latest snapshot data

## Building Snapshots

### Commands

```bash
# Build snapshot as draft (default)
npm run snapshot:build

# Build and publish immediately
npm run snapshot:build:publish

# Dry run (no database writes)
npm run snapshot:build:dry

# Publish existing draft snapshot
npm run snapshot:publish -- <snapshot-id>
```

### Workflow

1. **Draft First (Recommended)**
   ```bash
   # Build as draft
   npm run snapshot:build
   # Output: Snapshot ID: abc123... (draft)
   
   # Review via diagnostics
   curl http://localhost:3000/api/weekly/diagnostics
   
   # Publish when ready
   npm run snapshot:publish -- abc123
   ```

2. **Direct Publish**
   ```bash
   # Build and publish in one step
   npm run snapshot:build:publish
   ```

## Diagnostics

### Endpoint: `/api/weekly/diagnostics`

Returns detailed snapshot information:
- Latest published snapshot details
- Top 3 items preview
- Comparison with previous snapshot
- PDF rendering diagnostics
- System statistics

```bash
# Local testing
curl http://localhost:3000/api/weekly/diagnostics | jq .

# Production (requires authentication)
curl https://your-domain.com/api/weekly/diagnostics \
  -H "Authorization: Bearer YOUR_TOKEN" | jq .
```

### Key Metrics
- `latest.item_count` - Total stories in snapshot
- `latest.meta.totalItems` - Should match item_count
- `diff.newItems` - New items vs previous snapshot
- `stats.building_snapshots` - Should be 0 (no stuck builds)

## Revalidation

### Manual Revalidation

Although the weekly report page uses `dynamic = 'force-dynamic'`, you can trigger explicit revalidation:

```bash
# Set REVALIDATE_SECRET in your .env
REVALIDATE_SECRET=your-secret-here

# Trigger revalidation via curl
curl -X POST http://localhost:3000/api/admin/revalidate \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: your-secret-here" \
  -d '{"path": "/weekly-report"}'

# Or via GET (for testing)
curl "http://localhost:3000/api/admin/revalidate?secret=your-secret-here&path=/weekly-report"
```

### Automated Revalidation

Add to your publish script:

```bash
# After publishing snapshot
npm run snapshot:publish -- abc123

# Then revalidate
curl -X POST $APP_URL/api/admin/revalidate \
  -H "x-revalidate-secret: $REVALIDATE_SECRET" \
  -d '{"path": "/weekly-report"}'
```

## Troubleshooting

### Issue: Page shows old data after building snapshot

1. **Check snapshot status**
   ```bash
   curl http://localhost:3000/api/weekly/diagnostics | jq '.latest'
   ```

2. **Verify it was published**
   - Look for `status: 'published'` not `'draft'`
   - If draft, run: `npm run snapshot:publish -- <snapshot-id>`

3. **Force page refresh**
   - The page has `dynamic = 'force-dynamic'` so caching shouldn't occur
   - Try hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Check browser DevTools Network tab for cached responses

### Issue: Total Stories count wrong

1. **Check data source**
   - Count comes from `snapshot.items.length`
   - Repository has centralized `countTotalStories()` function
   - Fallback to `meta.totalItems` if items array empty

2. **Verify via diagnostics**
   ```bash
   curl http://localhost:3000/api/weekly/diagnostics | \
     jq '.latest | {id: .snapshot_id, items: .item_count, meta: .meta.totalItems}'
   ```

### Issue: Builder fails

1. **Check environment**
   ```bash
   npm run snapshot:check
   # Should show: URL true ROLE true
   ```

2. **Check for stuck builds**
   ```bash
   # In Supabase SQL Editor:
   SELECT snapshot_id, status, created_at 
   FROM weekly_report_snapshots 
   WHERE status = 'building' 
   ORDER BY created_at DESC;
   
   # Clean up if needed:
   DELETE FROM weekly_report_snapshots WHERE status = 'building';
   ```

3. **Minimum items threshold**
   - Builder requires at least 5 items
   - Check if `news_trends` has recent data

## Security Notes

- **Service role key** only used in:
  - CLI scripts (builder, publisher)
  - Server-side API routes
  - Never exposed to client

- **Diagnostics endpoint** is read-only
  - No sensitive data exposed
  - IDs and counts only

- **Publishing requires** service role
  - Only through CLI script
  - No client-side publish capability

## Database Schema

```sql
-- weekly_report_snapshots table
snapshot_id: uuid (primary key)
status: text ('draft', 'building', 'published', 'failed')
built_at: timestamp (when snapshot was built)
created_at: timestamp (when record created)
range_start: timestamp (data range start)
range_end: timestamp (data range end)
items: jsonb (array of snapshot items)
meta: jsonb (metadata object)
algo_version: text
data_version: text
```

## Best Practices

1. **Always build as draft first** in production
2. **Review diagnostics** before publishing
3. **Monitor build duration** (in meta.buildDuration)
4. **Keep snapshots for 28 days** (auto-pruned)
5. **Use UTC timestamps** throughout pipeline

## Rollback Procedure

If a bad snapshot is published:

1. **Find previous good snapshot**
   ```sql
   SELECT snapshot_id, built_at, meta->>'totalItems' as items
   FROM weekly_report_snapshots 
   WHERE status = 'published'
   ORDER BY built_at DESC 
   LIMIT 5;
   ```

2. **Unpublish bad snapshot**
   ```sql
   UPDATE weekly_report_snapshots 
   SET status = 'failed' 
   WHERE snapshot_id = 'bad-snapshot-id';
   ```

3. **Re-publish good snapshot**
   ```sql
   UPDATE weekly_report_snapshots 
   SET status = 'published', built_at = NOW() 
   WHERE snapshot_id = 'good-snapshot-id';
   ```

## Monitoring

Watch for:
- Build failures in logs
- Snapshot count dropping to 0
- Average score dramatic changes
- Build duration spikes
- Draft snapshots not being published

## Future Improvements

- [ ] Automated publishing after review period
- [ ] Snapshot comparison UI
- [ ] Build status webhooks
- [ ] Incremental snapshot updates
- [ ] A/B testing different algorithms

## Related Documentation

- [DEV_NOTES_WEEKLY.md](./DEV_NOTES_WEEKLY.md) - Troubleshooting "No snapshots available" errors and selection logic
