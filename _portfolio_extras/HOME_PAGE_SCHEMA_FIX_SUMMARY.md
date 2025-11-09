# Home Page Schema Error Fix Summary

## Problem
The Home page was failing with error: "Could not find a relationship between 'news_trends' and 'ai_images' in the schema cache."

## Root Cause
The Home data fetcher (`homeData.ts`) was attempting to join/expand the `ai_images` table using Supabase's nested query syntax, but no foreign key relationship was properly established in the database schema.

## Solution
Removed the `ai_images` join and modified the Home page to use the `ai_image_url` field directly from the `news_trends` table.

## Files Changed

### 1. `frontend/src/lib/data/homeData.ts`
- **Removed**: `ai_images(image_url, prompt)` join from the select query
- **Removed**: Processing logic for joined ai_images data
- **Added**: Comprehensive validation for data integrity
- **Added**: Enhanced error handling with query details logging
- **Result**: Query now only reads from `news_trends` table directly

### 2. `frontend/src/app/page.tsx`
- **Enhanced**: Top Story consistency verification
- **Added**: HOME VERIFY logging for acceptance criteria
- **Result**: Better visibility into data consistency

### 3. `tests/` directory (new)
Created comprehensive test suite:
- `verify_home_query.sql` - Manual DB verification
- `test_home_fetcher.ts` - Fetcher implementation test
- `test_home_topstory_consistency.ts` - UI consistency test
- `test_home_images.ts` - Image handling test
- `README.md` - Test documentation

## Acceptance Criteria Status

✅ **1. Home loads with no schema relationship error**
- Removed all ai_images joins from Home code path

✅ **2. Home shows only today's batch**
- Filters by `date = TODAY` (Asia/Bangkok timezone)
- Limit enforced server-side (default 20)
- Correct ordering: `popularity_score_precise DESC, view_count DESC, published_date DESC, title ASC`

✅ **3. Top Story equals first grid item**
- Verified through consistency checks
- Both use same data array

✅ **4. No ai_images joins in Home code**
- Completely removed from homeData.ts
- Uses ai_image_url field directly

✅ **5. Other pages unchanged**
- Weekly Report still uses weeklyShared.ts
- No modifications to Archive or other pages

✅ **6. Tests created and documented**
- Full test suite in tests/ directory
- Clear instructions in README.md

## Verification

When the Home page loads successfully, check browser console for:
```
[fetchHomeData] ✅ Fetched 20 items for 2025-01-11
HOME VERIFY: items=20, date check=OK, sorted=OK, length check=OK
HOME VERIFY: topStoryMatchesGridFirst=OK
```

## Running Tests

```bash
# Run all tests
cd tests
npx tsx test_home_fetcher.ts && npx tsx test_home_topstory_consistency.ts && npx tsx test_home_images.ts

# Verify in Supabase
# Copy contents of verify_home_query.sql to SQL Editor
```

## Important Notes

1. **Database field**: The database uses `date` not `run_date` for filtering
2. **No migration needed**: Fix works with existing schema
3. **Images**: Home uses `ai_image_url` from news_trends directly
4. **Weekly Report**: Unaffected, still has ai_images join (separate investigation needed)

## Next Steps

If Weekly Report also experiences schema errors:
1. Apply similar fix to remove ai_images join
2. OR apply migration to create proper foreign key relationship
3. OR create a database view that explicitly joins the tables

For now, Home page is fixed and working independently.
