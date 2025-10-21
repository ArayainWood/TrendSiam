# Home View Complete Rebuild (2025-09-26)

## Overview
Complete rebuild of `public_v_home_news` to properly source data from all tables and restore missing English summaries, analysis fields, and scores.

## Key Changes

### Data Sourcing Strategy
- **Base**: All rows from `news_trends` table
- **English summaries**: Prioritizes `stories.summary_en`, falls back to `news_trends.summary_en`
- **Analysis fields**: `ai_opinion` and `score_details` now come from latest `snapshots` (not news_trends)
- **Metrics**: Latest snapshot data with safe type casting for text → numeric conversions
- **AI Images**: Joins with `public_v_ai_images_latest` for both image URLs and prompts

### Safe Type Conversions
All text fields from snapshots are safely cast using regex validation:
- `rank`: Validates as integer before casting
- `views/likes/comments`: Validates as numeric before casting to bigint
- `growth_rate`: Strips % symbol and validates as numeric
- `platform_mentions`: Safe integer casting with 0 default
- `score_details`: Validates as JSON object before casting to jsonb

### 26-Column Contract
Maintains exact column order and types expected by frontend:
```
id, title, summary, summary_en, category, platform, channel, published_at, 
source_url, image_url, ai_prompt, popularity_score, rank, is_top3, views, 
likes, comments, growth_rate_value, growth_rate_label, ai_opinion, 
score_details, video_id, external_id, platform_mentions, keywords, updated_at
```

## How to Apply

### 1. Run SQL Files in Supabase SQL Editor

Run these files in order:

```sql
-- 1. Rebuild the main view
frontend/db/sql/fixes/2025-09-26_rebuild_public_v_home_news.sql

-- 2. Verify the view structure and data
frontend/db/sql/fixes/2025-09-26_verify_home_view.sql

-- 3. (Optional) Backfill missing English summaries
frontend/db/sql/fixes/2025-09-26_optional_backfill_summary_en.sql
```

### 2. Test the Application

Start the development server:
```bash
npm run dev
```

### 3. Verify with API Checks

```bash
# Check diagnostics - must show 26 columns, no missingColumns
curl -s http://localhost:3000/api/home/diagnostics | jq

# Check data is present
curl -s http://localhost:3000/api/home | jq '.data | length'

# Check LISA item specifically
curl -s "http://localhost:3000/api/home?q=LISA" | jq '.data[0] | {
  title, 
  summary_en, 
  ai_opinion, 
  popularity_score,
  score_details
}'

# Verify Top-3 have prompts
curl -s http://localhost:3000/api/home | jq '.data[] | select(.is_top3) | {title, ai_prompt}'

# Verify non-Top-3 have NULL prompts
curl -s http://localhost:3000/api/home | jq '.data[] | select(.is_top3 == false) | .ai_prompt' | grep -v null
```

### 4. Run Security Check

```bash
npm run lint:perms
```

## Expected Results

✅ **English summaries** (`summary_en`) restored from stories table  
✅ **Analysis fields** (`ai_opinion`, `score_details`) populated from snapshots  
✅ **Popularity scores** properly retrieved from latest snapshots  
✅ **LISA items** show complete analysis data  
✅ **Top-3 items** expose AI prompts, others have NULL  
✅ **All 26 columns** returned with correct types  
✅ **Plan-B security** maintained: anon reads only views, base tables blocked

## Troubleshooting

If the view returns no data:
1. Check that `news_trends` table has data
2. Verify `snapshots` table has recent entries
3. Ensure `public_v_ai_images_latest` exists

If specific fields are NULL:
1. Run the optional backfill script for `summary_en`
2. Check that snapshots have been generated for the stories
3. Verify the data pipeline has run recently
