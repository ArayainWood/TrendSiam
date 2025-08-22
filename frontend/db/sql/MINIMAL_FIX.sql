-- =============================================
-- MINIMAL FIX FOR "Unable to Load News" ERROR
-- Run this ENTIRE script in Supabase SQL Editor
-- =============================================

-- Create the missing helper functions that news_public_v needs

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

-- Test that the fix worked
SELECT 
  'Functions created successfully!' as status,
  COUNT(*) as news_items 
FROM news_public_v 
LIMIT 1;
