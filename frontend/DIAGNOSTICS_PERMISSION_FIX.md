# Diagnostics Permission Error Fix Summary

## Changes Made

### 1. Created Public System Meta View
- **File**: `frontend/db/sql/fixes/2025-09-17_public_v_system_meta.sql`
- Creates `public_v_system_meta` view exposing only safe config keys
- Grants SELECT to anon and authenticated users
- Follows Plan-B security model

### 2. Added Grants for Public Views
- **File**: `frontend/db/sql/fixes/2025-09-17_grant_public_v_home_news.sql`
- Ensures proper SELECT grants on all public views
- Sets SECURITY INVOKER on views

### 3. Fixed Diagnostics API
- **File**: `frontend/src/app/api/home/diagnostics/route.ts`
- Removed direct query to `news_trends` table
- Now uses `public_v_system_meta` for config values
- Returns meta object instead of snapshotDay
- Returns sampleTitles (3 items) instead of full sampleItems

### 4. Fixed Home API
- **File**: `frontend/src/app/api/home/route.ts`
- Uses `public_v_system_meta` instead of `system_meta`
- Removed diagnostic queries to base tables
- Added resilient fallback query (no date filter) if initial query returns 0 rows

### 5. Updated Verification Script
- **File**: `frontend/db/sql/fixes/verify_home_view.sql`
- Now queries `public_v_system_meta` instead of base `system_meta`

### 6. Created Test Script
- **File**: `frontend/scripts/test-home-api.mjs`
- Tests both /api/home and /api/home/diagnostics
- Checks for permission errors
- Validates response structure

### 7. Updated Memory Bank
- **File**: `memory-bank/13_testing_acceptance_criteria.mb`
- Added "Diagnostics (public views only)" section
- Documents that APIs must never read base tables with anon key

## SQL Migrations to Apply

Run these in order:
1. `frontend/db/sql/fixes/2025-09-17_public_v_system_meta.sql`
2. `frontend/db/sql/fixes/2025-09-17_grant_public_v_home_news.sql`

## Testing Steps

1. Apply the SQL migrations in Supabase
2. Start the dev server: `npm run dev`
3. Run the test script: `node scripts/test-home-api.mjs`
4. Visit:
   - http://localhost:3000/api/home/diagnostics (should not show permission errors)
   - http://localhost:3000/api/home (should return data if DB has records)
   - http://localhost:3000 (home page should render)

## Key Security Changes

- No API endpoints read base tables directly anymore
- All data access goes through public views
- Follows Plan-B security model strictly
- Anon key can only read from `public_v_*` views
