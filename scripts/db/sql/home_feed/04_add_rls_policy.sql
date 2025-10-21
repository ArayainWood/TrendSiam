-- Add read-only RLS policy for public.home_feed_v1 view
-- This allows anon and authenticated users to SELECT from the view

-- First, check if RLS is enabled on views (it's not needed for views, but we'll add grants)
-- Views inherit permissions from underlying tables, but we'll be explicit

-- Grant SELECT permission to anon and authenticated roles
GRANT SELECT ON public.home_feed_v1 TO anon;
GRANT SELECT ON public.home_feed_v1 TO authenticated;

-- Note: Views don't have RLS policies. Access control is managed through:
-- 1. GRANT statements (above)
-- 2. The view definition itself (which filters/transforms data)
-- 3. RLS policies on the underlying tables (if any)

-- Add comment about permissions
COMMENT ON VIEW public.home_feed_v1 IS 'Home feed view providing exactly 26 columns expected by API. Uses news_trends as primary source. Enforces Top-3 image policy. Read-only access granted to anon and authenticated users.';
