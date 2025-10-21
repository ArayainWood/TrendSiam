# Web Views Tracking - Diagnostic Report

**Date**: 2025-10-06  
**Status**: Root Cause Identified  

---

## Current State Analysis

### Data Flow (Existing)

```
User → Opens Modal → NewsDetailModal.tsx (line 34-65)
  → POST /api/telemetry/view (video_id, story_id)
    → Supabase (service_role) → news_trends.view_count += 1
      → Next home API load → home_feed_v1.web_view_count
        → UI displays updated count
```

### Root Cause: Card Click Not Tracked

**Problem**: Web views only increment when **modal opens**, NOT when **card is clicked**.

**Evidence**:
1. `page.tsx` line 359: Card `onClick={() => onViewDetails(story)}` - no tracking
2. `NewsDetailModal.tsx` lines 34-65: Tracking ONLY fires on modal open
3. User expectation: Track "when a user opens a story from the grid (before entering Story Details)"

**Current Behavior**:
- ❌ Click card → count stays same
- ✅ Modal opens → count increments
- Issue: Modal might not always open (user navigates away, closes immediately, etc.)

---

## Missing Pieces

### 1. Card Click Tracking
**Status**: Not implemented

**Need**: Call `/api/telemetry/view` on card click with:
- Session-based dedupe (sessionStorage key per story)
- Fire-and-forget (don't block modal opening)
- Optimistic UI update (optional)

### 2. SQL/LSP Errors
**File**: `frontend/db/sql/fixes/2025-10-06_util_has_column.sql`

**Error**: Lines 38-47 contain verification SELECT statements that call `public.util_has_column()` immediately after creation.

**LSP Issue**: PostgresTools LSP doesn't recognize the function exists yet in the same file context.

**Impact**: Red squiggles, confusing for developers, violates "LSP clean" quality gate.

**Fix**: Separate verification into `frontend/db/sql/verify/2025-10-06_util_has_column_VERIFY.sql`

---

## Existing Infrastructure (Reusable)

### ✅ Telemetry Endpoint
**Route**: `POST /api/telemetry/view`  
**Status**: Working (used by modal)  
**Features**:
- Atomic increment via service_role
- Finds by video_id or external_id
- Returns new count
- Error handling (404, 500)

**No changes needed** - just call it from card click too.

### ✅ Schema Guard
**RPC**: `public.util_has_column(view_name, col_name)`  
**Status**: Implemented, 5-min cache  
**API**: `/api/home` uses it, graceful fallback  

**Working correctly** - just needs SQL file cleanup.

### ✅ Home View
**View**: `public.home_feed_v1` (canonical)  
**Alias**: `public.public_v_home_news`  
**Column**: `web_view_count` exposed, mapped to API  

**Already integrated** - no DB changes needed.

---

## Why Counts Don't Increment from Grid

**Root Cause**: Card click handler doesn't call telemetry.

**User Flow**:
1. User clicks card in "Latest Stories"
2. `onViewDetails(story)` fires → opens modal
3. **NO tracking happens at this point**
4. Modal opens → tracking fires (but this is "too late" per user requirement)

**Solution**: Track on card click, BEFORE modal opens.

---

## Implementation Plan

### 1. Fix SQL/LSP (10 min)
- ✅ Move verification SELECTs to separate file
- ✅ Keep migration DDL-only
- ✅ PostgresTools LSP clean

### 2. Wire Card Click Tracking (15 min)
- ✅ Add `handleCardClick` in page.tsx
- ✅ Session dedupe check
- ✅ Call `/api/telemetry/view`
- ✅ Fire async (don't block modal)

### 3. Add Rate Limiting (10 min)
- ✅ IP-based throttle in telemetry endpoint
- ✅ Prevent abuse (max 100 increments/IP/hour)

### 4. Tests (15 min)
- ✅ DB: Verify dedupe window
- ✅ API: Health check, home response
- ✅ E2E: Card click → count +1

### 5. Documentation (10 min)
- ✅ Create WEB_VIEWS_TRACKING.md
- ✅ Update memory bank
- ✅ Add data flow diagram

---

## Schema Guard Status

**Current State**: `meta.schemaGuard` in `/api/home` response

```json
{
  "schemaGuard": {
    "hasWebViewCount": true,
    "usingFallback": false,
    "checkedAt": "2025-10-06T...",
    "cacheAgeMs": 15234
  }
}
```

**Expected in normal operation**: `usingFallback: false`  
**Expected during migration**: `usingFallback: true` (graceful degradation)

---

## No DB Schema Changes Needed

**Existing tables**:
- ✅ `news_trends.view_count` (text field) - stores site views
- ✅ View `home_feed_v1.web_view_count` - exposes as integer

**No new table needed** because:
1. We already have persistent storage in `news_trends`
2. De-dupe handled by sessionStorage (client-side)
3. Telemetry endpoint already atomic
4. View already aggregates correctly

**Decision**: Keep architecture as-is, just add card click trigger.

---

## Summary

**Root Cause**: Card click doesn't trigger telemetry (only modal does).

**Missing**: Handler to call `/api/telemetry/view` on card click.

**SQL Issue**: Verification statements in migration file confuse LSP.

**Solution**: 
1. Separate verification SQL
2. Add card click tracking with session dedupe
3. Keep all existing infrastructure (endpoint, view, schema guard)

**ETA**: 60 minutes total

---

**Next Steps**: Implement fixes, run tests, update docs.
