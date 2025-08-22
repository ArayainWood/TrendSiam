-- =============================================
-- Secure Public Views - Single Source of Truth
-- TrendSiam Method B Implementation v3
-- =============================================
-- This script creates all public views with safe JSON handling
-- and backward compatibility aliases for the application
-- 
-- IMPORTANT FIX (2025-01-09):
-- Fixed news_public_v to use actual table columns (growth_rate, platform_mentions)
-- instead of trying to extract them from score_details JSON
-- =============================================

BEGIN;

-- =============================================
-- HELPER FUNCTIONS FOR SAFE JSON HANDLING
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

-- =============================================
-- 1. NEWS PUBLIC VIEW (with safe JSON handling)
-- =============================================
DROP VIEW IF EXISTS public.news_public_v CASCADE;

CREATE VIEW public.news_public_v
WITH (security_invoker = true) AS
WITH src AS (
  SELECT
    n.*,
    public.safe_to_jsonb(n.score_details) AS score_details_json
  FROM public.news_trends n
)
SELECT
  -- Core identifiers
  src.id,
  src.video_id,
  src.external_id,
  
  -- Content fields
  src.title,
  src.summary,
  src.summary_en,
  src.description,
  src.category,
  src.platform,
  src.channel,
  
  -- Dates with compatibility alias
  src.date,
  src.published_date,
  src.published_date AS published_at,  -- Compatibility alias
  src.created_at,
  src.updated_at,
  
  -- Metrics
  src.view_count,
  src.like_count,
  src.comment_count,
  src.duration,
  
  -- Scores - provide both raw and computed
  src.popularity_score,
  src.popularity_score_precise,
  COALESCE(src.popularity_score_precise, src.popularity_score, 0)::numeric AS score,
  
  -- Safe image field only (no prompts)
  src.ai_image_url,
  src.ai_image_url AS display_image_url,  -- Compatibility alias
  
  -- Analysis fields
  src.reason,
  src.keywords,
  src.ai_opinion,
  src.ai_opinion AS analysis,  -- Compatibility alias
  
  -- Raw score_details as TEXT
  src.score_details,
  
  -- Build view_details using actual table columns (growth_rate and platform_mentions are NOT in score_details)
  jsonb_build_object(
    'views', COALESCE(src.view_count::text, '0'),
    'growth_rate', COALESCE(src.growth_rate::text, '0'),
    'platform_mentions', COALESCE(src.platform_mentions::text, '0'),
    'matched_keywords', COALESCE(src.keywords::text, ''),
    'ai_opinion', COALESCE(src.ai_opinion, ''),
    'score', COALESCE(src.popularity_score_precise, src.popularity_score, 0)::text
  ) AS view_details
  
FROM src
WHERE
  -- Show published content with recent fallback
  src.published_date IS NOT NULL
  OR src.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY 
  COALESCE(src.popularity_score_precise, src.popularity_score, 0) DESC, 
  src.id ASC;

GRANT SELECT ON public.news_public_v TO anon, authenticated;

COMMENT ON VIEW public.news_public_v IS 
'Read-only view of trending news with safe JSON handling and compatibility aliases (published_at, display_image_url, analysis, view_details).';

-- =============================================
-- 2. STORIES PUBLIC VIEW (with id alias)
-- =============================================
DROP VIEW IF EXISTS public.stories_public_v CASCADE;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'stories'
  ) THEN
    EXECUTE '
    CREATE VIEW public.stories_public_v
    WITH (security_invoker = true) AS
    SELECT
      s.story_id,
      s.story_id AS id,  -- Compatibility alias for app code
      s.source_id,
      s.platform,
      s.publish_time,
      s.title,
      s.description,
      s.category,
      s.summary,
      s.summary_en,
      s.channel,
      s.duration,
      s.created_at,
      s.updated_at
    FROM public.stories s
    WHERE s.publish_time IS NOT NULL 
    AND s.publish_time <= CURRENT_TIMESTAMP
    ORDER BY s.publish_time DESC';
    
    EXECUTE 'GRANT SELECT ON public.stories_public_v TO anon, authenticated';
    
    EXECUTE 'COMMENT ON VIEW public.stories_public_v IS 
    ''Read-only stories view with id alias for backward compatibility''';
  END IF;
END $$;

-- =============================================
-- 3. SNAPSHOTS PUBLIC VIEW (with safe JSON handling)
-- =============================================
DROP VIEW IF EXISTS public.snapshots_public_v CASCADE;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'snapshots'
  ) THEN
    EXECUTE '
    CREATE VIEW public.snapshots_public_v
    WITH (security_invoker = true) AS
    WITH src AS (
      SELECT
        s.*,
        public.safe_to_jsonb(s.score_details) AS score_details_json
      FROM public.snapshots s
    )
    SELECT
      src.id,
      src.id AS snapshot_id,  -- Compatibility alias
      src.story_id,
      src.snapshot_date,
      src.rank,
      src.popularity_score,
      src.popularity_score_precise,
      -- Computed score field for UI
      COALESCE(src.popularity_score_precise, src.popularity_score, 0)::numeric AS score,
      src.view_count,
      src.like_count,
      src.comment_count,
      src.growth_rate,
      src.platform_mentions,
      src.keywords,
      src.keywords AS matched_keywords,  -- Compatibility alias
      src.created_at,
      src.updated_at
    FROM src
    WHERE src.snapshot_date >= CURRENT_DATE - INTERVAL ''30 days''
    ORDER BY src.snapshot_date DESC, src.rank ASC';
    
    EXECUTE 'GRANT SELECT ON public.snapshots_public_v TO anon, authenticated';
    
    EXECUTE 'COMMENT ON VIEW public.snapshots_public_v IS 
    ''Read-only snapshots with safe JSON handling and compatibility aliases (snapshot_id, matched_keywords, score)''';
  END IF;
