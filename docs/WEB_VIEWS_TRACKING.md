# Web Views Tracking System

**Version**: 1.0  
**Date**: 2025-10-06  
**Status**: Production Ready  

---

## ⚠️ Known Limitation: Views Separation (Updated 2025-10-08)

**Current State**: `news_trends.view_count` contains **YouTube views + site clicks combined**

**Impact**:
- Card click increment (+1) not visible when base is millions (e.g., 4.9M YouTube views)
- `web_view_count` shows combined metric, not pure site tracking
- No separate column for site-only click count

**Root Cause**: Data model limitation where `view_count` serves dual purpose:
1. Initially populated with YouTube/platform views from API
2. Incremented by telemetry route when users click cards (`/api/telemetry/view`)

**Recommended Solution** (future work):
```sql
-- Add dedicated site tracking column
ALTER TABLE news_trends ADD COLUMN site_click_count INTEGER DEFAULT 0;

-- Update telemetry route to increment site_click_count instead
-- Map web_view_count from site_click_count in views
-- Keep views from original view_count (YouTube baseline)
```

**Workaround**: Accept combined metric and label as "Total Views" rather than "Site Views"

---

## Overview

TrendSiam tracks **site page views** (how many times users click/open stories) separately from **YouTube views** (external platform metrics). This document describes the complete web views tracking system.

**Key Features**:
- ✅ Persistent database storage
- ✅ Session-based deduplication
- ✅ IP-based rate limiting
- ✅ Atomic increment operations
- ✅ Graceful fallback handling
- ✅ Real-time UI updates

---

## Architecture

### Data Flow

```
User Clicks Card (Grid)
  ↓
handleCardClick() [page.tsx]
  ↓ (async, non-blocking)
POST /api/telemetry/view
  ↓
Rate Limit Check (IP)
  ↓ (if allowed)
Supabase (service_role)
  ↓
news_trends.view_count += 1
  ↓
Return new count
  ↓
SessionStorage mark (dedupe)
  ↓ (next page load)
GET /api/home
  ↓
home_feed_v1.web_view_count
  ↓ (mapped to camelCase)
API response: webViewCount
  ↓
UI: NewsCard displays count
```

### Components

#### 1. Frontend Tracking (`page.tsx`)

**Location**: `frontend/src/app/page.tsx` (lines 356-391)

**Trigger**: Card click in "Latest Stories" grid

**Logic**:
```typescript
const handleCardClick = () => {
  // 1. Check session dedupe
  const sessionKey = `card_view_${story.video_id}`
  if (!sessionStorage.getItem(sessionKey)) {
    // 2. Fire async (don't block modal)
    fetch('/api/telemetry/view', { ... })
    // 3. Mark tracked
    sessionStorage.setItem(sessionKey, Date.now())
  }
  // 4. Open modal
  onViewDetails(story)
}
```

**Dedupe Window**: Session lifetime (typically 30min-12h browser setting)

**Behavior**:
- ✅ First click: Tracks + opens modal
- ⏭️ Subsequent clicks: Skips tracking, opens modal
- 🔄 New session: Tracks again

#### 2. Telemetry API (`/api/telemetry/view`)

**Location**: `frontend/src/app/api/telemetry/view/route.ts`

**Method**: POST

**Request**:
```json
{
  "video_id": "FMX98ROVRCE",
  "story_id": "uuid" // optional
}
```

**Response** (Success):
```json
{
  "success": true,
  "views": 16024746
}
```

**Response** (Rate Limited):
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retryAfter": 3456
}
```

**Rate Limiting**:
- **Limit**: 100 requests per IP per hour
- **Window**: Rolling 60-minute window
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Status**: 429 when exceeded

**Security**:
- Uses `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- Never exposed to client
- Atomic increment (no race conditions)

**Error Handling**:
- 400: Missing video_id
- 404: Story not found (graceful, returns 0)
- 429: Rate limit exceeded
- 500: Database error

#### 3. Database Storage

**Table**: `news_trends` (existing)

**Column**: `view_count` (text field)

**Format**: Numeric string (e.g., "16024746")

**Why Text?**: Existing schema compatibility; parsed to integer in views/API.

