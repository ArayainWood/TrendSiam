# SOLUTION: Fix "Unable to Load News" Error

## Root Cause Identified

The error "Query failed: invalid input syntax for type json" happens because:

1. ✅ The `news_public_v` view EXISTS
2. ❌ The helper functions it uses DO NOT EXIST
3. When the view tries to call `public.safe_to_jsonb()` or `public.safe_json_text()`, it fails

## Evidence

From deep diagnostic:
```
✓ Simple query works
✗ Query including view_details... Error: invalid input syntax for type json
✗ safe_to_jsonb not found
```

The view is trying to build `view_details` using non-existent functions!

## THE FIX (1 minute)

Run this SQL in Supabase SQL Editor:

```sql
-- Create the missing helper functions
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

-- Test it works
SELECT COUNT(*) FROM news_public_v;
```

## Why This Works

The `news_public_v` view is already created and is trying to use:
- `public.safe_to_jsonb(n.score_details)` to safely convert TEXT to JSON
- `public.safe_json_text(...)` to extract values from JSON

Once these functions exist, the view will work correctly!

## Verification

After running the SQL:

```bash
npm run db:deep-diagnostic
```

You should see:
```
✓ Query including view_details... (no error)
✓ safe_to_jsonb exists
```

Then refresh http://localhost:3000 - it will work!
