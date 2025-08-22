# SQL Views Consolidation & Schema Fix - v3

**Date:** 2025-01-09  
**Objective:** Fix "invalid input syntax for type json" errors with safe helper functions

## Overview

This v3 update fixes runtime JSON parsing errors by introducing safe helper functions that never throw exceptions. All direct JSON casts have been replaced with these helpers, ensuring the views always return data even when source TEXT columns contain invalid JSON.

## Key Changes in v3

### 1. Safe JSON Helper Functions

Added two helper functions at the beginning of the SQL script:

```sql
-- Safe TEXT -> JSONB converter
CREATE OR REPLACE FUNCTION public.safe_to_jsonb(src text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF src IS NULL OR btrim(src) = '' THEN
    RETURN '{}'::jsonb;
  END IF;
  BEGIN
    RETURN src::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN '{}'::jsonb;  -- Never throw error
  END;
END;
$$;

-- Safe JSON property extractor
CREATE OR REPLACE FUNCTION public.safe_json_text(obj jsonb, key text, default_val text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(jsonb_extract_path_text(obj, key), default_val);
$$;
```

### 2. Updated Views to Use Safe Helpers

#### news_public_v
- Uses CTE pattern with `safe_to_jsonb(score_details)`
- Replaced direct casts like `score_details::jsonb->>'growth_rate'`
- Now uses `safe_json_text(score_details_json, 'growth_rate', '0')`

#### snapshots_public_v  
- Same CTE pattern for safe JSON handling
- No more direct TEXT->JSON casts

### 3. All Previous Fixes Maintained

- Schema aliases still work (published_at, id, snapshot_id, etc.)
- Backward compatibility preserved
- Security model unchanged (SECURITY INVOKER, SELECT only)
- All sensitive fields still excluded

## Error This Fixes

**Before:** `Query failed: invalid input syntax for type json`
- Happened when `score_details` contained plain text or malformed JSON
- Direct cast `::jsonb` would throw exception

**After:** Safe fallback to empty object `{}`
- Helper functions catch all exceptions
- Always return valid JSONB or default values
- No runtime errors possible

## Files Changed

1. **frontend/db/sql/security/create_public_views.sql** - v3 with safe JSON helpers
2. **frontend/src/lib/db/types/views.ts** - Types unchanged (already handle nulls)
3. **frontend/package.json** - Scripts unchanged
4. **frontend/scripts/testDatabaseViews.ts** - Test script unchanged
5. Type annotations in components - Already applied
6. **This file** - Updated documentation

## How to Apply

### Option 1: NPM Scripts
```bash
# Step 1: Get instructions
npm run db:apply-views

# Step 2: After applying SQL in Supabase, verify
npm run db:test-views
```

### Option 2: Direct Application
1. Open Supabase SQL Editor
2. Copy entire contents of `frontend/db/sql/security/create_public_views.sql`
3. Paste and execute (includes helper functions)
4. Run verification with: `npm run db:test-views`

## Verification Queries

After applying, these should all work without errors:

```sql
-- 1. Basic alias checks
SELECT published_date, published_at FROM news_public_v LIMIT 1;
SELECT story_id, id FROM stories_public_v LIMIT 1;
SELECT id, snapshot_id FROM snapshots_public_v LIMIT 1;

-- 2. Test JSON extraction (previously would error on bad JSON)
SELECT 
  id,
  score_details,  -- Raw TEXT
  view_details->>'growth_rate' as growth_rate  -- Safe extraction
FROM news_public_v
LIMIT 10;

-- 3. Edge case test
SELECT COUNT(*) 
FROM news_public_v 
WHERE view_details IS NOT NULL;  -- Should be 100% (never null)
```

## Security & Performance

- **Helper functions are IMMUTABLE**: Postgres can optimize/cache
- **No new permissions needed**: Functions are only used within views
- **RLS unchanged**: Views still use SECURITY INVOKER
- **Performance impact minimal**: Simple try/catch operations

## Testing Checklist

- [x] SQL includes safe helper functions
- [x] All direct JSON casts replaced
- [x] Backward compatibility aliases maintained
- [ ] Run SQL in Supabase (with helper functions)
- [ ] Execute verification queries - no errors
- [ ] Run `npm run db:test-views` - all pass
- [ ] Test three flows:
  - [ ] `python summarize_all_v2.py --limit 20`
  - [ ] `npm run snapshot:build:publish`
  - [ ] `npm run build && npm run start`
- [ ] Home page loads without "Unable to Load News" error
- [ ] Weekly report shows data correctly

## Rollback

If issues arise:

```sql
BEGIN;
-- Drop views and functions
DROP VIEW IF EXISTS public.weekly_public_view CASCADE;
DROP VIEW IF EXISTS public.news_public_v CASCADE;
DROP VIEW IF EXISTS public.stories_public_v CASCADE;
DROP VIEW IF EXISTS public.snapshots_public_v CASCADE;
DROP VIEW IF EXISTS public.weekly_report_public_v CASCADE;
DROP FUNCTION IF EXISTS public.safe_to_jsonb(text);
DROP FUNCTION IF EXISTS public.safe_json_text(jsonb, text, text);
ROLLBACK; -- or COMMIT if sure
```

## Summary

This v3 update makes the views bulletproof against malformed JSON data. The helper functions ensure that even if `score_details` or other TEXT fields contain invalid JSON, the views will still return results with safe default values instead of throwing errors.