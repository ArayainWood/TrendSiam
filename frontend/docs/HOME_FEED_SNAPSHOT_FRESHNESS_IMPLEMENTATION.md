# Home Feed Snapshot-based Freshness Implementation

Date: 2025-09-23

## Overview

This implementation transforms the TrendSiam home feed from date-based freshness to snapshot-based freshness, ensuring that "still-trending" stories appear regardless of their publish date.

## Changes Made

### 1. Database Layer

**Migration Files:**
- `frontend/db/sql/fixes/2025-09-23_home_view_snapshot_recency.sql` - Main migration
- `frontend/db/sql/fixes/2025-09-23_upsert_home_policy.sql` - Metadata policy
- `frontend/db/sql/fixes/2025-09-23_home_view_snapshot_recency_rollback.sql` - Rollback plan

**Key Changes:**
- View now joins `news_trends` → `stories` → `snapshots` to find latest snapshot per story
- Primary window: Stories with snapshots in last 72 hours
- Fallback window: Stories with snapshots in last 30 days (if primary empty)
- Preserves exact 26-column contract
- Enforces Top-3 images/prompts policy at view layer
- Added performance indexes for snapshot lookups

### 2. API Layer

**Updated Files:**
- `frontend/src/app/api/home/route.ts` - Added Phase 4 completion comment
- `frontend/src/app/api/home/diagnostics/route.ts` - Added freshness policy to metadata

**No Breaking Changes:**
- API continues to use `HOME_COLUMNS.join(',')` - no `select('*')`
- Primary query still orders by `rank ASC`
- Fallback query still orders by `published_at DESC`
- Error handling unchanged
- Response format unchanged

### 3. Verification & Quality

**New Scripts:**
- `frontend/db/sql/checks/home_view_integrity.sql` - SQL integrity checks
- `frontend/scripts/verify-home-contract.mjs` - Node.js contract verification

**Checks Performed:**
- View row count and snapshot availability
- No duplicate IDs
- 26-column contract compliance
- Top-3 policy enforcement
- Data type validation
- System metadata presence

### 4. Documentation

**Updated Memory Banks:**
- `memory-bank/03_frontend_homepage_freshness.mb` - Added snapshot freshness section
- `memory-bank/13_testing_acceptance_criteria.mb` - Added acceptance tests

**Baseline Saved:**
- `frontend/docs/db/baseline_home_view_ddl.sql` - Original view DDL for rollback

## Security Compliance (Plan-B)

✅ All changes follow Plan-B security model:
- Views use `SECURITY INVOKER`
- `GRANT SELECT` to `anon, authenticated`
- Frontend APIs only read from `public_v_*` views
- No direct base table access with anon key
- Service role remains offline-only

## Testing Instructions

### 1. Apply Migrations
```bash
# Apply main migration
psql -h <host> -U <user> -d <database> -f frontend/db/sql/fixes/2025-09-23_home_view_snapshot_recency.sql

# Apply metadata migration
psql -h <host> -U <user> -d <database> -f frontend/db/sql/fixes/2025-09-23_upsert_home_policy.sql
```

### 2. Run Verification Scripts
```bash
# SQL integrity check
psql -h <host> -U <user> -d <database> -f frontend/db/sql/checks/home_view_integrity.sql

# Node.js contract verification
cd frontend
node scripts/verify-home-contract.mjs
```

### 3. Test APIs
```bash
# Test diagnostics
curl http://localhost:3000/api/home/diagnostics

# Test home feed
curl http://localhost:3000/api/home
```

### 4. Verify UI
- Home page should render normally
- Top-3 stories should have images/prompts
- Non-Top-3 stories should NOT have images
- No TypeScript/runtime errors

## Rollback Instructions

If issues arise, rollback is available:
```bash
psql -h <host> -U <user> -d <database> -f frontend/db/sql/fixes/2025-09-23_home_view_snapshot_recency_rollback.sql
```

## Acceptance Criteria Met

✅ Home feed relies on latest snapshots per story (still-trending logic)  
✅ Preserves 26-column contract unchanged  
✅ Keeps scoring & ranking logic unchanged  
✅ Enforces Top-3 images/prompts policy robustly  
✅ Eliminates permission errors (views-only)  
✅ Adds diagnostics and regression guards  
✅ Updates memory bank documentation  
✅ Zero breaking changes to existing functionality  

## Notes

- If `public_v_home_news` returns 0 rows after migration, check if snapshots table has data
- The view legally returns 0 rows if no snapshots exist in the time windows
- Performance indexes are created idempotently (safe to re-run)
- Column hash is stored in metadata for contract integrity checking
