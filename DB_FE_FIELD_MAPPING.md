# TrendSiam: Complete DB ↔ Frontend Field Mapping
**Date**: 2025-10-09  
**Purpose**: Canonical reference for field names across data pipeline  
**Compliance**: Playbook 2.0, Plan-B Security, Phase 7 Naming Audit

---

## Naming Policy

### Standards
- **Database (SQL, Views, RPC)**: `snake_case` ONLY
- **Frontend (TypeScript, React)**: `camelCase` ONLY
- **Python (ETL, Scripts)**: `snake_case` ONLY
- **Environment Variables**: `SCREAMING_SNAKE_CASE`

### Rules
1. **NO DUPLICATES**: Before adding a field, search entire codebase for similar names
2. **Compatibility Aliases**: Use view-layer aliases for backward compatibility instead of duplicating columns
3. **Centralized Mapping**: All transformations happen in `frontend/src/lib/mapNews.ts`
4. **Type Safety**: Zod schemas enforce structure; optional fields use `.nullable().optional()`
5. **Reserved Names**: See section below for names that must NOT be reused

---

## Core Entity: News/Story Item

### Primary Identity Fields

| Database (snake_case) | Frontend (camelCase) | Type | Source | Notes |
|---|---|---|---|---|
| `id` | `id` | text (UUID) | news_trends.id | Primary key, stable across runs |
| `video_id` | `videoId` | text | news_trends.video_id | Platform video ID (YouTube) |
| `external_id` | `externalId` | text | news_trends.external_id | External platform ID |
| `story_id` | N/A | text | stories.story_id | Legacy linking field (stories table empty) |

### Content Fields

| Database (snake_case) | Frontend (camelCase) | Type | Source | Notes |
|---|---|---|---|---|
| `title` | `title` | text | news_trends.title | Story headline |
| `summary` | `summary` | text | news_trends.summary | Thai summary |
| `summary_en` | `summaryEn` | text | COALESCE(stories.summary_en, news_trends.summary_en) | English summary with fallback |
| `category` | `category` | text | news_trends.category | Classification (e.g., "Entertainment", "News") |
| `keywords` | `keywords` | text | news_trends.keywords | Comma-separated keywords |
| `ai_opinion` | `aiOpinion` | text | COALESCE(snapshots.ai_opinion, news_trends.ai_opinion) | AI-generated analysis |

### Platform & Attribution

| Database (snake_case) | Frontend (camelCase) | Type | Source | Notes |
|---|---|---|---|---|
| `platform` | `platform` | text | news_trends.platform | Normalized to "YouTube" |
| `channel` | `channel` | text | news_trends.channel | Content creator name |
| `source_url` | `sourceUrl` | text | Generated from external_id/video_id | Direct link to original content |
| `platform_mentions` | `platformMentions` | text | COALESCE(snapshots.platform_mentions, news_trends.platform_mentions) | Text description, NOT integer |

### Timestamps

| Database (snake_case) | Frontend (camelCase) | Type | Source | Notes |
|---|---|---|---|---|
| `published_at` | `publishedAt` | timestamptz | COALESCE(stories.publish_time, news_trends.published_date) | Platform publish date (DISPLAY ONLY - Story Details, never ranking) FIXED 2025-10-10: was published_at (NULL), now published_date (valid) |
| `snapshot_date` | `snapshotDate` | date | COALESCE(news_trends.date, DATE(news_trends.created_at AT TIME ZONE 'Asia/Bangkok')) | Our ingestion/snapshot date (RANKING/FILTERING ONLY - Thai TZ, not shown in UI) |
| `created_at` | `createdAt` | timestamptz | news_trends.created_at | Ingestion timestamp |
| `updated_at` | `updatedAt` | timestamptz | GREATEST(...) | Latest modification across tables |

---

## Engagement Metrics

### Platform Metrics (YouTube)

| Database (snake_case) | Frontend (camelCase) | Type | Source | Notes |
|---|---|---|---|---|
| `video_views` | `videoViews` | bigint | COALESCE(snapshots.view_count, news_trends.view_count) | Platform video views (YouTube) |
| `views` | `views` | bigint | ALIAS of video_views | **LEGACY COMPATIBILITY** - DO NOT USE for new code |
| `view_count` | N/A (backend only) | text→bigint | news_trends.view_count | Raw storage (text for flexibility), cast to bigint |
| `likes` | `likes` | bigint | news_trends.like_count cast | YouTube likes |
| `like_count` | N/A (backend only) | text→bigint | news_trends.like_count | Raw storage |
| `comments` | `comments` | bigint | news_trends.comment_count cast | YouTube comments |
| `comment_count` | N/A (backend only) | text→bigint | news_trends.comment_count | Raw storage |

### Site Metrics (TrendSiam)