END $$;

-- =============================================
-- 4. WEEKLY REPORT PUBLIC VIEW
-- =============================================
DROP VIEW IF EXISTS public.weekly_report_public_v CASCADE;

CREATE VIEW public.weekly_report_public_v
WITH (security_invoker = true) AS
SELECT
  w.snapshot_id,
  w.status,
  w.range_start,
  w.range_end,
  w.built_at,
  w.algo_version,
  w.data_version,
  w.items,  -- jsonb array
  w.meta,   -- jsonb metadata
  w.created_at
FROM public.weekly_report_snapshots w
WHERE w.status = 'published'
ORDER BY w.built_at DESC;

GRANT SELECT ON public.weekly_report_public_v TO anon, authenticated;

COMMENT ON VIEW public.weekly_report_public_v IS 
'Published weekly report snapshots for the public weekly report page.';

-- =============================================
-- 5. LEGACY WEEKLY_PUBLIC_VIEW 
-- For maximum backward compatibility
-- =============================================
DROP VIEW IF EXISTS public.weekly_public_view CASCADE;

CREATE VIEW public.weekly_public_view
WITH (security_invoker = true) AS
SELECT
  -- All fields from news_public_v
  n.id,
  n.video_id,
  n.title,
  n.summary,
  n.summary_en,
  n.platform,
  n.category,
  n.popularity_score,
  n.popularity_score_precise,
  n.score,  -- Already computed in news_public_v
  n.date,
  n.published_date,
  n.published_at,  -- Alias from news_public_v
  n.description,
  n.channel,
  n.view_count,
  n.like_count,
  n.comment_count,
  n.duration,
  n.reason,
  n.keywords,
  n.score_details,
  n.ai_image_url,
  n.display_image_url,  -- Alias from news_public_v
  n.created_at,
  n.updated_at,
  n.ai_opinion,
  n.analysis,  -- Alias from news_public_v
  n.view_details,  -- Safe computed object from news_public_v
  
  -- Additional computed fields for legacy code
  n.view_count AS views,
  COALESCE(n.published_date, n.created_at::date) AS published_at_date
  
FROM public.news_public_v n
WHERE n.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY n.score DESC, n.id ASC;

GRANT SELECT ON public.weekly_public_view TO anon, authenticated;

COMMENT ON VIEW public.weekly_public_view IS 
'Legacy compatibility view using secure news_public_v as source. Provides all backward compatibility fields with safe JSON handling.';

COMMIT;

-- =============================================
-- VERIFICATION QUERIES
-- Run these after applying the views
-- =============================================

/*
-- 1. Check news view aliases work
SELECT 
  published_date, 
  published_at, 
  published_date = published_at as alias_matches,
  ai_image_url,
  display_image_url,
  ai_image_url = display_image_url as image_alias_matches,
  score,
  popularity_score_precise
FROM news_public_v 
LIMIT 1;

-- 2. Check stories view id alias
SELECT 
  story_id, 
  id, 
  story_id = id as alias_matches
FROM stories_public_v 
LIMIT 1;

-- 3. Check snapshots view aliases
SELECT 
  id,
  snapshot_id,
  id = snapshot_id as id_alias_matches,
  keywords,
  matched_keywords,
  keywords = matched_keywords as keyword_alias_matches,
  score,
  popularity_score_precise
FROM snapshots_public_v 
LIMIT 1;

-- 4. Check weekly reports
SELECT 
  COUNT(*) as published_count,
  MAX(built_at) as latest_snapshot
FROM weekly_report_public_v;

-- 5. Test safe JSON extraction (no errors expected)
SELECT 
  id,
  score_details,
  view_details->>'growth_rate' as growth_rate,
  view_details->>'platform_mentions' as platform_mentions
FROM news_public_v
WHERE score_details IS NOT NULL
LIMIT 5;

-- 6. Test edge cases for JSON safety
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN score_details IS NULL THEN 1 END) as null_score_details,
  COUNT(CASE WHEN score_details = '' THEN 1 END) as empty_score_details,
  COUNT(CASE WHEN view_details IS NOT NULL THEN 1 END) as has_view_details
FROM news_public_v;
*/

-- =============================================
-- NOTES ON SAFE JSON HANDLING
-- =============================================
-- 1. Helper functions prevent "invalid input syntax for type json" errors
-- 2. safe_to_jsonb() returns {} for any invalid/empty JSON
-- 3. safe_json_text() safely extracts text values with defaults
-- 4. All direct ::jsonb casts replaced with safe_to_jsonb()
-- 5. No errors thrown - graceful fallbacks everywhere
-- =============================================