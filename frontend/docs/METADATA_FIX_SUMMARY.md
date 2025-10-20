# Metadata Upsert Fix Summary

Date: 2025-09-23

## Problem Identified

The `system_meta` table schema only has 3 columns:
- `key` (text)
- `value` (text) 
- `updated_at` (timestamptz)

Our migration was trying to insert into non-existent columns:
- ❌ `description` 
- ❌ `created_at`

This caused the SQL to fail with:
```
ERROR: 42703: column "description" of relation "system_meta" does not exist
```

## Solution Applied

### 1. Fixed `2025-09-23_upsert_home_policy.sql`

Updated all INSERT statements to use only existing columns:

```sql
-- Before (FAILED)
INSERT INTO system_meta (key, value, description, created_at, updated_at)
VALUES ('home_freshness_policy', '...', '...', NOW(), NOW())

-- After (WORKS)
INSERT INTO system_meta (key, value, updated_at)
VALUES ('home_freshness_policy', 'latest_snapshot:72h_primary|30d_fallback', NOW())
```

### 2. Updated Grant File

Made `2025-09-17_grant_public_v_home_news.sql` more robust:
- Added existence checks for optional views
- Made it idempotent and safe to re-run
- Clear documentation about run order

### 3. Created Verification Script

New file: `verify_metadata_fix.sql` provides comprehensive checks:
- Home view functionality
- Duplicate detection
- Metadata values
- Permissions verification
- 26-column contract
- Top-3 policy enforcement

## SQL Execution Order

1. ✅ `2025-09-23_home_view_snapshot_recency.sql` (already applied)
2. 🔧 `2025-09-23_upsert_home_policy.sql` (apply fixed version)
3. 🔧 `2025-09-17_grant_public_v_home_news.sql` (re-apply for safety)

## Key Learnings

1. **Always verify table schema** before writing SQL migrations
2. **Never assume columns exist** - check information_schema first
3. **Test migrations locally** before running in production
4. **Keep migrations idempotent** - safe to re-run

## Memory Bank Updates

Updated both:
- `03_frontend_homepage_freshness.mb` - Added System Metadata Schema section
- `13_testing_acceptance_criteria.mb` - Updated SQL run order with fixes

## Verification

After running all migrations, execute:
```bash
psql -f frontend/db/sql/fixes/verify_metadata_fix.sql
```

All checks should pass with ✅ status.

## API Testing

After migrations complete:
```bash
# Test diagnostics endpoint
curl http://localhost:3000/api/home/diagnostics

# Should return home_freshness_policy in meta object
# No permission errors should occur
```
