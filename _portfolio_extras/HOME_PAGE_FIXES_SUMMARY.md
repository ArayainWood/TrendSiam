# Home Page Sorting/Filtering Fixes Summary

## Changes Made

### 1. Created Home-Specific Data Fetcher
**File**: `frontend/src/lib/data/homeData.ts` (new)
- Created dedicated fetcher for Home page that queries **only today's data** in Asia/Bangkok timezone
- Filters by `date = TODAY` (not 7/30/60-day windows)
- Excludes NULL `popularity_score_precise` values for deterministic ordering
- Implements correct ordering: `popularity_score_precise DESC, view_count DESC, published_at DESC, title ASC`
- No longer uses `weekly_public_view` or any windowed views
- Direct query to `news_trends` table with proper filtering

### 2. Updated Home API Route
**File**: `frontend/src/app/api/home/route.ts`
- Changed from v4 to v5 API
- Now uses `fetchHomeData()` instead of `fetchWeeklyCanon()`
- No longer shares data logic with Weekly Report
- Adds date information to response headers

### 3. Enhanced Verification Logging
**File**: `frontend/src/app/page.tsx`
- Added comprehensive verification logging in `NewsGrid` component
- Verifies all items are from today's batch
- Verifies correct ordering with detailed output
- Verifies Top Story matches first grid item
- Updated debug panel to show "TODAY only" instead of "latest date"
- Updated LIVE indicator to show "Today's batch only (Asia/Bangkok)"

### 4. Test Script
**File**: `frontend/test-home-api.js` (new)
- Simple Node.js script to test the Home API directly
- Verifies response structure and date filtering

## Key Improvements

1. **Date Filtering**: Home page now shows **only today's batch** in Asia/Bangkok timezone
2. **Correct Ordering**: Implements exact ordering requirements with 4-level sort
3. **No Age Windows**: Removed all 7/30/60-day upload-age filters
4. **Direct DB Query**: No longer uses `weekly_public_view`, queries `news_trends` directly
5. **Data Consistency**: Top Story and grid use the same ordered dataset
6. **Server-Side Sorting**: All ordering happens in Postgres, not JavaScript

## Verification

When running the app, check the browser console for verification output:

```
🏠 HOMEPAGE VERIFICATION - Today's batch only:
📊 Total items: 20
📈 Query: WHERE date = TODAY(Asia/Bangkok) ORDER BY popularity_score_precise DESC, view_count DESC, published_at DESC, title ASC LIMIT 20
🎯 Data source: Today's batch only (no 7/30/60-day filters)
📅 Unique dates in dataset: 2025-01-11
✅ VERIFIED: All 20 items are from today's batch
✅ VERIFIED: Top Story matches first grid item
🏆 Top 5 Items (verify ordering):
   #1: Score=95.123, Views=123456, Published=2025-01-11T10:30:00Z, Title="Example title..."
   ...
```

## No Changes Made To

- Archive page
- Weekly Report page  
- Environment variables (.env/env.local)
- UI layout or features
- Image handling logic

## How to Run

The changes will take effect immediately when the Next.js app is running. No database migrations or environment changes are needed.

To test the API directly:
```bash
cd frontend
node test-home-api.js
```
