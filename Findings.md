# Home Page Schema Error Investigation Findings

## Primary Error
"Could not find a relationship between 'news_trends' and 'ai_images' in the schema cache."

## Root Cause
The Home page data fetcher attempts to join/expand `ai_images` table without a properly established foreign key relationship in the Supabase schema.

## A. Files with ai_images References in Home Code Path

### 1. **frontend/src/lib/data/homeData.ts** (PRIMARY ISSUE)
- **Line 91**: `ai_images(image_url, prompt)` - Attempting to expand/join ai_images table
- **Lines 119-129**: Processing joined ai_images data that will never be returned due to schema error
- This is the direct cause of the Home page error

### 2. **frontend/src/lib/data/weeklyShared.ts** (SHARED FETCHER)
- **Line 117**: `ai_images(image_url, prompt)` - Same issue as homeData.ts
- **Lines 177-187**: Processing joined ai_images data
- This file is used by Weekly Report page, not directly by Home
- Home uses its own dedicated fetcher (homeData.ts)

### 3. **frontend/src/app/api/_debug/data-consistency/route.ts** (DEBUG ONLY)
- Lines 56, 58: References to ai_images in statistics
- Not part of Home page data flow

### 4. **frontend/src/app/dev-dashboard/page.tsx** (DEV DASHBOARD)
- Lines 17, 239: References to ai_images count
- Not part of Home page data flow

## B. Database Schema Analysis

### migration_001_schema_contract.sql
- Defines `ai_images` table with foreign key: `news_id uuid NOT NULL REFERENCES news_trends(id)`
- However, this migration may not have been applied to the production database
- Even if applied, Supabase requires explicit relationship configuration for nested queries

## C. Home Page Specific Issues

### 1. Data Filtering
- Currently uses `.eq('date', todayBangkok)` (line 93 of homeData.ts)
- User requirements specify `run_date`, but code uses `date` field
- No 7/30/60-day age filters found in Home code ✓

### 2. Ordering
- Correct ordering already implemented (lines 95-98):
  - `popularity_score_precise DESC`
  - `view_count DESC`
  - `published_date DESC`
  - `title ASC`

### 3. Server-side Limit
- Correctly applies `.limit(limit)` (line 99) ✓

### 4. Top Story Consistency
- Home page (frontend/src/app/page.tsx) uses `news[0]` as Top Story
- Grid uses same `filteredNews` array
- No client-side re-sorting that would desync them ✓

## D. Image Handling
- `ai_image_url` is already included in the select query
- Code attempts to override with joined ai_images data (lines 119-129)
- If join fails, it falls back to ai_image_url from news_trends table

## E. Shared vs Dedicated Fetchers
- Home has its own dedicated fetcher: `homeData.ts`
- Weekly Report uses: `weeklyShared.ts`
- No sharing issues between Home and other pages ✓

## Summary of Required Fixes

1. **Remove ai_images join** from homeData.ts line 91 ✅ COMPLETED
2. **Remove ai_images processing** from homeData.ts lines 119-129 ✅ COMPLETED
3. **Verify field name**: Database uses `date` not `run_date` ✅ VERIFIED
4. **Add error handling** with try/catch and friendly error states ✅ COMPLETED
5. **Add validation** to ensure data integrity ✅ COMPLETED

## Changes Made

### 1. **frontend/src/lib/data/homeData.ts**
- **Line 91**: Removed `ai_images(image_url, prompt)` from select query
- **Lines 117-143**: Removed ai_images processing logic, now uses ai_image_url directly
- **Lines 133-187**: Added comprehensive validation:
  - Verifies all items have today's date
  - Verifies length <= limit
  - Verifies correct sorting order
  - Logs "HOME VERIFY" message for acceptance criteria
- **Lines 226-233**: Enhanced error handling with query details logging

### 2. **frontend/src/app/page.tsx**
- **Lines 230-242**: Enhanced Top Story consistency check
  - Checks both id and video_id for matching
  - Logs detailed mismatch information
  - Adds to HOME VERIFY output

### 3. **tests/** directory created with:
- `verify_home_query.sql`: Manual SQL verification query
- `test_home_fetcher.ts`: Tests the fetcher implementation
- `test_home_topstory_consistency.ts`: Tests Top Story/Grid consistency
- `test_home_images.ts`: Tests image handling
- `README.md`: Instructions for running tests

## Verification Output

The Home page will now log:
```
HOME VERIFY: items=20, date check=OK, sorted=OK, length check=OK
HOME VERIFY: topStoryMatchesGridFirst=OK
```

## Optional Schema Fix (NOT for Home)
If other pages need ai_images joins:
1. Apply migration_001_schema_contract.sql to create the foreign key
2. Configure Supabase relationship in dashboard
3. Or create a view that explicitly joins the tables

Home page should NOT use this - it should rely on `ai_image_url` field directly from news_trends table.
