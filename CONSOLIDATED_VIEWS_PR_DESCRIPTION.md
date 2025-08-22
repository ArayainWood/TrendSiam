# PR: Fix "invalid input syntax for type json" Error with Safe Helpers

## Overview

This PR fixes the critical runtime error "Unable to Load News — Query failed: invalid input syntax for type json" by introducing safe JSON helper functions that gracefully handle malformed or non-JSON data in TEXT columns.

## Root Cause

The `score_details` column in `news_trends` is TEXT but sometimes contains:
- Plain strings instead of JSON
- Empty strings
- NULL values
- Malformed JSON

Direct casting with `::jsonb` throws an exception when the data isn't valid JSON.

## Solution

### 🛡️ Safe Helper Functions

Added two helper functions that **never throw errors**:

```sql
-- Returns {} for any invalid JSON
CREATE OR REPLACE FUNCTION public.safe_to_jsonb(src text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF src IS NULL OR btrim(src) = '' THEN
    RETURN '{}'::jsonb;
  END IF;
  BEGIN
    RETURN src::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN '{}'::jsonb;  -- Graceful fallback
  END;
END;
$$;

-- Safe property extraction with default
CREATE OR REPLACE FUNCTION public.safe_json_text(obj jsonb, key text, default_val text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(jsonb_extract_path_text(obj, key), default_val);
$$;
```

### 📝 View Updates

All views now use safe patterns:

**Before (throws error):**
```sql
n.score_details::jsonb->>'growth_rate'
```

**After (always safe):**
```sql
public.safe_json_text(
  public.safe_to_jsonb(n.score_details), 
  'growth_rate', 
  '0'
)
```

## What's Fixed

- ✅ No more "invalid input syntax for type json" errors
- ✅ Views always return data, even with malformed JSON
- ✅ Graceful fallbacks to empty object `{}` or default values
- ✅ All backward compatibility aliases maintained
- ✅ Performance: helpers are IMMUTABLE for caching

## Testing

### Quick Verification
```bash
# 1. Apply SQL (includes helper functions)
npm run db:apply-views

# 2. Test views work without errors
npm run db:test-views
```

### Manual Test
```sql
-- This should return results, not error
SELECT 
  id,
  view_details->>'growth_rate' as growth_rate
FROM news_public_v
LIMIT 10;
```

### End-to-End
```bash
python summarize_all_v2.py --limit 20
npm run snapshot:build:publish  
npm run build && npm run start
```

## Files Changed

1. **frontend/db/sql/security/create_public_views.sql** - Added safe helpers, updated all views
2. **frontend/scripts/testDatabaseViews.ts** - Enhanced JSON safety tests
3. **SQL_VIEWS_CONSOLIDATION_NOTES.md** - Updated docs for v3

## Security & Performance

- **No new permissions needed** - Functions only used within views
- **RLS unchanged** - SECURITY INVOKER still enforced
- **Performance impact minimal** - Simple try/catch, IMMUTABLE for optimization
- **No schema changes** - Just view logic updates

## Checklist

- [x] Safe helper functions added
- [x] All direct JSON casts replaced
- [x] Test script updated
- [x] Documentation updated
- [ ] SQL applied to Supabase
- [ ] All tests pass
- [ ] Home page loads without errors
- [ ] Weekly report shows data

This is a critical fix that prevents runtime errors when dealing with inconsistent JSON data in TEXT columns.