# Home Page Fix - Type Validation Issue

## Root Cause
The home page was showing "No Trending Stories Right Now" because:
1. The database view `news_public_v` was returning numeric values for `view_count`, `like_count`, and `comment_count`
2. The NewsItem schema expected these fields to be strings
3. This caused validation errors in `normalizeNewsItem`, causing all items to be filtered out

## Files Changed
1. **`frontend/src/lib/data/newsRepo.ts`**
   - Updated `normalizeNewsItem` to convert count fields to strings using `String()`
   
2. **`frontend/src/stores/newsStore.ts`**
   - Updated the transformation in `fetchNews` to convert count fields to strings

3. **`frontend/src/lib/db/repos/newsRepo.ts`**
   - Previously updated `transformToHomeItem` to convert counts to strings

## Exact Fix
```typescript
// Before:
view_count: sanitizedItem.view_count || '0',
like_count: sanitizedItem.like_count || '0', 
comment_count: sanitizedItem.comment_count || '0',

// After:
view_count: String(sanitizedItem.view_count || 0),
like_count: String(sanitizedItem.like_count || 0),
comment_count: String(sanitizedItem.comment_count || 0),
```

## Result
The home page now correctly displays trending stories by ensuring type consistency throughout the data pipeline.
