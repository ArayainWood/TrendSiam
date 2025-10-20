# Snapshot Freshness SQL Migration Fix Summary

Date: 2025-09-23

## Problem Fixed

The original migration referenced a non-existent column `ai.is_active` in the `ai_images` table, causing the SQL migration to fail with:
```
ERROR: 42703: column ai.is_active does not exist
LINE 125: LEFT JOIN ai_images ai ON ai.news_id = fs.id AND ai.is_active = true
```

## Solution Applied

### Primary Approach: LATERAL Join (No Schema Change)

Modified `frontend/db/sql/fixes/2025-09-23_home_view_snapshot_recency.sql` to use a LATERAL join that selects the latest ai_image by `created_at`:

```sql
-- Get AI images using LATERAL join to select latest image
final_with_images AS (
  SELECT
    fs.*,
    ai.image_url AS ai_image_url_alt
  FROM final_selection fs
  LEFT JOIN LATERAL (
    SELECT ai.image_url
    FROM ai_images ai
    WHERE ai.news_id = fs.id
    ORDER BY ai.created_at DESC
    LIMIT 1
  ) ai ON TRUE
)
```

### Performance Index Added

```sql
-- Index for ai_images lookups by news_id and created_at (idempotent)
CREATE INDEX IF NOT EXISTS idx_ai_images_news_created ON ai_images (news_id, created_at DESC);
```

## SQL Migration Run Order

Execute these files in order in the SQL Editor:

1. **`frontend/db/sql/fixes/2025-09-23_home_view_snapshot_recency.sql`**
   - Creates snapshot-based home view
   - Uses LATERAL join for ai_images (no is_active dependency)
   - Maintains 26-column contract
   - Enforces Top-3 image/prompt policy

2. **`frontend/db/sql/fixes/2025-09-23_upsert_home_policy.sql`**
   - Upserts home_freshness_policy metadata
   - Stores column hash for integrity checking
   - Rebuilds public_v_system_meta view

3. **`frontend/db/sql/fixes/2025-09-17_grant_public_v_home_news.sql`** (if not already applied)
   - Ensures proper grants on public views
   - Sets SECURITY INVOKER

## Verification Steps

### 1. Run SQL Verification Script
```bash
psql -f frontend/db/sql/fixes/verify_snapshot_freshness.sql
```

This checks:
- View row counts
- Snapshot data availability
- No duplicate stories
- Top-3 policy enforcement
- System metadata values
- 26-column contract

### 2. Run Node.js Contract Verification
```bash
cd frontend
node scripts/verify-home-contract.mjs
```

### 3. Test APIs
```bash
# Diagnostics endpoint
curl http://localhost:3000/api/home/diagnostics

# Home feed endpoint
curl http://localhost:3000/api/home
```

### 4. Check Frontend
- Home page should render without errors
- Top-3 stories should have images/prompts
- Non-Top-3 stories should NOT have images

## Memory Bank Updates

### `03_frontend_homepage_freshness.mb`
Added section on AI Images Schema & Selection:
- LATERAL join strategy (no is_active dependency)
- COALESCE logic for Top-3 images
- Performance indexing
- Future option for is_active column if needed

### `13_testing_acceptance_criteria.mb`
Added SQL Migration Order & Fixes section:
- Migration file locations
- Run order with fixes applied
- Key fix explanation
- Verification instructions

## Key Principles Applied

1. **Never reference non-existent columns** - Always verify schema before writing SQL
2. **Use LATERAL joins** for selecting latest records when appropriate
3. **Maintain backward compatibility** - Don't break existing functionality
4. **Follow Plan-B security** - Views only, SECURITY INVOKER, proper grants
5. **Preserve contracts** - Keep exact 26-column output
6. **Add indexes for performance** - Use IF NOT EXISTS for idempotency

## Alternative Approach (Not Used)

If `is_active` column is needed in future for content curation, create a separate migration first:

```sql
-- File: 2025-09-23_ai_images_add_is_active.sql
ALTER TABLE ai_images
  ADD COLUMN IF NOT EXISTS is_active boolean;
  
UPDATE ai_images SET is_active = true WHERE is_active IS NULL;
```

Then the view could filter with `AND ai.is_active = true`. However, the LATERAL join approach is preferred as it works without schema changes.
