# TrendSiam Home Feed Data Contract

**Version**: 1.1 (2025-10-04)  
**Purpose**: Define exact fields required by Latest Stories cards and modals

---

## Overview

This contract defines the data structure for home feed items. All layers (View → API → UI) must conform to this contract.

---

## A) Latest Stories Card Fields

### Identity & Linking
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `text` (UUID) | ✅ Yes | Unique identifier |
| `video_id` | `text` | ✅ Yes | YouTube video ID (e.g., "FMX98ROVRCE") |
| `external_id` | `text` | ✅ Yes | External platform ID |
| `source_url` | `text` (URL) | ✅ Yes | Link to original content |
| `platform` | `text` | ✅ Yes | Platform name (e.g., "YouTube") |
| `channel` | `text` | ✅ Yes | Channel/creator name |

### Content
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `text` | ✅ Yes | Story title |
| `summary` | `text` | ✅ Yes | **Thai summary** (140-350 chars) |
| `summary_en` | `text` | ✅ Yes | **English summary** (140-350 chars) |
| `category` | `text` | ✅ Yes | Category (e.g., "บันเทิง (Entertainment)") |

**Card Display Rules**:
- **Show BOTH summaries** on card (Thai + English)
- Thai summary: Full text, line-clamp-3
- English summary: Truncated to ~100 chars with ellipsis

### Scoring & Metrics
| Field | Type | Required | Range | Description |
|-------|------|----------|-------|-------------|
| `popularity_score` | `numeric` | ✅ Yes | 0-100 | Popularity score (precise decimal) |
| `rank` | `integer` | ✅ Yes | 1-N | Position in trending list |
| `is_top3` / `isTop3` | `boolean` | ✅ Yes | - | Whether item is in top 3 |
| `views` | `bigint` / `number` | ✅ Yes | ≥0 | View count (from base data) |
| `likes` | `bigint` / `number` | ✅ Yes | ≥0 | Like count |
| `comments` | `bigint` / `number` | ✅ Yes | ≥0 | Comment count |

**Card Display Rules**:
- **Score badge**: Show `popularity_score.toFixed(1)` (e.g., "88.4")
- **Score bar**: Fill width = `${Math.min(popularity_score, 100)}%`
- **Views**: Display formatted (e.g., "16.0M views") + increment on modal open

### Images & AI (Top-3 Only)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image_url` / `imageUrl` | `text` (URL) | Conditional | AI-generated image URL (only if `is_top3 = true`) |
| `ai_prompt` / `aiPrompt` | `text` | Conditional | AI image generation prompt (only if `is_top3 = true`) |
| `show_image` / `showImage` | `boolean` | ✅ Yes | Computed flag for image display |
| `show_ai_prompt` / `showAiPrompt` | `boolean` | ✅ Yes | Computed flag for prompt display |

**Top-3 Policy**:
- If `is_top3 = true`: `image_url` and `ai_prompt` must be populated
- If `is_top3 = false`: `image_url` and `ai_prompt` must be NULL

---

## B) Modal "Detailed Analytics" Fields

The modal must display **exactly 4 blocks** in the "Detailed Analytics" section:

### 1. Growth Rate Block
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `growth_rate_value` | `numeric` | Optional | Numeric growth delta (views/hour or similar) |
| `growth_rate_label` | `text` | ✅ Yes | Human-readable label (e.g., "Rising fast", "Viral") |

**Display Logic**:
- If `growth_rate_label` exists → Show label
- If `growth_rate_value` exists → Show with ± prefix (e.g., "+125K/h")
- If both NULL → Show "Not enough data"

**Label Thresholds** (example):
- ≥ 100K/h: "Viral"
- ≥ 20K/h: "Rising fast"
- ≥ 0: "Rising"
- < 0: "Falling"

### 2. Platforms Block
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `platform` | `text` | ✅ Yes | Primary platform (e.g., "YouTube") |
| `platforms` | `text[]` / `text` | Optional | Multiple platforms (if mentioned) |
| `platform_mentions` | `text` / `integer` | Optional | Number of platform mentions |

**Display Logic**:
- If `platforms` array exists → Show as comma-separated list
- Else → Show single `platform`
- Optionally show `platform_mentions` count if > 0

### 3. Keywords Block
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `keywords` | `text` / `text[]` | ✅ Yes | Array of keywords (parsed from JSON or text) |

**Display Logic**:
- Parse keywords (if JSON string, parse to array)
- Render as chips/badges (up to 10 keywords)
- If empty → Show "No keywords"

