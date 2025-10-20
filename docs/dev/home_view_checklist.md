# Home View SQL Checklist

Date: 2024-01-31
SQL File: frontend/db/sql/fixes/2025-08-31_emergency_view_fix_v4.sql

## Pre-Application Checklist

- [ ] Backup existing view definition
- [ ] Verify no active connections using the view
- [ ] Apply the v4 SQL script in Supabase SQL Editor
- [ ] Run all self-checks below

## Self-Check Results

### CHECK 1: Column Contract Verification
Run:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'public_v_home_news'
ORDER BY ordinal_position;
```

Expected columns (21 total):
- [x] id (text)
- [x] title (text)
- [x] summary (text)
- [x] summary_en (text)
- [x] category (text)
- [x] platform (text)
- [x] channel (text)
- [x] published_at (timestamp with time zone)
- [x] source_url (text)
- [x] image_url (text)
- [x] ai_prompt (text)
- [x] popularity_score (numeric)
- [x] rank (integer)
- [x] is_top3 (boolean)
- [x] views (bigint)
- [x] likes (bigint)
- [x] comments (bigint)
- [x] growth_rate_value (numeric)
- [x] growth_rate_label (text)
- [x] ai_opinion (text)
- [x] score_details (jsonb)

Result: _[Paste actual column list here]_

### CHECK 2: Data Constraints
Run:
```sql
SELECT 
  COUNT(*) AS total_rows,
  COUNT(CASE WHEN source_url IS NULL OR source_url = '' THEN 1 END) AS null_source_urls,
  COUNT(CASE WHEN is_top3 = true THEN 1 END) AS top3_count,
  COUNT(CASE WHEN is_top3 = true AND image_url IS NOT NULL THEN 1 END) AS top3_with_image,
  COUNT(CASE WHEN is_top3 = true AND ai_prompt IS NOT NULL THEN 1 END) AS top3_with_prompt,
  COUNT(CASE WHEN is_top3 = false AND image_url IS NOT NULL THEN 1 END) AS non_top3_with_image,
  COUNT(CASE WHEN is_top3 = false AND ai_prompt IS NOT NULL THEN 1 END) AS non_top3_with_prompt
FROM public.public_v_home_news;
```

Expected:
- null_source_urls: 0 (MUST be 0)
- top3_count: <= configured top3_max
- non_top3_with_image: 0 (MUST be 0)
- non_top3_with_prompt: 0 (MUST be 0)

Result: _[Paste actual counts here]_

### CHECK 3: Config-Driven Limits
Run:
```sql
SELECT 
  (SELECT value::int FROM system_meta WHERE key='home_limit') AS configured_home_limit,
  (SELECT value::int FROM system_meta WHERE key='top3_max') AS configured_top3_max,
  COUNT(*) AS actual_row_count,
  COUNT(CASE WHEN is_top3 = true THEN 1 END) AS actual_top3_count
FROM public.public_v_home_news;
```

Expected:
- actual_row_count <= configured_home_limit
- actual_top3_count = configured_top3_max (or less if insufficient data)

Result: _[Paste actual values here]_

### CHECK 4: Sample Data Quality
Run:
```sql
SELECT 
  id,
  title,
  CASE WHEN summary IS NOT NULL THEN '✓' ELSE '✗' END AS has_summary,
  CASE WHEN summary_en IS NOT NULL THEN '✓' ELSE '✗' END AS has_summary_en,
  category,
  platform,
  channel,
  source_url,
  rank,
  is_top3,
  CASE WHEN image_url IS NOT NULL THEN '✓' ELSE '✗' END AS has_image,
  CASE WHEN ai_prompt IS NOT NULL THEN '✓' ELSE '✗' END AS has_prompt
FROM public.public_v_home_news
ORDER BY rank
LIMIT 5;
```

Expected:
- All rows have non-NULL title and source_url
- Top-3 rows (is_top3=true) may have image_url and ai_prompt
- Non-Top-3 rows MUST NOT have image_url or ai_prompt

Result: _[Paste sample rows here]_

### CHECK 5: Source URL Patterns
Run:
```sql
SELECT 
  source_url,
  CASE 
    WHEN source_url LIKE 'https://www.youtube.com/watch?v=%' THEN 'YouTube'
    WHEN source_url LIKE 'https://youtu.be/%' THEN 'YouTube Short'
    WHEN source_url LIKE 'https://trendsiam.com/story/%' THEN 'Fallback'
    ELSE 'Other'
  END AS url_type
FROM public.public_v_home_news
LIMIT 10;
```

Expected:
- Most URLs should be YouTube format
- Fallback URLs only when no video_id/external_id available
- No NULL or empty source_urls

Result: _[Paste URL samples here]_

### CHECK 6: JSONB Validity
Run:
```sql
SELECT 
  id,
  pg_typeof(score_details) AS score_details_type,
  jsonb_typeof(score_details) AS jsonb_type,
  CASE 
    WHEN score_details IS NULL THEN 'NULL'
    WHEN jsonb_typeof(score_details) = 'object' THEN 'Valid Object'
    WHEN jsonb_typeof(score_details) = 'array' THEN 'Valid Array'
    ELSE 'Invalid'
  END AS validity
FROM public.public_v_home_news
WHERE score_details IS NOT NULL
LIMIT 5;
```

Expected:
- All non-NULL score_details should be valid JSONB (object or array)
- No text strings masquerading as JSONB

Result: _[Paste JSONB check results here]_

## Post-Application Verification

- [ ] API endpoint /api/home returns data
- [ ] No TypeScript errors in console
- [ ] Home page displays stories
- [ ] Top-3 stories show AI images
- [ ] YouTube links work correctly
- [ ] No "undefined" values in UI