**Update Pattern**:
```sql
UPDATE news_trends
SET view_count = '16024746', updated_at = NOW()
WHERE id = 'story-uuid';
```

#### 4. Home View Aggregation

**View**: `public.home_feed_v1` (canonical)

**Column**: `web_view_count` (integer)

**Definition**:
```sql
COALESCE(
  CAST(NULLIF(REGEXP_REPLACE(nt.view_count, '[^0-9]', '', 'g'), '') AS INTEGER),
  0
) AS web_view_count
```

**Behavior**:
- Parses `news_trends.view_count` text to integer
- Strips non-numeric characters
- Returns 0 if empty/null

**Alias**: `public.public_v_home_news` → `SELECT * FROM home_feed_v1`

#### 5. Schema Guard (Graceful Degradation)

**RPC**: `public.util_has_column(view_name text, col_name text) → boolean`

**Purpose**: Runtime column detection without exposing `information_schema` to PostgREST.

**Security**: SECURITY DEFINER, STABLE

**Cache**: 5-minute TTL in API layer

**API Integration**:
```typescript
// Check if web_view_count exists
const { data: hasColumn } = await supabase.rpc('util_has_column', {
  view_name: 'home_feed_v1',
  col_name: 'web_view_count'
})

// Build safe SELECT
const columns = hasColumn 
  ? HOME_COLUMNS.join(',')
  : HOME_COLUMNS.filter(c => c !== 'web_view_count').join(',')

// Fetch + post-process
let rows = await supabase.from('home_feed_v1').select(columns)

if (!hasColumn) {
  // Add column in Node.js (avoid SQL aliasing issues)
  rows = rows.map(row => ({ ...row, web_view_count: 0 }))
}
```

**Result**: Always returns HTTP 200, never crashes on missing columns.

#### 6. UI Display

**Component**: `NewsCard` (`page.tsx`)

**Code**:
```typescript
const webViews = story.webViewCount ?? 0

<span title={`${webViews.toLocaleString()} site views`}>
  👁 {language.code === 'th' 
    ? `${webViews.toLocaleString()} ครั้ง` 
    : webViews === 1 ? '1 view' : `${webViews.toLocaleString()} views`
  }
</span>
```

**Features**:
- Bilingual (EN/TH)
- Plural handling
- Tooltip with full count
- Graceful fallback (0 if missing)

---

## Deduplication Strategy

### Session-Based (Client-Side)

**Storage**: `window.sessionStorage`

**Key Format**: `card_view_{video_id}`

**Value**: Timestamp (milliseconds since epoch)

**Lifetime**: Session duration (browser-dependent, typically 30min-12h)

**Behavior**:
- ✅ Same story, same session → Track once
- ✅ Same story, new session → Track again
- ✅ Different stories → Track each once per session

**Privacy**: No server-side tracking of user sessions.

### Rate Limiting (Server-Side)

**Storage**: In-memory Map (resets on server restart)

**Key**: IP address (from `X-Forwarded-For` or `X-Real-IP` headers)

**Limit**: 100 requests per IP per hour

**Window**: Rolling 1-hour window

**Cleanup**: Expired entries removed every 10 minutes

**Security**: Prevents abuse/spam, protects database from overload.

---

## Data Contracts

### API Response Schema (`/api/home`)

```typescript
{
  success: boolean
  fetchedCount: number
  data: Array<{
    id: string
    title: string
    webViewCount: number // Site tracking count
    views: number         // YouTube views
    // ... other fields
  }>
  top3Ids: string[]
  meta: {
    updatedAt: string
    schemaGuard: {
      hasWebViewCount: boolean   // Column exists in DB?
      usingFallback: boolean     // Using post-fetch fallback?
      checkedAt: string          // Last RPC check
      cacheAgeMs: number         // Cache staleness
    }
  }
}
```

### Schema Guard States

| State | `hasWebViewCount` | `usingFallback` | Meaning |
|-------|-------------------|-----------------|---------|
| ✅ Normal | true | false | Column exists, no fallback needed |
| ⚠️ Degraded | false | true | Column missing, using fallback (0) |
| ❌ Error | null/undefined | true | RPC failed, assuming missing |

