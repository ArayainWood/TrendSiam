# Fix Steps for "Unable to Load News" JSON Error

## Root Cause
The error "Query failed: invalid input syntax for type json" is happening because:

1. The app is trying to query `news_public_v` view
2. The view doesn't exist because it depends on helper functions that weren't created
3. When the view creation failed, Supabase may have created a partial view or the error is from the view definition itself

## Verification Results
From running `npm run db:verify-fix`:
- ❌ `safe_to_jsonb` function - NOT FOUND
- ❌ `safe_json_text` function - NOT FOUND  
- ❌ `news_public_v` view - NOT FOUND
- ✅ Other views exist (stories, snapshots, weekly_report)

## THE FIX

### Option 1: Quick Fix (2 minutes)

1. Open Supabase SQL Editor
2. Copy and run this ENTIRE script:

```sql
-- Create helper functions
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
    RETURN '{}'::jsonb;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.safe_json_text(obj jsonb, key text, default_val text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(jsonb_extract_path_text(obj, key), default_val);
$$;

-- Quick test
SELECT 
  public.safe_to_jsonb('{"test": "ok"}') as should_work,
  public.safe_to_jsonb('invalid') as should_return_empty;
```

3. Then run the FULL script from: `frontend/db/sql/security/create_public_views.sql`

### Option 2: Emergency Fix (1 minute)

1. Open Supabase SQL Editor  
2. Run the ENTIRE contents of: `frontend/db/sql/EMERGENCY_FIX_JSON_ERROR.sql`
3. This includes both functions AND the view in one script

### Verification

After running either fix:

```bash
cd frontend
npm run db:verify-fix
```

You should see:
- ✅ safe_to_jsonb exists
- ✅ safe_json_text exists  
- ✅ news_public_v exists

Then refresh http://localhost:3000 - the error should be gone!

## Why This Happened

The `news_public_v` view uses these helper functions to safely handle invalid JSON in TEXT columns:
- `safe_to_jsonb()` - Converts TEXT to JSON, returns {} if invalid
- `safe_json_text()` - Extracts values from JSON safely

Without these functions, the view can't be created, and the app fails to load news.
