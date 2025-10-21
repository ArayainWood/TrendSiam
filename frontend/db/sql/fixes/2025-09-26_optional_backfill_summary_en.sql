-- Fill stories.summary_en from news_trends when missing (safe backfill).
UPDATE public.stories st
SET summary_en = nt.summary_en
FROM public.news_trends nt
WHERE st.story_id = nt.external_id
  AND st.summary_en IS NULL
  AND nt.summary_en IS NOT NULL;