**Expected in production**: Normal state (first row).

---

## Testing

### Automated Tests

**Script**: `frontend/scripts/test-web-views-tracking.mjs`

**Usage**:
```bash
cd frontend
node scripts/test-web-views-tracking.mjs
```

**Tests**:
1. ✅ RPC function exists and callable
2. ✅ Home API includes webViewCount
3. ✅ Telemetry endpoint increments count
4. ⏭️ Rate limiting (manual test)
5. ✅ Health endpoint reports status

**Expected Output**: `5/5 tests passed`

### Manual E2E Test

1. **Open home page**: Navigate to `http://localhost:3000`
2. **Check initial count**: Note web views count on a card (e.g., "5 views")
3. **Click card**: Click on the card (opens modal)
4. **Check console**: Should see `[card] ✅ View tracked on click`
5. **Refresh page**: Reload home page
6. **Verify increment**: Count should be +1 (e.g., "6 views")
7. **Click again**: Click same card again in same session
8. **Check console**: Should see `[card] ⏭️ View already tracked this session`
9. **Verify no change**: Count stays same (dedupe working)

### Health Check

**Endpoint**: `GET /api/health-schema?check=home_view`

**Expected Response**:
```json
{
  "ok": true,
  "viewName": "home_feed_v1",
  "columns": {
    "total": 27,
    "hasWebViewCount": true
  },
  "message": "Schema healthy: all required columns present"
}
```

---

## Migration & Deployment

### SQL Files

1. **Migration**: `frontend/db/sql/fixes/2025-10-06_util_has_column.sql`
   - Creates RPC function
   - Grants to anon/authenticated
   - DDL only (verification separate)

2. **Verification**: `frontend/db/sql/verify/2025-10-06_util_has_column_VERIFY.sql`
   - Tests RPC function
   - Checks all expected columns
   - Run after migration

### Deployment Steps

1. **Run migration** (via psql-runner or Supabase SQL Editor):
   ```bash
   node scripts/db/psql-runner.mjs --exec frontend/db/sql/fixes/2025-10-06_util_has_column.sql
   ```

2. **Verify migration**:
   ```bash
   psql -f frontend/db/sql/verify/2025-10-06_util_has_column_VERIFY.sql
   ```

3. **Deploy frontend**:
   ```bash
   npm run build
   npm run start
   ```

4. **Run E2E tests**:
   ```bash
   node frontend/scripts/test-web-views-tracking.mjs
   ```

5. **Check health**:
   ```bash
   curl http://localhost:3000/api/health-schema?check=home_view
   ```

### Rollback

If needed, drop RPC function:
```sql
DROP FUNCTION IF EXISTS public.util_has_column(text, text);
```

Frontend will automatically use fallback (webViewCount = 0).

---

## Operational Rules

### 📋 Story Details vs Cards: Views Field Usage (MANDATORY)

**Critical Rule**: Different components show different view metrics. NEVER mix them.

#### Story Details > Basic Info (`NewsDetailModal.tsx`, `EnhancedNewsDetailModal.tsx`)

**MUST** use `news.videoViews` (or fallback `news.views`):
- Shows **platform video views** (YouTube view count from API)
- Example: Top-1 shows "4.9M views" (from YouTube API)
- Never use `news.webViewCount` here

```tsx
// ✅ CORRECT
{formatNumberShort(news.videoViews || news.views || 0)}

// ❌ WRONG
{formatNumberShort(news.webViewCount)}  // Shows 0-10, not 4.9M!
```

#### Homepage Cards (`NewsCard.tsx`)

**MUST** use `news.webViewCount`:
- Shows **site-specific click tracking** (telemetry counter)
- Example: Top-1 shows "1 view" (one user clicked on TrendSiam)
- Never use `news.videoViews` here

```tsx
// ✅ CORRECT
const internalViews = news.webViewCount || 0

// ❌ WRONG
const internalViews = news.videoViews  // Shows millions, confusing!
```

#### Mapper (`frontend/src/lib/mapNews.ts`)

Exposes **both** fields with clear separation:
```typescript
videoViews: raw.video_views ?? raw.views,     // Platform (YouTube)
webViewCount: raw.web_view_count,             // Site tracking
popularityNarrative: generatePopularityNarrative()  // Uses videoViews + likes + comments
```