| Database (snake_case) | Frontend (camelCase) | Type | Source | Notes |
|---|---|---|---|---|
| `site_click_count` | `webViewCount` | integer | news_trends.site_click_count | TrendSiam site clicks (telemetry) |
| `web_view_count` | `webViewCount` | integer | ALIAS in home_feed_v1 | View-layer alias of site_click_count |

### Computed Rates

| Database (snake_case) | Frontend (camelCase) | Type | Source | Notes |
|---|---|---|---|---|
| `growth_rate_value` | `growthRateValue` | numeric | Parsed from snapshots/news_trends.growth_rate | Views per day |
| `growth_rate_label` | `growthRateLabel` | text | CASE expression on growth_rate_value | "Viral (>1M/day)", "High (>100K/day)", etc. |
| `growth_rate` | N/A (backend only) | text | news_trends.growth_rate | Raw text storage |

---

## Scoring & Ranking

| Database (snake_case) | Frontend (camelCase) | Type | Source | Notes |
|---|---|---|---|---|
| `popularity_score` | `popularityScore` | numeric | news_trends.popularity_score | Range 0-100 |
| `rank` | `rank` | integer | ROW_NUMBER() OVER (...) | Position within date (1-based) |
| `is_top3` | `isTop3` | boolean | (rank <= 3) | Flag for Top-3 items |
| `score_details` | `scoreDetails` | text (not JSON) | news_trends.score_details | Descriptive text, NOT JSONB |

---

## Images & AI Content

| Database (snake_case) | Frontend (camelCase) | Type | Source | Notes |
|---|---|---|---|---|
| `ai_image_url` | `imageUrl` | text | Top-3 only: COALESCE(ai_generated_image, platform_thumbnail) | AI or platform thumbnail |
| `ai_generated_image` | N/A (view helper) | text | public_v_ai_images_latest.image_url | AI-generated image path |
| `platform_thumbnail` | N/A (view helper) | text | news_trends.ai_image_url | Platform thumbnail (historical name) |
| `ai_prompt` | `aiPrompt` | text | COALESCE(img.ai_prompt, st.ai_image_prompt, nt.ai_image_prompt) | Top-3 only |
| `ai_image_prompt` | N/A (backend only) | text | news_trends.ai_image_prompt | Raw storage |
| `show_image` | `showImage` | boolean | Computed in FE | Policy flag: is_top3 && image_url present |
| `show_ai_prompt` | `showAiPrompt` | boolean | Computed in FE | Policy flag: is_top3 && ai_prompt present |

---

## Frontend-Only Fields (Computed)

| Field (camelCase) | Type | Source | Notes |
|---|---|---|---|
| `popularityNarrative` | string | generatePopularityNarrative() | Sentence describing performance |
| `engagementRate` | number | (likes / video_views) * 100 | Like rate percentage |
| `commentRate` | number | (comments / video_views) * 100 | Comment rate percentage |

---

## Reserved Names (DO NOT REUSE)

These names have specific meanings and must NOT be used for different purposes:

**Identity:**
- `id`, `story_id`, `video_id`, `external_id`

**Metrics (Platform):**
- `views`, `video_views`, `view_count` (use `videoViews` FE, `video_views` DB)
- `likes`, `like_count`
- `comments`, `comment_count`

**Metrics (Site):**
- `web_view_count`, `site_click_count` (use `webViewCount` FE, `site_click_count` DB canonical)

**Timestamps:**
- `published_at`, `snapshot_date`, `created_at`, `updated_at`

**Scoring:**
- `popularity_score`, `rank`, `is_top3`, `score_details`

**Images:**
- `ai_image_url`, `ai_prompt`, `image_url`, `show_image`, `show_ai_prompt`

---

## Known Ambiguities & Resolutions

### 1. `views` vs `video_views` vs `web_view_count`

**Problem**: Three similar names caused confusion  
**Resolution**:
- **`video_views`** (DB) / **`videoViews`** (FE) = YouTube/platform views (CANONICAL)
- **`views`** = Legacy alias of `video_views` for backward compatibility (deprecated, avoid in new code)
- **`web_view_count`** (DB) / **`webViewCount`** (FE) = TrendSiam site clicks (telemetry)

**Action**: Use `videoViews` for platform, `webViewCount` for site; never use `views` in new code

### 2. `published_at` vs `snapshot_date` (CRITICAL - Updated 2025-10-10)

**Problem**: Both timestamps, completely different purposes, frequently confused  
**Resolution**:
- **`published_at`** = Platform's original publish date (YouTube upload date)
  - **USE FOR**: Display-only (Story Details "Published" label)
  - **NEVER USE FOR**: Ranking, filtering, determining "today"
  - **Fallback**: If NULL, show placeholder "—" (do NOT substitute with snapshot_date or created_at)
- **`snapshot_date`** = Our ingestion/capture date (Thai TZ)
  - **USE FOR**: Filtering/ranking ONLY (determining "today's snapshot")
  - **NEVER USE FOR**: Display in UI (internal use only)
  - **Source**: `news_trends.date` (if exists) or computed from `created_at AT TIME ZONE 'Asia/Bangkok'`

