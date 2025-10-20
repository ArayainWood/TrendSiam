# SCHEMA VERIFICATION REPORT

**Generated:** 2025-10-20  
**Phase:** 1 - Snapshot Data Contract

## Current Schema Status

### Views Used by PDF System

1. **public_v_weekly_snapshots** (PRIMARY)
   - Purpose: Weekly report snapshot data
   - Fields: snapshot_id, status, built_at, created_at, range_start, range_end, items, meta
   - Status: ✓ In use by current PDF system

2. **public_v_weekly_stats** (SECONDARY)
   - Purpose: Weekly statistics
   - Fields: week, news_count, total_stories, stories_with_images, avg_popularity_score, last_updated
   - Status: ✓ Available but not used by PDF

### Data Contract for PDF

The PDF system uses these fields from SnapshotItem:
```typescript
interface SnapshotItem {
  // Required
  id: string;
  rank: number;
  title: string;
  
  // Optional but used
  platform?: string;
  channel?: string;
  category?: string;
  published_at?: string;
  popularity_score?: number | string;
  popularity_score_precise?: number | string;
  
  // Available but not currently displayed
  summary?: string;
  summary_en?: string;
  image_url?: string;
  view_count?: string | number;
  like_count?: string | number;
}
```

## Migration Requirements

### No Schema Changes Needed ✓

The current schema fully supports the Chromium migration:
1. All required fields are present
2. Views are Plan-B compliant (read-only)
3. Data comes from public views, not base tables
4. No service-role key exposure

### Health Checks Implemented

1. **API Endpoint**: `/api/health-schema`
   - Verifies view existence
   - Checks column availability
   - Returns health status

2. **CLI Script**: `scripts/check-home-schema.mjs`
   - Command-line schema verification
   - Exit code for CI/CD integration
   - Detailed column analysis

### Data Flow Verification

```
Supabase (public_v_weekly_snapshots)
    ↓
fetchWeeklySnapshot() 
    ↓
SnapshotItem[] (top 20 items)
    ↓
Current: @react-pdf/renderer
Future:  HTML template → Chromium
```

## Recommendations

1. **No migrations needed** - Current schema is sufficient
2. **Keep using public_v_weekly_snapshots** - Already Plan-B compliant
3. **Add optional fields** - Consider displaying summaries in future
4. **Monitor view performance** - Current queries are efficient

## Next Steps

Phase 1 complete. Ready to proceed with:
- Phase 2: Create HTML template
- Phase 3: Implement Chromium engine
- Phase 4: Verification

---

Status: ✅ Schema verified, no changes required