#### Database Views (`home_feed_v1`)

```sql
video_views BIGINT,        -- From news_trends.view_count (YouTube API)
views BIGINT,              -- Legacy alias = video_views (backward compat)
web_view_count INTEGER     -- From news_trends.site_click_count (telemetry)
```

**Why Separation Matters**:
- Platform views = External metric (millions, from YouTube)
- Site clicks = Internal tracking (0-100s, user engagement on TrendSiam)
- Mixing them causes confusion (e.g., +1 click invisible when base is 4.9M)
- Story Details shows platform authority; Cards show site engagement

---

### ⚠️ Real-Time DB Validation (MANDATORY)

**Rule**: For ANY database change (create/update/drop views, migrations, telemetry updates), ALWAYS validate against the live database at the moment of change.

**Never Assume**:
- Column names or existence
- Data types (text vs integer, etc.)
- Table schemas
- View definitions

**Always Verify First**:
```sql
-- Check column existence and types
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'your_table';

-- Check view definition
SELECT definition
FROM pg_views
WHERE viewname = 'your_view';

-- Check sample data
SELECT * FROM your_table LIMIT 5;
```

**Why This Matters**: Prevents errors from:
- Schema drift over time
- Missing columns (e.g., `ai_images.is_active` doesn't exist)
- Renamed fields (e.g., `views` → `video_views`)
- Wrong data types (e.g., `view_count` is text, not integer)
- Outdated assumptions in docs

**Real Example** (2025-10-08):
- ❌ Assumed `ai_images.is_active` existed → SQL error
- ✅ Queried `information_schema.columns` first → discovered column missing
- ✅ Fixed script to use only existing columns (`id`, `news_id`, `image_url`, `prompt`, `model`, `created_at`)

**Best Practice**: Run `scripts/db/realtime-schema-check.sql` before any DB changes.

---

### ⚠️ Zero-Problems Exit Rule (MANDATORY, STRICT)

**Rule**: After ANY database/view/migration/API change, the VS Code "Problems" panel **must be empty (0 errors)** before the task is considered complete. **NO FALSE POSITIVES ALLOWED**.

**Process**:
1. **Validate live schema** before editing (run `information_schema` queries)
2. **Apply the change** (migration, view update, API code)
3. **Re-validate schema** against the live database
4. **Ensure** `/api/home/diagnostics` shows `missingColumns: []`
5. **Confirm** VS Code Problems panel shows **0 errors STRICT**

**If Not Zero**: The change is **NOT DONE**. Refactor SQL/code to be LSP-friendly. No "false positive" excuses.

**How to Write LSP-Friendly SQL**:
- ✅ Use simple SELECT statements
- ✅ Avoid complex CTEs in CREATE VIEW blocks
- ✅ Proper semicolons after all statements
- ✅ Remove `\echo` statements (use SELECT for diagnostics)
- ✅ Test with `read_lints` tool before marking complete
- ❌ Don't accept "LSP can't parse this" as excuse

**Why This Matters**:
- Prevents deployment of broken code
- Catches syntax errors, type mismatches, missing columns
- Ensures LSP/TypeScript/SQL validation passes
- Guarantees schema contracts are met
- Strict enforcement prevents technical debt

**Real Examples** (2025-10-08):
- ❌ v1: Complex CTE → LSP errors accepted as "false positives"
- ❌ v2: Advanced SQL → LSP errors, migration worked but errors remained
- ✅ v3: Simple SQL → **0 LSP errors**, clean migration, STRICT compliance

**Enforcement**: This is a **HARD STOP**. No task completion without **zero Problems panel errors** (strict).

---

## Privacy & Compliance

### Data Collected

- ✅ Story ID (what was viewed)
- ✅ Timestamp (when)
- ✅ IP address (for rate limiting only, not stored)
- ❌ NO user identification
- ❌ NO session tracking across devices
- ❌ NO cookies (uses sessionStorage only)

### PDPA Compliance

- **Purpose**: Analytics (story popularity)
- **Consent**: Implied by usage (no PII collected)
- **Retention**: Indefinite (aggregated counts only)
- **Access**: Public (no user-specific data)
- **Deletion**: Not applicable (no user data)

### Rate Limiting Data

- **Storage**: In-memory only (not persisted)
- **Retention**: 1 hour maximum
- **Cleanup**: Automatic every 10 minutes
- **Reset**: Server restart clears all

---

## Troubleshooting

### Issue: Counts Not Incrementing

**Symptoms**: Click card, count stays same

**Diagnosis**:
1. Check browser console for errors
2. Verify telemetry endpoint accessible: `curl -X POST http://localhost:3000/api/telemetry/view -d '{"video_id":"test"}'`
3. Check network tab: Should see POST to `/api/telemetry/view`
4. Verify service_role key set: `echo $SUPABASE_SERVICE_ROLE_KEY`

**Common Causes**:
- Service key missing → 500 error
- Rate limit hit → 429 error
- Story not found → 404 error (check video_id)
- Session dedupe → Expected behavior (check console log)

### Issue: Schema Guard Using Fallback

**Symptoms**: `meta.schemaGuard.usingFallback: true`

**Diagnosis**:
1. Check RPC exists: `SELECT public.util_has_column('home_feed_v1', 'web_view_count');`
2. Check column exists: `SELECT web_view_count FROM home_feed_v1 LIMIT 1;`
3. Check migration logs: `scripts/db/logs/*.log`

**Solution**: Run migration script (see Deployment Steps)

### Issue: Rate Limit Exceeded

**Symptoms**: 429 status, "Rate limit exceeded" error

**Diagnosis**:
1. Check console: Should show `[telemetry/view] 🚫 Rate limit exceeded`
2. Check headers: `X-RateLimit-Remaining: 0`
3. Check IP: Same IP making 100+ requests?

**Solution**:
- Wait 1 hour (automatic reset)
- OR restart server (clears in-memory map)
- OR adjust `RATE_LIMIT_MAX` constant

### Issue: LSP Errors in SQL File

**Symptoms**: Red squiggles in `2025-10-06_util_has_column.sql`

**Cause**: Inline verification queries call function before LSP recognizes it exists

**Solution**: Verification moved to separate file (`*_VERIFY.sql`)

### Issue: Empty Home Feed (Zero Rows)

**Symptoms**: "No Trending Stories Right Now" message shown despite data in database

**Diagnosis**:
1. Check view row counts: `SELECT COUNT(*) FROM home_feed_v1;`
2. Check base table: `SELECT COUNT(*) FROM news_trends WHERE LOWER(platform) = 'youtube';`
3. Check platform filter: `SELECT platform, COUNT(*) FROM news_trends GROUP BY platform;`

**Common Causes**:
- **Case-sensitive filter mismatch**: View filters `WHERE platform = 'YouTube'` but data has `'youtube'`
  - **Fix**: Use `WHERE LOWER(platform) = 'youtube'` in view definition
- **Strict freshness filtering**: All data older than 30-day window
  - **Fix**: Relax filters or update data freshness
- **JOIN conditions failing**: LEFT JOINs to empty tables may cause unexpected filters
  - **Check**: Verify stories, snapshots, ai_images tables have data
- **Type casting errors**: Text columns not safely cast to numeric types
  - **Fix**: Use CASE WHEN with regex validation before casting

**Solution**: Run diagnostic script to identify specific cause:
```bash
node scripts/db/psql-runner.mjs --file scripts/db/diagnose-home-views.sql
```

**Recent Fix (2025-10-08)**: Changed platform filter from `= 'YouTube'` to `LOWER(platform) = 'youtube'` → 0 rows to 149 rows

---

### Issue: Growth Rate Showing Raw Numbers (2025-10-08)

**Symptoms**: Story Details modal shows "4934528" instead of "Viral (>1M/day)"

**Diagnosis**:
```sql
SELECT growth_rate_label, COUNT(*) 
FROM public.home_feed_v1 
GROUP BY growth_rate_label 
ORDER BY COUNT(*) DESC LIMIT 10;
```

**Root Cause**: View SQL set `growth_rate_label` to stringified `growth_rate_value`

**Fix Applied** (2025-10-08):
```sql
CASE
  WHEN value >= 1000000 THEN 'Viral (>1M/day)'
  WHEN value >= 100000 THEN 'High (>100K/day)'
  WHEN value >= 10000 THEN 'Moderate (>10K/day)'
  WHEN value > 0 THEN 'Growing'
  ELSE 'Stable'
END AS growth_rate_label
```

**Result**: 57 rows "High (>100K/day)", 33 rows "Viral (>1M/day)", 11 rows "Growing"

**Migration**: `frontend/db/sql/fixes/2025-10-08_fix_views_separation_growth_rate.sql`

---

### Issue: 500 Error - Invalid Input Syntax for Type Integer (22P02)

**Symptoms**: "Unable to Load News", server logs show `invalid input syntax for type integer: "Facebook, Instagram, Twitter/X..."`

**PostgreSQL Error Code**: 22P02 (invalid text representation)

**Root Cause**: Attempting to cast a TEXT column containing comma-separated values or descriptive text to INTEGER type.

**Common Culprits**:
- `platform_mentions` (TEXT): "Facebook, Instagram, Twitter/X..." → Cannot cast to integer
- `keywords` (TEXT): May contain JSON or comma-separated strings
- `growth_rate` (TEXT): May contain labels like "Viral (>100K/day)"
- Any text column being cast without validation

**Diagnosis Steps**:
1. Check error message for the failing value
2. Identify which column name appears in error
3. Verify column type in database:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns
   WHERE table_name = 'news_trends' 
     AND column_name IN ('platform_mentions', 'keywords', 'growth_rate');
   ```
4. Check sample data:
   ```sql
   SELECT platform_mentions, keywords FROM news_trends LIMIT 5;
   ```

**Solution**: Remove unsafe casts or add regex validation:
```sql
-- ❌ WRONG: Unsafe cast
nt.platform_mentions::integer

-- ✅ CORRECT: Keep as text
COALESCE(nt.platform_mentions, 'Primary platform only') AS platform_mentions

-- ✅ CORRECT: Safe cast with validation
CASE 
  WHEN nt.view_count ~ '^[0-9]+$' THEN nt.view_count::bigint
  ELSE 0
END AS views
```

**TypeScript Fix**: Ensure schemas match database types
```typescript
// If database column is TEXT, schema must be string:
platform_mentions: z.string().nullable()  // Not z.number()
```

**Recent Fix (2025-10-08)**: Removed `nt.platform_mentions::integer` cast from view, changed TypeScript schemas to expect string → 500 error resolved

---

## Performance

### Metrics

| Operation | Time | Notes |
|-----------|------|-------|
| Card click → tracking | ~50-200ms | Async, non-blocking |
| Telemetry API | ~20-100ms | Database write |
| Home API (cold) | ~200-500ms | Includes RPC check |
| Home API (cached) | ~50-150ms | RPC cached 5min |
| Session dedupe check | <1ms | localStorage read |

### Optimization

- ✅ Async tracking (doesn't block modal opening)
- ✅ RPC cache (5-min TTL, avoids repeated schema checks)
- ✅ Session dedupe (client-side, no server round-trip)
- ✅ Rate limiting (in-memory, fast lookup)
- ✅ Atomic updates (single UPDATE query)

### Scalability

**Current limits**:
- 100 increments/IP/hour → ~2.4K unique IPs/hour max → ~17M increments/day
- In-memory rate limiting → resets on restart (acceptable for MVP)

**Future improvements** (if needed):
- Redis for rate limiting (persistent, distributed)
- Batch updates (queue increments, flush every N seconds)
- Separate analytics DB (reduce load on main DB)

---

## Further Reading

- **DB Automation**: `docs/DB_AUTOMATION_PLAYBOOK.md`
- **Schema Guard**: `SCHEMA_GUARD_IMPLEMENTATION_SUMMARY.md`
- **Homepage Freshness**: `memory-bank/03_frontend_homepage_freshness.mb`
- **Security Plan-B**: `memory-bank/01_security_plan_b.mb`

---

**Version**: 1.0  
**Last Updated**: 2025-10-06  
**Maintained by**: TrendSiam Team
