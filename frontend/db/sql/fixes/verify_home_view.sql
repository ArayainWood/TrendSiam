-- =========================================
-- VERIFY HOME VIEW — Manual Checks (robust)
-- Run after applying 2025-09-17_repair_public_v_home_news.sql
-- =========================================

-- Check 0: View exists
SELECT to_regclass('public.public_v_home_news') IS NOT NULL AS view_exists;

-- Check 1: Basic row count
SELECT COUNT(*) AS total_rows
FROM public.public_v_home_news;

-- Check 2: Sample top 5 with key fields (no heavy payload)
SELECT
  rank,
  id,
  title,
  platform,
  source_url,
  is_top3,
  (image_url IS NOT NULL) AS has_image,
  (ai_prompt IS NOT NULL) AS has_prompt,
  popularity_score,
  growth_rate_label
FROM public.public_v_home_news
ORDER BY rank
LIMIT 5;

-- Check 3: System meta keys via public view (no base table access)
SELECT key, value, updated_at
FROM public.public_v_system_meta
ORDER BY key;

-- Check 4: Verify column contract for public_v_home_news
WITH expected(col) AS (
  VALUES
    ('id'),('title'),('summary'),('summary_en'),('category'),
    ('platform'),('channel'),('published_at'),('source_url'),('image_url'),
    ('ai_prompt'),('popularity_score'),('rank'),('is_top3'),('views'),
    ('likes'),('comments'),('growth_rate_value'),('growth_rate_label'),
    ('ai_opinion'),('score_details'),('external_id'),('keywords'),('updated_at'),
    ('video_id'),('platform_mentions')
),
actual AS (
  SELECT column_name AS col
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name  = 'public_v_home_news'
)
SELECT 'missing' AS kind, e.col
FROM expected e
LEFT JOIN actual a ON a.col = e.col
WHERE a.col IS NULL
UNION ALL
SELECT 'unexpected' AS kind, a.col
FROM actual a
LEFT JOIN expected e ON e.col = a.col
WHERE e.col IS NULL
ORDER BY kind, col;

-- Check 5: Type assertions (should be stable across rows)
SELECT
  (pg_typeof(growth_rate_value) = 'numeric'::regtype) AS growth_rate_value_is_numeric,
  (pg_typeof(growth_rate_label) = 'text'::regtype)    AS growth_rate_label_is_text
FROM public.public_v_home_news
LIMIT 1;