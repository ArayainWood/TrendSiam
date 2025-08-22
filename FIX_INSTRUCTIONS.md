# Fix Instructions - Unable to Load News Error

## THE MINIMAL FIX (30 seconds)

**Just run `frontend/db/sql/MINIMAL_FIX.sql` in Supabase SQL Editor!**

## Quick Fix (2 minutes)

If you're seeing "Unable to Load News — Query failed: invalid input syntax for type json", follow these steps:

### Step 1: Apply Helper Functions

1. Open Supabase SQL Editor in your project
2. Copy and paste this SQL:

```sql
-- Safe TEXT -> JSONB converter (returns {} if invalid/empty)
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

3. Click "Run"

### Step 2: Verify Fix

```bash
cd frontend
npm run db:verify-fix
```

You should see:
- ✓ safe_to_jsonb exists
- ✓ safe_json_text exists

### Step 3: Test the App

```bash
npm start
```

The home page should now load without JSON errors!

## Full Fix (if Quick Fix doesn't work)

Run the complete views script:

1. Copy entire contents of `frontend/db/sql/security/create_public_views.sql`
2. Paste into Supabase SQL Editor
3. Run the script
4. Verify with `npm run db:test-views`

## Clean Up Bad Data (Optional)

If you want to clean up existing invalid JSON data:

```bash
cd D:\TrendSiam
python scripts/fix_invalid_json_data.py
```

This will convert invalid keywords like "null" to proper empty arrays.

## Troubleshooting

If still seeing errors:

1. Check which functions are missing:
   ```bash
   npm run db:debug-json
   ```

2. Verify views are using the functions:
   ```bash
   npm run db:test-views
   ```

3. Check server logs for the exact error

## Root Cause

The error occurs because:
- `keywords` and `score_details` are TEXT columns
- Some contain invalid JSON like "null" or "No viral keywords detected"
- Views try to cast TEXT to JSON without validation
- The helper functions provide safe conversion
