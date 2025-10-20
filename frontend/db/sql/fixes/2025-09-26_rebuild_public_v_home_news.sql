-- Rebuild public view powering the Home page (26-column contract, Plan-B safe)

CREATE OR REPLACE VIEW public.public_v_home_news AS
WITH nt AS (
  SELECT * FROM public.news_trends
),
st AS (
  SELECT * FROM public.stories
),
latest_snap AS (
  SELECT x.*
  FROM (
    SELECT s.*,
           ROW_NUMBER() OVER (
             PARTITION BY s.story_id
             ORDER BY s.snapshot_date DESC NULLS LAST, s.created_at DESC NULLS LAST
           ) AS rn
    FROM public.snapshots s
  ) x
  WHERE x.rn = 1
),
ai AS (
  -- latest AI image per news (already exposes ai_prompt)
  SELECT news_id, image_url, ai_prompt, created_at
  FROM public.public_v_ai_images_latest
),
joined AS (
  SELECT
    -- align keys across tables
    COALESCE(nt.external_id, st.story_id, latest_snap.story_id) AS story_key,

    -- identity (frontend expects news_trends.id as id)
    nt.id::text AS id,

    -- titles & summaries (English from stories preferred)
    COALESCE(st.title, nt.title)           AS title,
    COALESCE(st.summary, nt.summary)       AS summary,
    COALESCE(st.summary_en, nt.summary_en) AS summary_en,

    -- taxonomy/meta
    COALESCE(st.category, nt.category)     AS category,
    COALESCE(st.platform, nt.platform)     AS platform,
    COALESCE(st.channel, nt.channel)       AS channel,

    -- publish time & source link
    COALESCE(
      st.publish_time,
      nt.published_at,
      CASE WHEN nt.date IS NOT NULL THEN nt.date::timestamptz ELSE NULL END
    )                                       AS published_at,
    nt.source_url::text                     AS source_url,

    -- image & prompt (AI view first, then fallbacks)
    COALESCE(ai.image_url, nt.ai_image_url)                        AS image_url,
    COALESCE(ai.ai_prompt, st.ai_image_prompt, nt.ai_image_prompt) AS ai_prompt_raw,

    -- metrics from latest snapshot (safe casts: force ::text before regex)
    CASE
      WHEN (latest_snap.rank)::text ~ '^\s*\d+\s*$'
        THEN btrim((latest_snap.rank)::text)::int
      ELSE NULL
    END AS rank,

    CASE
      WHEN (latest_snap.rank)::text ~ '^\s*(1|2|3)\s*$' THEN true
      ELSE false
    END AS is_top3,

    CASE
      WHEN (latest_snap.view_count)::text ~ '^\s*\d+\s*$'
        THEN btrim((latest_snap.view_count)::text)::bigint
      ELSE NULL
    END AS views,

    CASE
      WHEN (latest_snap.like_count)::text ~ '^\s*\d+\s*$'
        THEN btrim((latest_snap.like_count)::text)::bigint
      ELSE NULL
    END AS likes,

    CASE
      WHEN (latest_snap.comment_count)::text ~ '^\s*\d+\s*$'
        THEN btrim((latest_snap.comment_count)::text)::bigint
      ELSE NULL
    END AS comments,

    -- growth rate → numeric with optional %
    CASE
      WHEN (latest_snap.growth_rate)::text ~ '^\s*-?\d+(\.\d+)?\s*%?\s*$'
        THEN REPLACE(btrim((latest_snap.growth_rate)::text), '%','')::numeric
      ELSE NULL
    END AS growth_rate_value,

    CASE
      WHEN (latest_snap.growth_rate)::text ~ '^\s*-?\d+(\.\d+)?\s*%?\s*$'
        THEN CASE
               WHEN REPLACE(btrim((latest_snap.growth_rate)::text), '%','')::numeric >= 0
               THEN 'Growing' ELSE 'Declining'
             END
      ELSE 'Not enough data'
    END AS growth_rate_label,

    latest_snap.ai_opinion AS ai_opinion,

    CASE
      WHEN (latest_snap.score_details)::text ~ '^\s*\{.*\}\s*$'
        THEN latest_snap.score_details::jsonb
      ELSE NULL::jsonb
    END AS score_details,

    -- prefer snapshot popularity_score, fallback to nt.popularity_score
    COALESCE(latest_snap.popularity_score, nt.popularity_score)::numeric AS popularity_score,

    -- ids & misc
    nt.video_id                              AS video_id,        -- stories.video_id does NOT exist
    COALESCE(st.story_id, nt.external_id)    AS external_id,

    CASE
      WHEN (latest_snap.platform_mentions)::text ~ '^\s*\d+\s*$'
        THEN btrim((latest_snap.platform_mentions)::text)::int
      ELSE 0
    END AS platform_mentions,

    COALESCE(latest_snap.keywords::text, nt.keywords::text) AS keywords,

    COALESCE(latest_snap.updated_at, st.updated_at, nt.updated_at)::timestamptz AS updated_at
  FROM nt
  LEFT JOIN st           ON st.story_id = nt.external_id
  LEFT JOIN latest_snap  ON latest_snap.story_id = COALESCE(nt.external_id, st.story_id)
  -- ai_images may store uuid; compare as text to avoid type mismatch
  LEFT JOIN ai           ON ai.news_id::text IN (nt.id::text, COALESCE(st.story_id, latest_snap.story_id))
)
SELECT
  id::text                      AS id,
  title::text                   AS title,
  summary::text                 AS summary,
  summary_en::text              AS summary_en,
  category::text                AS category,
  platform::text                AS platform,
  channel::text                 AS channel,
  published_at                  AS published_at,
  source_url::text              AS source_url,
  image_url::text               AS image_url,
  CASE WHEN is_top3 THEN ai_prompt_raw ELSE NULL END::text AS ai_prompt,
  popularity_score::numeric     AS popularity_score,
  rank::int                     AS rank,
  is_top3::boolean              AS is_top3,
  views::bigint                 AS views,
  likes::bigint                 AS likes,
  comments::bigint              AS comments,
  growth_rate_value::numeric    AS growth_rate_value,
  growth_rate_label::text       AS growth_rate_label,
  ai_opinion::text              AS ai_opinion,
  score_details::jsonb          AS score_details,
  video_id::text                AS video_id,
  external_id::text             AS external_id,
  platform_mentions::int        AS platform_mentions,
  keywords::text                AS keywords,
  updated_at                    AS updated_at
FROM joined;

-- Plan-B: definer semantics + grants
ALTER VIEW public.public_v_home_news SET (security_invoker = false);
ALTER VIEW public.public_v_home_news OWNER TO postgres;
REVOKE ALL ON public.public_v_home_news FROM PUBLIC;
GRANT SELECT ON public.public_v_home_news TO anon, authenticated;

-- Keep base tables blocked for anon
REVOKE SELECT ON public.news_trends, public.snapshots, public.stories FROM anon, authenticated;