**Why Both Are Needed:**
```
Scenario: Old viral video
- Platform published: October 1, 2025 (platform_date)
- We ingested: October 10, 2025 (snapshot_date - today)
- Home ranking: Uses snapshot_date (Oct 10) → appears in today's feed ✅
- Story Details: Shows published_at (Oct 1) → correct attribution ✅
```

**Critical Policy (2025-10-10):**
```
Home Feed Freshness = BY SNAPSHOT_DATE (when we captured), NOT published_at (when platform published)
Story Details Label = SHOWS published_at (when platform published), NOT snapshot_date (when we captured)
```

**Action**: 
- Home API: Filter/rank by `snapshot_date` (Thai TZ)
- Story Details: Display `published_at` (or "—" if missing)
- NEVER mix these fields or substitute one for the other

### 3. `ai_image_url` historical misname

**Problem**: Column `news_trends.ai_image_url` actually stores platform thumbnails, not AI images  
**Resolution**:
- **`ai_generated_image`** = True AI-generated image from `public_v_ai_images_latest`
- **`platform_thumbnail`** = Platform thumbnail from `news_trends.ai_image_url`
- **`image_url`** (FE) = COALESCE of above (AI preferred)

**Action**: Views use helper columns; FE sees unified `image_url`

### 4. `platform_mentions` type confusion

**Problem**: Name suggests integer; actual type is TEXT (descriptive)  
**Resolution**: Keep as text; contains "Facebook, Instagram, Twitter/X..." lists

**Action**: Do NOT cast to integer; display as-is

---

## Mapping Layer Architecture

### View Transformations (`public_v_home_news`)

```sql
-- Example: score distribution buckets
CASE
  WHEN popularity_score >= 95 THEN 'Top Tier'
  WHEN popularity_score >= 85 THEN 'Excellent'
  -- ...
END AS score_tier  -- Not exposed to FE

-- Example: Thai TZ date for filtering
DATE(published_at AT TIME ZONE 'Asia/Bangkok') AS item_date_helper
```

### TypeScript Mapping (`frontend/src/lib/mapNews.ts`)

```typescript
export function mapDbToApi(dbRow: DbHomeRow): ApiNewsItem {
  return {
    id: dbRow.id,
    title: dbRow.title,
    videoViews: dbRow.video_views,  // snake_case → camelCase
    webViewCount: dbRow.web_view_count ?? 0,  // nullish coalesce
    popularityScore: dbRow.popularity_score,
    // ... 28+ fields
  }
}
```

### Zod Schemas (`mapNews.ts`)

```typescript
const DbHomeRowSchema = z.object({
  id: z.string(),
  video_views: z.number().nullable().optional(),  // DB snake_case
  web_view_count: z.number().nullable().optional(),
  // ...
})

const ApiNewsItemSchema = z.object({
  id: z.string(),
  videoViews: z.number(),  // FE camelCase
  webViewCount: z.number(),
  // ...
})
```

---

## Change Process

When adding a new field:

1. **Search**: `grep -r "field_name" . --exclude-dir={node_modules,.next}`
2. **Check duplicates**: Ensure no similar names exist
3. **Add to DB**: Idempotent migration, nullable or default value
4. **Update view**: Add to `public_v_home_news` SELECT list with DEFINER security
5. **Bump version**: `system_meta.home_view_version = '2025-MM-DD_description'`
6. **Add mapping**: Update `mapNews.ts` with snake_case → camelCase
7. **Add schema**: Update Zod schemas with `.nullable().optional()`
8. **Update this doc**: Add row to appropriate table above
9. **Update Memory Bank**: Document in `03_frontend_homepage_freshness.mb`

---

## Verification Queries

### Check DB Column Names
```sql
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'home_feed_v1'
ORDER BY ordinal_position;
```

### Check FE Type Definitions
```bash
grep -A 50 "interface.*NewsItem" frontend/src/lib/schema/news.ts
```

### Validate Mapping Consistency
```bash
node frontend/scripts/verify-field-mapping.mjs  # (TODO: create this)
```

---

## Summary

- **Total DB fields**: 29 in home_feed_v1 (updated 2025-10-10: added `snapshot_date`)
- **Total FE fields**: ~31+ (includes computed)
- **Aliases for compatibility**: 2 (`views`, `web_view_count`)
- **Reserved names**: 22+ (includes `snapshot_date`)
- **Known ambiguities resolved**: 4

**Last Updated**: 2025-10-10  
**Maintained By**: TrendSiam Team  
**Review Frequency**: Every schema change

**Critical Updates (2025-10-10):**
- Added `snapshot_date` field (ingestion/ranking date)
- Clarified `published_at` vs `snapshot_date` usage (NEVER mix)
- Updated ranking policy: freshness-first by `snapshot_date`, NOT `published_at`

