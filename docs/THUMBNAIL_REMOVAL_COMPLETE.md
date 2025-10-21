# Thumbnail Removal Complete

Date: 2024-01-31

## Summary

All thumbnail support has been permanently removed from TrendSiam. The system now exclusively uses AI-generated images for Top-3 items only.

## Changes Made

### 1. GitHub Actions Fixed
- Updated `schema-guard.yml` and `schema-drift-check.yml` to use repository variables instead of secrets
- Added proper permissions and guards
- Fixed "Context access might be invalid" warnings

### 2. API Hardening
- Home API now returns 503 (Service Unavailable) instead of 500 when view is misconfigured
- Added comprehensive diagnostics with missing columns list
- Clear error messages guide developers to apply SQL migrations

### 3. Thumbnail Removal
- Removed all references to `thumbnail_url`, `youtube_thumbnail_url`, `thumbnailUrl`, `youtubeThumbnailUrl`
- Created migration script: `2025-08-31_drop_thumbnail_columns.sql`
- Updated schema guard to block any thumbnail fields
- Added test assertions to prevent thumbnail fields in API responses

### 4. Files Modified
- `frontend/src/hooks/useSupabaseNews.ts` - Removed thumbnail_url from select
- `frontend/src/types/HomeNewsItem.ts` - Removed thumbnail_url from schema
- `frontend/db/sql/fixes/2025-08-31_emergency_view_fix_v4.sql` - Added warning header
- `frontend/scripts/assert-schema.mjs` - Added disallowed field check
- `frontend/scripts/test-home-api.mjs` - Added thumbnail policy test
- `docs/dev/home_contract.md` - Added image policy section
- `docs/dev/how_to_update_schema.md` - Added thumbnail policy notes

### 5. New Files Created
- `frontend/db/sql/fixes/2025-08-31_drop_thumbnail_columns.sql` - Safe migration to drop thumbnail columns

## Policy Enforcement

The system now enforces:
1. **Schema Guard**: Fails if any thumbnail fields are detected in database
2. **API Tests**: Fails if any thumbnail fields appear in API responses
3. **TypeScript**: No thumbnail types or interfaces exist
4. **Documentation**: Clear policy statements throughout

## Image Policy (Final)

- **Top-3 Items** (is_top3=true): May have AI-generated image_url and ai_prompt
- **Non-Top-3 Items**: MUST have image_url=NULL and ai_prompt=NULL
- **No Thumbnails**: System does not support external thumbnails
- **No Scraping**: External images are strictly prohibited

## Verification

Run these commands to verify:
```bash
# Check types compile
npm run check:types

# Check schema for thumbnails
npm run db:guard

# Check API compliance
npm run check:home

# Run all checks
npm run check:all
```

All checks should pass with no thumbnail-related warnings or errors.
