# Home View Zero Rows Fix Summary

## Problem
After fixing the "permission denied for table system_meta" error, the home page started showing zero rows. The issue was that the `public_v_home_news` view had dependencies on `public_v_system_meta` that could eliminate all rows when the meta table was empty or inaccessible.

## Root Cause
1. The view used subqueries to `public_v_system_meta` in CTEs that could fail
2. Complex joins with stories and snapshots tables that might not have matching data
3. Filtering logic based on snapshot dates that could exclude all rows

## Solution
Created a new simplified view (`2025-09-26_fix_public_v_home_news_rows.sql`) that:

1. **Removes all system_meta dependencies** - Uses hardcoded defaults instead
2. **Uses LEFT JOINs only** - Ensures news_trends rows are never eliminated
3. **Simplifies filtering** - No complex date-based filtering in the view
4. **Matches exact column names** - All 26 columns expected by frontend

## Key Changes

### View Structure
```sql
-- Old approach (problematic)
WITH cfg AS (
  SELECT ... FROM public.public_v_system_meta ...  -- Could fail or return no rows
)

-- New approach (safe)
WITH config_defaults AS (
  SELECT 
    20 AS home_limit,
    3 AS top3_max
    -- Hardcoded values, no dependencies
)
```

### Join Strategy
- Changed from complex multi-table joins to simple LEFT JOINs
- Base query always returns all news_trends rows with title
- Optional data (snapshots, stories) added via LEFT JOIN

### Column Mapping
- Ensured all 26 columns are present in exact order
- Added safe type conversions for all numeric fields
- Proper NULL handling for optional fields

## Files Created/Modified

1. **`2025-09-26_fix_public_v_home_news_rows.sql`**
   - New view definition without meta dependencies
   - Definer semantics and proper grants

2. **`2025-09-26_verify_home_columns_and_grants.sql`**
   - Comprehensive verification script
   - Checks columns, grants, and data

3. **`2025-09-26_debug_home_view.sql`**
   - Debug queries to diagnose issues
   - Helps identify where data might be missing

## Testing Steps

1. Apply SQL migrations in order:
   ```sql
   -- Run in Supabase SQL Editor
   1. 2025-09-26_fix_public_v_home_news_rows.sql
   2. 2025-09-26_verify_home_columns_and_grants.sql
   ```

2. Run debug script to check data:
   ```sql
   -- Run to see where data exists
   2025-09-26_debug_home_view.sql
   ```

3. Test endpoints:
   ```bash
   curl -s http://localhost:3000/api/home/diagnostics | jq
   curl -s http://localhost:3000/api/home | jq '.data | length'
   ```

## Expected Results
- View should return rows if news_trends table has data
- No "permission denied" errors
- All 26 columns present in correct order
- Home page displays trending stories

## Troubleshooting
If still seeing zero rows:
1. Check if `news_trends` table has data: `SELECT COUNT(*) FROM news_trends WHERE title IS NOT NULL`
2. Run the debug script to see data counts
3. Ensure the data pipeline has been run recently
4. Check if there are any additional filters in the API layer
