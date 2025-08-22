-- =============================================
-- Lock search_path for helper functions
-- This ensures functions don't accidentally access objects from other schemas
-- =============================================

-- Lock search_path for safe_to_jsonb
ALTER FUNCTION public.safe_to_jsonb(text) SET search_path = pg_catalog, public;

-- Lock search_path for safe_json_text
ALTER FUNCTION public.safe_json_text(jsonb, text, text) SET search_path = pg_catalog, public;

-- Verify the functions exist and have correct search_path
SELECT 
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS security_definer,
  p.proconfig AS config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' 
  AND p.proname IN ('safe_to_jsonb', 'safe_json_text')
ORDER BY p.proname;