### 4. AI Opinion Block
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ai_opinion` | `text` | ✅ Yes | AI-generated analysis/opinion (50-200 chars) |

**Display Logic**:
- Show full text if populated
- If NULL or "N/A" → Hide entire block
- **Never show**: "Score Details" (removed from modal)

---

## C) View Contract (`public.home_feed_v1`)

### Expected Columns (26 total)
```sql
1.  id (text) - UUID as text
2.  title (text)
3.  summary (text) - Thai summary
4.  summary_en (text) - English summary
5.  category (text)
6.  platform (text) - Normalized (e.g., "YouTube")
7.  channel (text)
8.  published_at (timestamptz)
9.  source_url (text) - Generated YouTube URL
10. image_url (text) - NULL except Top-3
11. ai_prompt (text) - NULL except Top-3
12. popularity_score (numeric) - 0-100
13. rank (integer) - Position in list
14. is_top3 (boolean)
15. views (bigint) - View count
16. likes (bigint) - Like count
17. comments (bigint) - Comment count
18. growth_rate_value (numeric) - Optional growth delta
19. growth_rate_label (text) - Growth label
20. ai_opinion (text) - AI analysis
21. score_details (text) - **NOT USED IN UI** (kept for data completeness)
22. video_id (text)
23. external_id (text)
24. platform_mentions (integer) - Platform mention count
25. keywords (text) - JSON array as text
26. updated_at (timestamptz)
```

### Critical Type Rules
- **TEXT fields**: `ai_opinion`, `score_details`, `keywords` (stored as TEXT, not jsonb)
- **NUMERIC fields**: `popularity_score`, `growth_rate_value` must be numeric (not text)
- **BIGINT fields**: `views`, `likes`, `comments` must be bigint (not text)
- **Top-3 policy**: `image_url` and `ai_prompt` are NULL for non-Top-3

---

## D) API Contract (`/api/home`)

### Request
```http
GET /api/home HTTP/1.1
```

### Response
```json
{
  "success": true,
  "fetchedCount": 20,
  "top3Count": 3,
  "top3Ids": ["uuid1", "uuid2", "uuid3"],
  "data": [/* array of ApiNewsItem */]
}
```

### ApiNewsItem Schema (camelCase)
```typescript
{
  // Identity
  "id": "uuid",
  "title": "string",
  "videoId": "string",
  "externalId": "string",
  "sourceUrl": "string (URL)",
  "platform": "string",
  "channel": "string",
  
  // Content - BOTH summaries required
  "summary": "string (Thai)",
  "summaryEn": "string (English)",
  "category": "string",
  
  // Scoring & Metrics
  "popularityScore": number (0-100),
  "rank": number (integer),
  "isTop3": boolean,
  "views": number,
  "likes": number,
  "comments": number,
  
  // Growth
  "growthRateValue": number | null,
  "growthRateLabel": "string",
  
  // Analytics
  "aiOpinion": "string",
  "scoreDetails": "string", // Present but NOT displayed in modal
  "keywords": "string" | string[],
  "platformMentions": number | null,
  
  // Images (Top-3 only)
  "imageUrl": "string | null",
  "aiPrompt": "string | null",
  "showImage": boolean,
  "showAiPrompt": boolean,
  
  // Metadata
  "publishedAt": "string (ISO timestamp)",
  "updatedAt": "string (ISO timestamp)",
  
  // Legacy compatibility
  "view_details": {
    "views": "string (formatted)",
    "growth_rate": "string",
    "platform_mentions": "string",
    "score": "string (e.g., '88/100')"
  }
}
```

---

## E) Telemetry API (`/api/telemetry/view`)

### Purpose
Increment view count when user opens modal (once per session per story).

### Request
```http
POST /api/telemetry/view HTTP/1.1
Content-Type: application/json

{
  "video_id": "FMX98ROVRCE",
  "story_id": "uuid" // optional
}
```

### Response
```json
{
  "success": true,
  "views": 16024745 // new count after increment
}
```

### Implementation Rules
- **Server-side only**: Uses `service_role` key (never exposed to client)
- **Idempotency**: Track session/story combo to prevent double-counting
- **Check-before-create**: If row doesn't exist, log but don't fail
- **Atomic**: Use `UPDATE ... SET view_count = view_count + 1`

---

## F) Backfill Rules

### Check-Before-Create Policy
```sql
-- Only update NULL fields
UPDATE news_trends
SET 
  summary_en = CASE WHEN summary_en IS NULL THEN $1 ELSE summary_en END,
  ai_opinion = CASE WHEN ai_opinion IS NULL THEN $2 ELSE ai_opinion END,
  growth_rate_label = CASE WHEN growth_rate_label IS NULL THEN $3 ELSE growth_rate_label END
WHERE id = $4
  AND (summary_en IS NULL OR ai_opinion IS NULL OR growth_rate_label IS NULL);
```

### Never Backfill
- Existing `summary`, `summary_en`, `ai_opinion` (if non-NULL)
- Existing `popularity_score`, `growth_rate_*` (if non-NULL)
- View counts, likes, comments (source of truth from platform)

---

## G) Validation Checklist

### View Layer
- [ ] All 26 columns present with correct types
- [ ] `summary_en` populated for all rows
- [ ] `popularity_score` is numeric 0-100
- [ ] `views` is bigint >= 0
- [ ] Top-3 have `image_url` & `ai_prompt`
- [ ] Non-Top-3 have NULL for `image_url` & `ai_prompt`

### API Layer
- [ ] Both `summary` AND `summary_en` in response
- [ ] `popularityScore` is number (not string)
- [ ] `views` is number (not string)
- [ ] `view_details` object present
- [ ] Top-3 policy enforced

### UI Layer
- [ ] Cards show BOTH Thai + English summaries
- [ ] Score bar fills proportionally (0-100%)
- [ ] Views display and increment on modal open
- [ ] Modal has exactly 4 analytics blocks
- [ ] "Score Details" block removed

---

## Version History

**v1.1 (2025-10-04)**:
- Added explicit requirement for BOTH summaries on card
- Defined exactly 4 modal blocks (removed Score Details)
- Added telemetry API contract
- Added backfill rules

**v1.0 (2025-10-04)**:
- Initial contract based on LISA legacy behavior
- 26-column view contract
- API camelCase mapping
- Top-3 policy enforcement
