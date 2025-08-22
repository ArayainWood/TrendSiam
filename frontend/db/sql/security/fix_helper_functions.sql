-- =============================================
-- Quick Fix: Create Missing Helper Functions
-- =============================================
-- Run this if views exist but helper functions are missing
-- =============================================

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

-- Test the functions
SELECT 
  public.safe_to_jsonb('{"valid": "json"}') as valid_json,
  public.safe_to_jsonb('invalid json') as invalid_json,
  public.safe_to_jsonb(NULL) as null_json,
  public.safe_json_text('{"key": "value"}'::jsonb, 'key', 'default') as existing_key,
  public.safe_json_text('{"key": "value"}'::jsonb, 'missing', 'default') as missing_key;
