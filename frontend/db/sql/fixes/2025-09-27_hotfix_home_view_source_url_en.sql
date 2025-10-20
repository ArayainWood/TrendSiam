-- ===== SAFER RENAME-SWAP PATCH (2025-09-27) =====
do $$ begin
  if exists (select 1 from pg_views where schemaname='public' and viewname='public_v_home_news') then
    execute 'alter view public.public_v_home_news rename to public_v_home_news_old_20250927';
  end if;
end $$;

-- Latest snapshot per story
create or replace view public.public_v_latest_snapshots as
with mx as (
  select story_id, max(snapshot_date) as max_date
  from public.snapshots
  group by story_id
)
select s.*
from public.snapshots s
join mx on mx.story_id = s.story_id and mx.max_date = s.snapshot_date;

-- Latest valid AI image per story
create or replace view public.public_v_ai_images_latest as
select distinct on (f.story_id)
  f.story_id,
  f.file_path       as image_url,
  f.last_verified_at
from public.image_files f
where coalesce(f.is_valid, true) = true
order by f.story_id, f.last_verified_at desc nulls last;

-- Rebuild home view (26 columns)
create view public.public_v_home_news as
with latest as (
  select
    s.story_id, s.rank, s.view_count, s.like_count, s.comment_count,
    s.popularity_score, s.growth_rate, s.keywords, s.platform_mentions,
    s.ai_opinion, s.score_details, s.image_url as snap_image_url,
    s.updated_at as snap_updated_at
  from public.public_v_latest_snapshots s
),
img as (
  select l.story_id, i.image_url, i.last_verified_at
  from public.public_v_ai_images_latest i
  right join (select distinct story_id from public.public_v_latest_snapshots) l
    on l.story_id = i.story_id
)
select
  st.story_id                                           as id,
  st.title,
  st.summary,
  st.summary_en,
  st.category,
  st.platform,
  st.channel,
  st.publish_time                                       as published_at,
  case
    when st.platform = 'YouTube' and st.external_id is not null
      then 'https://www.youtube.com/watch?v=' || st.external_id
    else null
  end                                                   as source_url,
  coalesce(img.image_url, latest.snap_image_url)        as image_url,
  st.ai_image_prompt                                    as ai_prompt,
  latest.popularity_score,
  latest.rank,
  (latest.rank is not null and latest.rank <= 3)        as is_top3,
  latest.view_count                                     as views,
  latest.like_count                                     as likes,
  latest.comment_count                                  as comments,
  latest.growth_rate                                    as growth_rate_value,
  case
    when latest.growth_rate is null then 'Not enough data'
    when latest.growth_rate::numeric >= 0.20 then 'Rising fast'
    when latest.growth_rate::numeric >= 0.00 then 'Rising'
    when latest.growth_rate::numeric <= -0.20 then 'Falling fast'
    else 'Falling'
  end                                                   as growth_rate_label,
  latest.ai_opinion,
  latest.score_details,
  st.video_id,
  st.external_id,
  latest.platform_mentions,
  latest.keywords,
  greatest(st.updated_at, latest.snap_updated_at, coalesce(img.last_verified_at, st.updated_at)) as updated_at
from public.stories st
left join latest on latest.story_id = st.story_id
left join img    on img.story_id    = st.story_id
where st.platform = 'YouTube';

-- Plan-B: anon read-only
grant select on public.public_v_latest_snapshots to anon;
grant select on public.public_v_ai_images_latest to anon;
grant select on public.public_v_home_news        to anon;
-- ===== END =====