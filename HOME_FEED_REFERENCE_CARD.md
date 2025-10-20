# Home Feed Reference Card
**Quick reference for the home_feed_v1 view contract**

## Status: ✅ OPERATIONAL
- **View**: `public.home_feed_v1` 
- **Rows**: 237 (filtered from 257)
- **API**: Returns 20 items per page
- **Health**: `/api/health/home`

## Column Contract (26 columns)

### Identity & Content
- `id` (text) - UUID
- `title` (text) - Story title
- `summary` (text) - Thai summary
- `summary_en` (text) - English summary
- `category` (text) - Classification

### Source & Platform
- `platform` (text) - Normalized (auto-detects "YouTube")
- `channel` (text) - Channel/creator name
- `source_url` (text) - **Generated from identifiers**
- `video_id` (text) - YouTube video ID
- `external_id` (text) - External platform ID

### AI & Analysis
- `ai_opinion` (text) - AI analysis
- `score_details` (text) - **NOT jsonb** - descriptive text
- `image_url` (text) - AI image (Top-3 only)
- `ai_prompt` (text) - Image prompt (Top-3 only)

### Ranking & Metrics
- `popularity_score` (numeric) - Primary ranking
- `rank` (integer) - Position (1-N)
- `is_top3` (boolean) - rank <= 3
- `views` (bigint) - View count
- `likes` (bigint) - Like count
- `comments` (bigint) - Comment count

### Growth & Meta
- `growth_rate_value` (numeric) - Parsed rate
- `growth_rate_label` (text) - "Rising fast" etc.
- `platform_mentions` (integer) - Cross-platform mentions
- `keywords` (text) - Keyword list
- `published_at` (timestamptz) - Publication date
- `updated_at` (timestamptz) - Last update

## Key Logic

### Source URL Generation
```sql
CASE
  WHEN external_id IS NOT NULL THEN 
    'https://www.youtube.com/watch?v=' || external_id
  WHEN video_id IS NOT NULL THEN 
    'https://www.youtube.com/watch?v=' || video_id
  WHEN source_url IS NOT NULL THEN source_url
  ELSE NULL  -- filtered out
END
```

### Platform Normalization
```sql
CASE
  WHEN external_id IS NOT NULL OR video_id IS NOT NULL 
    THEN 'YouTube'
  ELSE COALESCE(platform, 'Unknown')
END
```

### Ranking
```sql
ORDER BY 
  COALESCE(popularity_score, 0) DESC,
  created_at DESC,
  id
```

### Top-3 Policy
- `image_url`: `CASE WHEN rank <= 3 THEN ai_image_url ELSE NULL END`
- `ai_prompt`: `CASE WHEN rank <= 3 THEN ai_image_prompt ELSE NULL END`
- Frontend enforces: `showImage` and `showAiPrompt` flags

## Filters Applied

### View Level
1. Title present and non-empty
2. At least one identifier: `external_id`, `video_id`, or `source_url`
3. source_url successfully generated (not NULL)

### API Level (mapNews.ts)
1. Valid source_url (non-empty, matches pattern)
2. Valid video_id/external_id format
3. At least one summary (summary or summary_en)

## Security
- **Grants**: SELECT to `anon` and `authenticated`
- **No base table access** from frontend
- **Plan-B compliant**: anon key only
- **SECURITY INVOKER** (default)

## Health Checks
```bash
# View health
curl http://localhost:3000/api/health/home

# Should return:
# - healthy: true
# - row_count >= 20
# - top3_policy.success: true
# - source_urls.success: true
```

## Common Issues & Solutions

### "Missing source_url"
**Cause**: Row lacks external_id, video_id, AND source_url  
**Fix**: Already filtered at view level (20 rows removed)

### "Invalid platform"
**Cause**: Platform column has channel name  
**Fix**: Auto-normalized to "YouTube" when identifiers present

### "JSON parse error"
**Cause**: score_details treated as JSON  
**Fix**: Keep as TEXT type (it's descriptive text)

### "Only 17 items showing"
**Cause**: View not generating source_url for all rows  
**Fix**: Now identifies YouTube via identifiers (not platform name)

## Files
- **View**: `frontend/db/sql/fixes/2025-10-04_home_feed_json_alignment.sql`
- **API**: `frontend/src/app/api/home/route.ts`
- **Health**: `frontend/src/app/api/health/home/route.ts`
- **Mapper**: `frontend/src/lib/mapNews.ts`
- **Constants**: `frontend/src/lib/db/schema-constants.ts`

## Verification
```bash
# Run comprehensive tests
node scripts/verify_home_feed_complete.js

# Expected: 34/35 tests passed (97%)
```

## Last Updated
2025-10-04 - Complete fix applied
