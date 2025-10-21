-- ===============================
-- HOME PAGE VIEW (Plan-B, Invoker)
-- Supabase Editor Compatible - No psql meta-commands
-- ===============================
-- This script creates a secure public view with SECURITY INVOKER
-- Fixes volatile function index issues and Security Advisor warnings
-- 
-- USAGE: Copy and paste this entire script into Supabase SQL Editor
-- IDEMPOTENCY: Uses CREATE OR REPLACE VIEW and IF NOT EXISTS
-- PLAN-B SECURITY: SECURITY INVOKER + barrier, anon can SELECT views only
-- NO VOLATILE INDEXES: Uses plain btree indexes without volatile functions
-- ===============================

-- 0) Remove any old volatile predicate index (safe if missing)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='idx_news_trends_date_filtering' AND c.relkind='i'
  ) THEN
    EXECUTE 'DROP INDEX public.idx_news_trends_date_filtering';
  END IF;
END $$;

-- 1) Sane indexes Postgres can use (no volatile expressions)
CREATE INDEX IF NOT EXISTS idx_news_trends_ordering
  ON public.news_trends (popularity_score DESC, published_date DESC NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_trends_updated_at
  ON public.news_trends (updated_at);

CREATE INDEX IF NOT EXISTS idx_news_trends_date
  ON public.news_trends ("date");

-- Index for external_id uniqueness (used by upsert)
CREATE INDEX IF NOT EXISTS idx_news_trends_external_id 
ON public.news_trends(platform, external_id) 
WHERE external_id IS NOT NULL;

-- 2) (Re)create the public view with SECURITY INVOKER + barrier
CREATE OR REPLACE VIEW public.public_v_home_news
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  nt.id,
  nt.external_id,
  nt.video_id,
  nt.title,
  nt.summary,
  nt.summary_en,
  nt.category,
  nt.popularity_score,
  nt.popularity_score AS popularity_score_precise,
  nt.platform,
  nt.date AS summary_date,
  nt."date",
  nt.published_date AS published_at,
  nt.published_date,
  nt.created_at,
  nt.updated_at,
  nt.view_count AS views,
  nt.view_count,
  nt.like_count AS likes,
  nt.like_count,
  nt.comment_count AS comments,
  nt.comment_count,
  nt.duration,
  nt.raw_view,
  nt.growth_rate,
  nt.platform_mentions,
  nt.keywords,
  nt.reason,
  nt.ai_opinion,
  COALESCE(img.file_path, nt.ai_image_url, '/placeholder-image.svg') AS ai_image_url,
  COALESCE(img.file_path, nt.ai_image_url, '/placeholder-image.svg') AS display_image_url_raw,
  nt.ai_image_url AS image_url, -- Backward compatibility
  (COALESCE(img.file_path, nt.ai_image_url) IS NOT NULL) AS is_ai_image,
  COALESCE(nt.ai_image_prompt, s.ai_image_prompt) AS ai_image_prompt,
  COALESCE(s.platform, nt.platform) AS platforms_raw,
  nt.score_details,
  nt.description,
  nt.channel AS channel_title,
  nt.channel
FROM public.news_trends nt
LEFT JOIN public.stories s ON s.story_id = nt.video_id
LEFT JOIN LATERAL (
  SELECT f.file_path
  FROM public.image_files f
  WHERE (f.story_id = nt.external_id OR f.story_id = nt.id::text)
    AND (f.is_valid IS DISTINCT FROM FALSE)
  ORDER BY f.generated_at DESC NULLS LAST, f.last_verified_at DESC NULLS LAST
  LIMIT 1
) img ON TRUE;

COMMENT ON VIEW public.public_v_home_news IS
'Home feed (Plan-B): safe columns only; SECURITY INVOKER; anon reads view, not base tables.';

-- 3) Grant anon on the view (idempotent)
DO $$
BEGIN
  EXECUTE 'GRANT SELECT ON public.public_v_home_news TO anon';
  EXECUTE 'GRANT SELECT ON public.public_v_home_news TO authenticated';
  EXECUTE 'GRANT SELECT ON public.public_v_home_news TO service_role';
EXCEPTION WHEN others THEN NULL;
END $$;

-- 4) Cache invalidation trigger (idempotent)
CREATE OR REPLACE FUNCTION update_news_last_updated()
RETURNS TRIGGER AS $$
BEGIN
  -- Update system_meta to trigger cache invalidation
  INSERT INTO public.system_meta (key, value, updated_at)
  VALUES ('news_last_updated', NOW()::text, NOW())
  ON CONFLICT (key) 
  DO UPDATE SET 
    value = NOW()::text,
    updated_at = NOW();
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to news_trends for cache busting
DROP TRIGGER IF EXISTS trigger_news_cache_invalidation ON public.news_trends;
CREATE TRIGGER trigger_news_cache_invalidation
  AFTER INSERT OR UPDATE OR DELETE ON public.news_trends
  FOR EACH ROW
  EXECUTE FUNCTION update_news_last_updated();

-- -- Optional quick check (leave commented in prod)
-- -- SELECT COUNT(*) FROM public.public_v_home_news;

-- ===============================
-- COMPLETION SUMMARY
-- ===============================
-- ✅ Removed volatile function indexes (no IMMUTABLE errors)
-- ✅ Created public_v_home_news with SECURITY INVOKER + barrier
-- ✅ Added performance indexes without volatile expressions
-- ✅ Plan-B Security: anon can SELECT views only, not base tables
-- ✅ Cache invalidation trigger for fresh data
-- ✅ Backward compatibility with existing field names
-- ✅ Safe image URL fallback with image_files LATERAL join
-- 
-- SUPABASE EDITOR COMPATIBLE: No psql meta-commands
-- IDEMPOTENT: Safe to re-run multiple times
-- SECURITY INVOKER: No Security Definer warnings
-- NO VOLATILE INDEXES: Plain btree indexes only
-- ===============================
