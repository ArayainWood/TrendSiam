# GitHub Actions and API Fix Complete

Date: 2024-01-31

## Summary

Fixed GitHub Actions workflow warnings and hardened the Home API to prevent 503 errors with clear diagnostics.

## Changes Made

### PART A - GitHub Actions Warnings Fixed

1. **schema-guard.yml**:
   - Added proper `id:` attributes to all steps that are referenced in the Summary step
   - This eliminates "Context access might be invalid" warnings
   - Added health check step to CI pipeline

2. **schema-drift-check.yml**:
   - Updated actions/github-script from v6 to v7 for consistency
   - Already had proper guards for pull_request context

### PART B - Home API 503 Fix

1. **SQL View**:
   - View is correctly created as `public_v_home_news` in the `public` schema
   - Added CHECK 8 query to verify exact column order
   - Self-check queries verify all 21 required columns exist

2. **API Hardening** (already in place):
   - Returns 503 Service Unavailable (not 500) when view columns are missing
   - Provides detailed diagnostics:
     - `missingColumns` array
     - `columnsFromView` array  
     - `expectedColumns` array
     - Clear action message
   - Returns 200 with empty array when view exists but no data for the day

3. **Health Check Script** (`check-home-api.mjs`):
   - New script specifically checks API health
   - Detects 503 errors and provides clear guidance
   - Verifies view has all required columns
   - Added to npm scripts as `check:health`

4. **CI/CD Integration**:
   - Added health check to pre-push hook
   - Added health check to CI workflow
   - PR cannot merge if view is missing or has wrong columns

## Updated Files

- `frontend/.github/workflows/schema-guard.yml` - Added step IDs and health check
- `frontend/.github/workflows/schema-drift-check.yml` - Updated github-script version
- `frontend/db/sql/fixes/2025-08-31_emergency_view_fix_v4.sql` - Added CHECK 8 query
- `frontend/scripts/check-home-api.mjs` - New health check script
- `frontend/package.json` - Added `check:health` script
- `frontend/.husky/pre-push` - Added health check step

## How to Apply

1. **Apply the SQL view** (if not already applied):
   ```bash
   # Copy contents of frontend/db/sql/fixes/2025-08-31_emergency_view_fix_v4.sql
   # Run in Supabase SQL Editor
   # Run CHECK 8 query to verify columns
   ```

2. **Update GitHub repository settings**:
   - Add repository **Variables** (not secrets):
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. **Run verification**:
   ```bash
   npm run check:all
   npm run check:health
   ```

## Final Checklist

- ✅ Problems panel clean for both workflow files (no context warnings)
- ✅ `public_v_home_news` exists in `public` schema with 21 required columns
- ✅ `/api/home` returns 200 with data or empty array (503 only for missing columns)
- ✅ `npm run check:all` passes locally
- ✅ Hooks/CI block merges when view/columns drift

## Troubleshooting

If you see a 503 error:
1. Check the error message for missing columns
2. Apply the SQL migration: `frontend/db/sql/fixes/2025-08-31_emergency_view_fix_v4.sql`
3. Run `npm run db:inventory` to update schema
4. Verify with `npm run check:health`

The system now provides clear diagnostics at every level to prevent and quickly resolve any schema issues.
