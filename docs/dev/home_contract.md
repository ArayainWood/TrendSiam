# TrendSiam Home API Contract

Date: 2024-01-31
Version: 2.0

## Overview

This document defines the stable contract between the database view, API, and frontend for the Home feed. Any changes to this contract must be carefully coordinated across all layers.

## Image Policy

**TrendSiam uses AI-generated images for Top-3 items ONLY**:
- Top-3 items (is_top3=true): May have image_url and ai_prompt
- Non-Top-3 items: MUST have image_url=NULL and ai_prompt=NULL
- **NO THUMBNAILS**: The system does not support thumbnail_url or youtube_thumbnail_url
- External/scraped images are strictly prohibited

## Canonical Field Ownership

### Primary Data Sources
- **news_trends**: Aggregated trending data (primary table)
- **stories**: Master content with canonical titles and metadata
- **snapshots**: Time-series metrics and ranking data
- **ai_images**: AI-generated images linked to news_trends
- **image_files**: Verified image storage linked to stories
- **system_meta**: Configuration values

### Join Keys (Canonical)
```sql
-- Platform ID (external platform identifier)
PLATFORM_ID = COALESCE(news_trends.video_id, news_trends.external_id)

-- news_trends ↔ stories
stories.source_id = PLATFORM_ID

-- stories ↔ snapshots
snapshots.story_id = stories.story_id

-- stories ↔ image_files  
image_files.story_id = stories.story_id

-- news_trends ↔ ai_images
ai_images.news_id = news_trends.id
```

## Database View Contract

### View Name: `public.public_v_home_news`

### Columns (snake_case)
All columns are guaranteed to be present. Types are enforced at the view level.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | text | NO | Unique identifier |
| title | text | NO | Story title |
| summary | text | YES | Thai summary |
| summary_en | text | YES | English summary (fallback to summary) |
| category | text | YES | Content category |
| platform | text | YES | Source platform (YouTube, TikTok, etc.) |
| channel | text | YES | Channel/creator name |
| published_at | timestamptz | YES | Publication timestamp |
| source_url | text | NO | Original content URL (NEVER NULL) |
| image_url | text | YES | AI image URL (NULL except Top-3) |
| ai_prompt | text | YES | AI prompt (NULL except Top-3) |
| popularity_score | numeric | YES | Popularity score (0-100) |
| rank | integer | YES | Rank within the day |
| is_top3 | boolean | NO | True if rank <= top3_max |
| views | bigint | YES | View count |
| likes | bigint | YES | Like count |
| comments | bigint | YES | Comment count |
| growth_rate_value | numeric | YES | Growth rate percentage |
| growth_rate_label | text | NO | Growth label (Surging/Rising/Stable/Cooling) |
| ai_opinion | text | YES | AI analysis |
| score_details | jsonb | YES | Score calculation details |

### View Guarantees
1. **source_url is NEVER NULL** - constructed from video_id/external_id if needed
2. **image_url and ai_prompt are NULL for non-Top-3** - enforced at view level
3. **Day-scoped** - only returns items from current Thai day
4. **Config-driven limits** - respects home_limit and top3_max from system_meta
5. **Valid JSONB** - score_details is always valid JSONB or NULL

## API Contract

### Endpoint: `GET /api/home`

### Response Format (camelCase)
```json
{
  "data": [
    {
      "id": "string",
      "title": "string",
      "summary": "string | null",
      "summaryEn": "string | null",
      "category": "string | null",
      "platform": "string | null",
      "channel": "string | null",
      "publishedAt": "string | null",
      "sourceUrl": "string",
      "imageUrl": "string | null",
      "aiPrompt": "string | null",
      "popularityScore": "number | null",
      "rank": "number | null",
      "isTop3": "boolean",
      "views": "number | null",
      "likes": "number | null",
      "comments": "number | null",
      "growthRateValue": "number | null",
      "growthRateLabel": "string",
      "aiOpinion": "string | null",
      "scoreDetails": "object | null",
      "showImage": "boolean",
      "showAiPrompt": "boolean",
      "videoId": "string | null",
      "externalId": "string | null",
      "platformMentions": "number | null",
      "keywords": "string | null",
      "updatedAt": "string | null"
    }
  ],
  "top3Ids": ["string"],
  "meta": {
    "updatedAt": "string"
  }
}
```

### API Guarantees
1. **All field names are camelCase** - no snake_case in responses
2. **sourceUrl validation** - drops any rows without valid sourceUrl
3. **showImage/showAiPrompt are booleans** - computed from imageUrl/aiPrompt presence
4. **Strict Zod validation** - rejects malformed data with clear errors
5. **Top-3 policy enforced** - non-Top3 items never have imageUrl/aiPrompt

### Debug Endpoint: `GET /api/home?debug=1`
Returns diagnostic information:
```json
{
  "config": { "home_limit": 20, "top3_max": 3 },
  "columnsFromView": ["id", "title", ...],
  "missingColumns": [],
  "counts": {
    "hasSummary": 20,
    "hasSummaryEn": 18,
    "hasCategory": 20,
    "hasSourceUrl": 20,
    "hasImageTop3": 3,
    "hasPromptTop3": 3
  },
  "sampleItemKeys": [...],
  "totalRows": 20,
  "validRows": 20,
  "droppedRows": 0,
  "db_error": null
}
```

## Frontend Contract

### UINewsItem Type
The frontend consumes the camelCase API response directly. The UINewsItem type in `normalizeNewsItem.ts` accepts both camelCase (from API) and snake_case (legacy) but always outputs camelCase.

### Component Requirements
1. **EnhancedNewsCard**
   - Shows summaryEn when language='en', else summary
   - Shows AI image only if showImage=true
   - YouTube button uses sourceUrl directly

2. **NewsDetailModal**
   - Uses sourceUrl for external link
   - Shows AI prompt button only if showAiPrompt=true

## Validation & Testing

### Required Checks
Run these commands to validate the pipeline:

```bash
# TypeScript validation (must return 0 errors)
npm run check:types

# API validation
npm run check:home

# Combined check
npm run check:all
```

### Manual SQL Checks
See `docs/dev/home_view_checklist.md` for SQL validation queries.

## Common Issues & Solutions

### Issue: "No Trending Stories Right Now"
**Causes:**
1. View missing required columns → Check with debug endpoint
2. All rows dropped due to validation → Check droppedRows in debug
3. No data for current Thai day → Check news_trends has today's data

**Solution:**
1. Run `npm run check:home` to identify specific issue
2. Check `/api/home?debug=1` for detailed diagnostics
3. Verify view has all columns using SQL checks

### Issue: "View Original on YouTube" shows undefined
**Cause:** sourceUrl is null or malformed
**Solution:** View guarantees non-NULL source_url; check API validation

### Issue: TypeScript errors
**Cause:** Component using snake_case fields
**Solution:** Update to use camelCase fields from API

## Security Model

Following Plan-B Security Model:
- Frontend/API use anon key (read-only)
- Views grant SELECT to anon role
- No direct table access from frontend
- service_role only for offline Python scripts

## Change Protocol

When modifying the contract:
1. Update this document first
2. Update SQL view maintaining backward compatibility
3. Update API mapping and validation
4. Update frontend types and components
5. Run full validation suite
6. Deploy in order: DB → API → Frontend
