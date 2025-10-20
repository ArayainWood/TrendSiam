-- ===== SAFE RENAME-SWAP FIX (2025-09-27) =====
-- Fix 42P16, missing source_url, EN summaries, and analytics

-- Step 1: Rename existing views to preserve them
do $$ 
begin
  -- Rename public_v_home_news if exists
  if exists (select 1 from pg_views where schemaname='public' and viewname='public_v_home_news') then
    execute 'alter view public.public_v_home_news rename to public_v_home_news_old_20250927';
  end if;
  
  -- Rename public_v_latest_snapshots if exists
  if exists (select 1 from pg_views where schemaname='public' and viewname='public_v_latest_snapshots') then
    execute 'alter view public.public_v_latest_snapshots rename to public_v_latest_snapshots_old_20250927';
  end if;
  
  -- Rename public_v_ai_images_latest if exists
  if exists (select 1 from pg_views where schemaname='public' and viewname='public_v_ai_images_latest') then
    execute 'alter view public.public_v_ai_images_latest rename to public_v_ai_images_latest_old_20250927';
  end if;
end $$;

-- Step 2: Create helper view - latest snapshot per story
create view public.public_v_latest_snapshots as
with mx as (
  select story_id, max(snapshot_date) as max_date
  from public.snapshots
  group by story_id
)
select s.*
from public.snapshots s
join mx on mx.story_id = s.story_id and mx.max_date = s.snapshot_date;

-- Step 3: Create helper view - latest valid AI image per story
create view public.public_v_ai_images_latest as
select distinct on (f.story_id)
  f.story_id,
  f.file_path as image_url,
  f.last_verified_at
from public.image_files f
where coalesce(f.is_valid, true) = true
order by f.story_id, f.last_verified_at desc nulls last;

-- Step 4: Create main home view with correct joins (26 columns)
create view public.public_v_home_news as
with platform_id as (
  select 
    nt.id as news_id,
    coalesce(nt.video_id, nt.external_id) as platform_id
  from public.news_trends nt
),
joined_data as (
  select
    nt.id,
    nt.title,
    nt.summary,
    coalesce(st.summary_en, nt.summary_en) as summary_en,
    nt.category,
    nt.platform,
    nt.channel,
    coalesce(st.publish_time, nt.published_at) as published_at,
    -- Build source_url from news_trends fields
    case
      when nt.platform = 'YouTube' and nt.external_id is not null
        then 'https://www.youtube.com/watch?v=' || nt.external_id
      when nt.platform = 'YouTube' and nt.video_id is not null
        then 'https://www.youtube.com/watch?v=' || nt.video_id
      else nt.source_url
    end as source_url,
    -- Image handling
    coalesce(img.image_url, nt.ai_image_url) as image_url,
    coalesce(st.ai_image_prompt, nt.ai_image_prompt) as ai_prompt,
    -- Analytics from news_trends (with snapshot updates if available)
    coalesce(snap.popularity_score, nt.popularity_score) as popularity_score,
    coalesce(snap.rank, 
      case 
        when nt.popularity_score is not null 
        then row_number() over (order by nt.popularity_score desc nulls last)
        else null 
      end
    )::integer as rank,
    -- Views/likes/comments from snapshots
    snap.view_count as views,
    snap.like_count as likes,
    snap.comment_count as comments,
    coalesce(snap.growth_rate, nt.growth_rate) as growth_rate_value,
    -- Analytics fields from news_trends
    nt.ai_opinion,
    nt.score_details,
    nt.video_id,
    nt.external_id,
    nt.platform_mentions,
    nt.keywords,
    greatest(
      nt.updated_at, 
      st.updated_at, 
      snap.created_at,
      img.last_verified_at
    ) as updated_at,
    nt.id as nt_id,
    st.story_id,
    pid.platform_id
  from public.news_trends nt
  left join platform_id pid on pid.news_id = nt.id
  left join public.stories st on st.source_id = pid.platform_id
  left join public.public_v_latest_snapshots snap on snap.story_id = st.story_id
  left join public.public_v_ai_images_latest img on img.story_id = st.story_id
  where nt.platform = 'YouTube'  -- Focus on YouTube for now
)
select
  -- Exactly 26 columns in the required order
  id::text,                                              -- 1. id
  title::text,                                           -- 2. title
  summary::text,                                         -- 3. summary
  summary_en::text,                                      -- 4. summary_en
  category::text,                                        -- 5. category
  platform::text,                                        -- 6. platform
  channel::text,                                         -- 7. channel
  published_at::timestamptz,                             -- 8. published_at
  source_url::text,                                      -- 9. source_url
  case                                                   -- 10. image_url (Top-3 only)
    when rank <= 3 then image_url
    else null
  end::text as image_url,
  case                                                   -- 11. ai_prompt (Top-3 only)
    when rank <= 3 then ai_prompt
    else null
  end::text as ai_prompt,
  popularity_score::numeric,                             -- 12. popularity_score
  rank::integer,                                         -- 13. rank
  (rank is not null and rank <= 3)::boolean as is_top3, -- 14. is_top3
  views::bigint,                                         -- 15. views
  likes::bigint,                                         -- 16. likes
  comments::bigint,                                      -- 17. comments
  growth_rate_value::numeric,                            -- 18. growth_rate_value
  case                                                   -- 19. growth_rate_label
    when growth_rate_value is null then 'Not enough data'
    when growth_rate_value >= 0.20 then 'Rising fast'
    when growth_rate_value >= 0.00 then 'Rising'
    when growth_rate_value <= -0.20 then 'Falling fast'
    else 'Falling'
  end::text as growth_rate_label,
  ai_opinion::text,                                      -- 20. ai_opinion
  score_details::jsonb,                                  -- 21. score_details
  video_id::text,                                        -- 22. video_id
  external_id::text,                                     -- 23. external_id
  platform_mentions::integer,                            -- 24. platform_mentions
  keywords::text,                                        -- 25. keywords
  updated_at::timestamptz                                -- 26. updated_at
from joined_data
order by rank asc nulls last, popularity_score desc nulls last;

-- Step 5: Apply Plan-B security grants (anon read-only)
grant select on public.public_v_latest_snapshots to anon;
grant select on public.public_v_ai_images_latest to anon;
grant select on public.public_v_home_news to anon;

-- Ensure anon has no access to base tables
revoke all on public.news_trends from anon;
revoke all on public.stories from anon;
revoke all on public.snapshots from anon;
revoke all on public.image_files from anon;

-- ===== END OF FIX =====

-- Cleanup script (commented out for safety - run manually after verification):
-- drop view if exists public.public_v_home_news_old_20250927;
-- drop view if exists public.public_v_latest_snapshots_old_20250927;
-- drop view if exists public.public_v_ai_images_latest_old_20250927;
