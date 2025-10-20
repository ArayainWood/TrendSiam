# Type-Safe Hotfix Report: Home Feed (2025-09-27)

## Executive Summary
Fixed PostgreSQL 42883 error (text >= numeric comparison) and hardened all type casting in the home view while maintaining the exact 26-column contract.

## Root Cause Analysis

### Error 42883: "operator does not exist: text >= numeric"
- **Cause**: The `growth_rate` columns in both `snapshots` and `news_trends` tables are TEXT type
- **Problem Location**: Lines 137-141 in the original SQL where `growth_rate_value >= 0.20` was comparing TEXT to NUMERIC
- **Issue**: The alias `growth_rate_value::numeric` created in line 135 isn't visible to the CASE expression in the same SELECT

## Changes Made

### 1. Safe Numeric Casting in CTE
Added proper type conversion in the `joined_data` CTE:
```sql
-- Safe numeric cast for growth_rate (handles %, spaces, bad data)
case
  when coalesce(snap.growth_rate, nt.growth_rate) is null then null
  when coalesce(snap.growth_rate, nt.growth_rate) ~ '^-?\d+(\.\d+)?%?$' then
    replace(trim(coalesce(snap.growth_rate, nt.growth_rate)), '%', '')::numeric
  else null
end as growth_rate_num
```

### 2. Type-Hardened Fields
- `views`, `likes`, `comments`: Safe BIGINT casting with regex validation
- `popularity_score`: Explicit NUMERIC casting
- `rank`: INTEGER casting
- `growth_rate_value`: Now properly NUMERIC from `growth_rate_num`
- `ai_opinion`: TEXT casting
- `score_details`: JSONB casting
- `platform_mentions`: INTEGER casting

### 3. Growth Rate Label Fix
Now computes from the numeric `growth_rate_num` field:
```sql
case
  when growth_rate_num is null then 'Not enough data'
  when growth_rate_num >= 0.20 then 'Rising fast'
  when growth_rate_num >= 0.00 then 'Rising'
  when growth_rate_num <= -0.20 then 'Falling fast'
  else 'Falling'
end::text as growth_rate_label
```

### 4. Maintained Features
- Rename-swap strategy for all 3 views
- source_url synthesis for YouTube videos
- Top-3 image/prompt policy
- Plan-B security (anon SELECT only)
- 26-column contract preserved exactly

## SQL Execution Instructions

1. **Run main fix**:
   ```sql
   -- In Supabase SQL Editor
   frontend/db/sql/fixes/2025-09-27_fix_home_views_type_safe.sql
   ```

2. **Run sanity checks**:
   ```sql
   -- Verify the fix
   frontend/db/sql/fixes/2025-09-27_sanity_checks_type_safe.sql
   ```

## Expected Sanity Check Results

1. **Column count**: 26 exactly
2. **Column order**: All 26 columns in correct order with PASS status
3. **NULL source_url count**: 0 for YouTube videos
4. **Type validations**:
   - growth_rate_value: numeric
   - popularity_score: numeric
   - rank: integer
   - views/likes/comments: bigint
5. **Growth rate labels**: Correctly computed from numeric values

## Verification Steps

### Local Testing
```bash
# TypeScript check
npm run type-check  # PASSED ✓

# Start dev server
npm run dev

# Test diagnostics
node test-diagnostics-type-safe.js
```

### Expected Diagnostics Output
```json
{
  "success": true,
  "fetchedCount": [> 0],
  "top3Count": [>= 1],
  "columnsFromView": [exactly 26 columns in order],
  "error": null
}
```

## Acceptance Criteria Status

| Criterion | Status | Evidence |
|-----------|--------|----------|
| 42883 error resolved | PENDING | Run SQL to verify |
| growth_rate_value is numeric | PENDING | Check sanity query #5 |
| growth_rate_label computed correctly | PENDING | Check sanity query #5 |
| EN summaries visible | PENDING | Check sample data |
| Analytics fields restored | PENDING | Check ai_opinion, score_details |
| Plan-B security maintained | PASS | Only public_v_* with anon grants |
| TypeScript checks pass | PASS | npm run type-check succeeded |
| No regressions | PENDING | Manual UI verification needed |

## Data Quality Notes
The safe casting approach means:
- Invalid growth_rate strings → NULL (won't throw errors)
- Malformed view/like/comment counts → NULL
- This prevents runtime errors but may result in some NULL values where data is malformed

## Rollback Plan
If issues arise:
```sql
-- Restore previous views
alter view public.public_v_home_news rename to public_v_home_news_broken;
alter view public.public_v_home_news_old_20250927 rename to public_v_home_news;
-- Repeat for other views if needed
```

## Cleanup (After Verification)
```sql
-- Only run after confirming success
drop view if exists public.public_v_home_news_old_20250927;
drop view if exists public.public_v_latest_snapshots_old_20250927;
drop view if exists public.public_v_ai_images_latest_old_20250927;
```

## Next Steps
1. Execute SQL fix in Supabase
2. Run sanity checks and paste results
3. Test diagnostics endpoint
4. Verify UI (homepage cards, story modal with EN + analytics)
5. Clean up old views after confirmation

---
Report generated: 2025-09-27
No git operations performed as instructed.
