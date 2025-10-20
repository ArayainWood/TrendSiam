-- ===== Sanity Checks for Type-Safe Home View Fix =====

-- Check 1: Verify column count (should be exactly 26)
select count(*) as column_count
from information_schema.columns
where table_schema = 'public' 
and table_name = 'public_v_home_news';

-- Check 2: Verify column order and data types match 26-column contract
select 
  ordinal_position,
  column_name,
  data_type,
  case 
    when ordinal_position = 1 and column_name = 'id' and data_type = 'text' then 'PASS'
    when ordinal_position = 2 and column_name = 'title' and data_type = 'text' then 'PASS'
    when ordinal_position = 3 and column_name = 'summary' and data_type = 'text' then 'PASS'
    when ordinal_position = 4 and column_name = 'summary_en' and data_type = 'text' then 'PASS'
    when ordinal_position = 5 and column_name = 'category' and data_type = 'text' then 'PASS'
    when ordinal_position = 6 and column_name = 'platform' and data_type = 'text' then 'PASS'
    when ordinal_position = 7 and column_name = 'channel' and data_type = 'text' then 'PASS'
    when ordinal_position = 8 and column_name = 'published_at' and data_type like 'timestamp%' then 'PASS'
    when ordinal_position = 9 and column_name = 'source_url' and data_type = 'text' then 'PASS'
    when ordinal_position = 10 and column_name = 'image_url' and data_type = 'text' then 'PASS'
    when ordinal_position = 11 and column_name = 'ai_prompt' and data_type = 'text' then 'PASS'
    when ordinal_position = 12 and column_name = 'popularity_score' and data_type = 'numeric' then 'PASS'
    when ordinal_position = 13 and column_name = 'rank' and data_type = 'integer' then 'PASS'
    when ordinal_position = 14 and column_name = 'is_top3' and data_type = 'boolean' then 'PASS'
    when ordinal_position = 15 and column_name = 'views' and data_type = 'bigint' then 'PASS'
    when ordinal_position = 16 and column_name = 'likes' and data_type = 'bigint' then 'PASS'
    when ordinal_position = 17 and column_name = 'comments' and data_type = 'bigint' then 'PASS'
    when ordinal_position = 18 and column_name = 'growth_rate_value' and data_type = 'numeric' then 'PASS'
    when ordinal_position = 19 and column_name = 'growth_rate_label' and data_type = 'text' then 'PASS'
    when ordinal_position = 20 and column_name = 'ai_opinion' and data_type = 'text' then 'PASS'
    when ordinal_position = 21 and column_name = 'score_details' and data_type = 'jsonb' then 'PASS'
    when ordinal_position = 22 and column_name = 'video_id' and data_type = 'text' then 'PASS'
    when ordinal_position = 23 and column_name = 'external_id' and data_type = 'text' then 'PASS'
    when ordinal_position = 24 and column_name = 'platform_mentions' and data_type = 'integer' then 'PASS'
    when ordinal_position = 25 and column_name = 'keywords' and data_type = 'text' then 'PASS'
    when ordinal_position = 26 and column_name = 'updated_at' and data_type like 'timestamp%' then 'PASS'
    else 'FAIL'
  end as validation_status
from information_schema.columns
where table_schema = 'public' 
and table_name = 'public_v_home_news'
order by ordinal_position;

-- Check 3: Verify no NULL source_url for YouTube videos
select count(*) as null_source_url_count
from public.public_v_home_news 
where platform = 'YouTube' and source_url is null;

-- Check 4: Sample YouTube source URLs
select id, title, source_url, external_id
from public.public_v_home_news 
where platform = 'YouTube'
limit 5;

-- Check 5: Verify growth_rate_value is numeric and label is computed correctly
select 
  id,
  title,
  growth_rate_value,
  pg_typeof(growth_rate_value) as growth_rate_type,
  growth_rate_label,
  case 
    when growth_rate_value is null and growth_rate_label = 'Not enough data' then 'PASS'
    when growth_rate_value >= 0.20 and growth_rate_label = 'Rising fast' then 'PASS'
    when growth_rate_value >= 0.00 and growth_rate_value < 0.20 and growth_rate_label = 'Rising' then 'PASS'
    when growth_rate_value <= -0.20 and growth_rate_label = 'Falling fast' then 'PASS'
    when growth_rate_value < 0.00 and growth_rate_value > -0.20 and growth_rate_label = 'Falling' then 'PASS'
    else 'FAIL'
  end as label_validation
from public.public_v_home_news
limit 10;

-- Check 6: Count rows with properly cast numeric fields
select 
  count(*) as total_rows,
  count(popularity_score) as rows_with_popularity_score,
  count(case when pg_typeof(popularity_score) = 'numeric'::regtype then 1 end) as numeric_popularity_scores,
  count(rank) as rows_with_rank,
  count(case when pg_typeof(rank) = 'integer'::regtype then 1 end) as integer_ranks,
  count(growth_rate_value) as rows_with_growth_rate,
  count(case when pg_typeof(growth_rate_value) = 'numeric'::regtype then 1 end) as numeric_growth_rates
from public.public_v_home_news;

-- Check 7: Verify Top-3 image/prompt policy
select 
  id,
  title,
  rank,
  is_top3,
  case when image_url is not null then 'HAS_IMAGE' else 'NO_IMAGE' end as image_status,
  case when ai_prompt is not null then 'HAS_PROMPT' else 'NO_PROMPT' end as prompt_status,
  case 
    when rank <= 3 and is_top3 = true then 'PASS'
    when rank > 3 and is_top3 = false then 'PASS'
    when rank is null and is_top3 = false then 'PASS'
    else 'FAIL'
  end as top3_validation,
  case 
    when rank > 3 and (image_url is not null or ai_prompt is not null) then 'FAIL - Non-Top3 has image/prompt'
    else 'PASS'
  end as image_policy_validation
from public.public_v_home_news
where rank is not null
order by rank
limit 10;

-- Check 8: Summary of data quality
select 
  'Total Rows' as metric,
  count(*)::text as value
from public.public_v_home_news
union all
select 
  'Rows with EN Summary' as metric,
  count(*)::text as value
from public.public_v_home_news
where summary_en is not null
union all
select 
  'Rows with Analytics (ai_opinion)' as metric,
  count(*)::text as value
from public.public_v_home_news
where ai_opinion is not null
union all
select 
  'Rows with Score Details' as metric,
  count(*)::text as value
from public.public_v_home_news
where score_details is not null
union all
select 
  'Top 3 Stories' as metric,
  count(*)::text as value
from public.public_v_home_news
where is_top3 = true;
