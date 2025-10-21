-- SQL Sanity Checks for Home View Fix

-- Check 1: Count of rows in the view
select count(*) as total_rows from public.public_v_home_news;

-- Check 2: Any rows with NULL source_url (should be 0)
select count(*) as null_source_urls
from public.public_v_home_news 
where source_url is null;

-- Check 3: Sample of source URLs
select id, title, source_url, platform
from public.public_v_home_news 
limit 5;

-- Check 4: Check if EN summaries are present
select count(*) as rows_with_en_summary
from public.public_v_home_news 
where summary_en is not null;

-- Check 5: Check analytics fields presence
select 
  count(*) as total,
  count(rank) as with_rank,
  count(popularity_score) as with_score,
  count(ai_opinion) as with_ai_opinion,
  count(score_details) as with_score_details,
  count(growth_rate_value) as with_growth_rate
from public.public_v_home_news;

-- Check 6: Top 3 verification
select id, title, rank, is_top3, 
  case when image_url is not null then 'Has Image' else 'No Image' end as image_status,
  case when ai_prompt is not null then 'Has Prompt' else 'No Prompt' end as prompt_status
from public.public_v_home_news
where rank <= 5
order by rank;

-- Check 7: Column count and names
select count(*) as column_count
from information_schema.columns
where table_schema = 'public' 
and table_name = 'public_v_home_news';

-- Check 8: Verify 26 columns in correct order
select ordinal_position, column_name, data_type
from information_schema.columns
where table_schema = 'public' 
and table_name = 'public_v_home_news'
order by ordinal_position;
