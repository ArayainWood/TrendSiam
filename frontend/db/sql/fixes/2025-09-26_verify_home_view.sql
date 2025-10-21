-- 1) All 26 columns present (names only)
SELECT column_name
FROM information_schema.columns
WHERE table_schema='public' AND table_name='public_v_home_news'
ORDER BY ordinal_position;

-- 2) Coverage of English summaries
SELECT
  COUNT(*)                      AS total_rows,
  COUNT(*) FILTER (WHERE summary_en IS NOT NULL) AS with_summary_en,
  COUNT(*) FILTER (WHERE summary_en IS NULL)     AS missing_summary_en
FROM public.public_v_home_news;

-- 3) LISA sample should include analysis & score
SELECT
  title, summary_en, popularity_score, rank, is_top3,
  (ai_opinion IS NOT NULL) AS has_ai_opinion,
  (score_details IS NOT NULL) AS has_score_json
FROM public.public_v_home_news
WHERE title ILIKE '%LISA%' OR channel ILIKE '%LISA%'
LIMIT 10;

-- 4) Prompt exposure only for Top-3
SELECT
  COUNT(*) FILTER (WHERE is_top3 AND ai_prompt IS NOT NULL) AS top3_with_prompt,
  COUNT(*) FILTER (WHERE NOT is_top3 AND ai_prompt IS NOT NULL) AS non_top3_with_prompt_should_be_zero
FROM public.public_v_home_news;
