# Home API Const Reassignment Fix

## Changes Made

### 1. Fixed const reassignment issue in `/src/app/api/home/route.ts`
- Replaced const destructuring pattern that was being reassigned
- Changed from `const { data, error } = await ...` to `const primaryResult = await ...`
- Used `let rows` and `let dbError` for mutable variables
- Updated all references throughout the file

### 2. Updated HOME_COLUMNS to match actual view schema
- File: `frontend/src/lib/db/schema-constants.ts`
- Updated from 21 to 26 columns to include:
  - video_id
  - external_id
  - platform_mentions
  - keywords
  - updated_at
- This matches what the view provides and what mapNews.ts expects

### 3. Replaced all select('*') with HOME_COLUMNS.join(',')
- Primary query uses HOME_COLUMNS
- Fallback query uses HOME_COLUMNS
- Column check sample query uses HOME_COLUMNS

### 4. Updated memory bank documentation
- File: `memory-bank/03_frontend_homepage_freshness.mb`
- Added API query pattern documentation
- Documented column selection requirement

## Query Pattern

The API now follows this pattern:
1. Primary query: Orders by `rank ASC` (respects view's ranking)
2. If no results and no DB error: Fallback query orders by `published_at DESC` (newest first)
3. Both queries limit results to `config.home_limit` (default 20)
4. Only queries `public_v_home_news` view (no base tables)

## Security Compliance

✅ Follows Plan-B security model:
- Only reads from `public_v_home_news` view
- Uses anon key
- No base table access

## Testing Steps

1. Start dev server: `npm run dev`
2. Test endpoints:
   - http://localhost:3000/api/home
   - http://localhost:3000/api/home/diagnostics
   - http://localhost:3000 (home page)

## Expected Results

- No TypeScript const reassignment errors
- API returns proper response structure
- Home page renders with Top-3 policy intact
- Diagnostics shows no missing columns
