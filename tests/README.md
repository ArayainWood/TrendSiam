# News Pages Verification Tests

This directory contains verification tests for all news-related pages (Home, Weekly Report, etc.) to ensure they work correctly without schema relationship errors.

## Test Files

### 1. `verify_home_query.sql`
A read-only SQL query that simulates the Home page data fetch. Use this to manually verify data in Supabase.

**How to run:**
1. Open Supabase SQL Editor
2. Copy and paste the query
3. Execute to see today's data with proper ordering
4. Verify the results match expectations

### 2. `test_home_fetcher.ts`
Unit test for the Home data fetcher that verifies:
- No `ai_images` join references (prevents schema errors)
- Date filtering is present
- Correct ordering is applied
- Limit is enforced

**How to run:**
```bash
cd tests
npx tsx test_home_fetcher.ts
```

### 3. `test_home_topstory_consistency.ts`
Tests that the Top Story (hero section) always matches the first item in the grid.

**How to run:**
```bash
cd tests
npx tsx test_home_topstory_consistency.ts
```

### 4. `test_home_images.ts`
Verifies image handling works correctly:
- Top 3 items can display AI images
- Missing images fall back to placeholders
- No errors thrown for null images

**How to run:**
```bash
cd tests
npx tsx test_home_images.ts
```

### 5. `verify_weekly_query.sql`
A read-only SQL query that simulates the Weekly Report data fetch.

**How to run:**
1. Open Supabase SQL Editor
2. Copy and paste the query
3. Execute to see last 7 days of data
4. Verify the results match expectations

### 6. `test_common_images.tsx`
Tests image handling patterns across all pages:
- Verifies no ai_images joins exist
- Confirms direct ai_image_url field usage
- Tests null-safe image access

**How to run:**
```bash
cd tests
npx tsx test_common_images.tsx
```

### 7. `test_no_ai_images_joins.ts`
Scans all client code to ensure no ai_images table joins exist.

**How to run:**
```bash
cd tests
npx tsx test_no_ai_images_joins.ts
```

## Running All Tests

To run all TypeScript tests at once:
```bash
cd tests
# Core tests
npx tsx test_home_fetcher.ts && npx tsx test_home_topstory_consistency.ts && npx tsx test_home_images.ts

# Additional tests
npx tsx test_common_images.tsx && npx tsx test_no_ai_images_joins.ts
```

## Expected Results

All tests should show:
- ✅ Green checkmarks for passing tests
- No ❌ red X marks
- Final "ALL TESTS PASSED" message

## Manual Verification

After deploying the fixes, check the browser console for:

### Home Page
```
HOME VERIFY: {
  items: 20,
  sorted: 'OK',
  dateCheck: 'OK',
  topStoryId: 'vid123',
  top3WithImages: ['vid123', 'vid124', 'vid125']
}
```

### Weekly Report Page
The weekly report should load without errors and display last 7 days of data.

### Error Handling
If no data is available, pages should show friendly empty states instead of crashing.

This confirms all news pages are working correctly with the fixes applied.
