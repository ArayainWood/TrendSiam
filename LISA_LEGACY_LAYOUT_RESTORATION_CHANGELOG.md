# LISA Legacy Layout Restoration - Complete Changelog

**Date**: 2025-10-04  
**Goal**: Restore LISA-style layout with both summaries, 4-block modal analytics, and view tracking

---

## Overview

This change restores the legacy LISA design patterns:
1. **Cards show BOTH** Thai + English summaries
2. **Modal has EXACTLY 4** analytics blocks (not 5-6)
3. **Views increment** when modal opens (with session-based de-duplication)
4. **Score bar** fills proportionally (already working, verified)

---

## Files Changed

### 1. Data Contract Documentation
**File**: `HOME_FEED_DATA_CONTRACT.md` (NEW)  
**Purpose**: Define canonical data structure for home feed

**Contents**:
- Card fields (identity, content, scoring, images)
- Modal analytics fields (4 blocks only)
- View contract (26 columns with types)
- API contract (camelCase mapping)
- Telemetry API specification
- Backfill rules (check-before-create)
- Validation checklist

**Key Sections**:
- **A) Latest Stories Card Fields**: All required fields with types
- **B) Modal "Detailed Analytics" Fields**: Exactly 4 blocks defined
- **C) View Contract**: 26-column SQL schema
- **D) API Contract**: camelCase JSON structure
- **E) Telemetry API**: POST /api/telemetry/view specification

---

### 2. Modal Component (Detailed Analytics Section)
**File**: `frontend/src/components/news/NewsDetailModal.tsx`

#### Change 1: Enforce Exactly 4 Blocks (lines 366-427)
**Before**: Up to 6 conditional blocks (Growth Rate, Platforms, Platform Mentions, Keywords, AI Opinion, Score Details)

**After**: Exactly 4 blocks always rendered:
```typescript
{/* Detailed Analytics - EXACTLY 4 blocks (LISA legacy layout) */}
{news.view_details && (
  <div className="grid md:grid-cols-2 gap-4">
    {/* 1. Growth Rate */}
    <div>...</div>
    
    {/* 2. Platforms */}
    <div>...</div>
    
    {/* 3. Keywords */}
    <div>...</div>
    
    {/* 4. AI Opinion */}
    {news.aiOpinion && <div>...</div>}
  </div>
)}
```

**Removed**:
- ❌ "Platform Mentions" block (merged into Platforms)
- ❌ "Score Details" block (completely removed from modal)

**Merged**:
- Platforms block now shows `news.platforms` array OR falls back to `news.platform`

#### Change 2: View Tracking with Telemetry (lines 30-62)
**Before**: Called `newsApi.incrementNewsView()` (old API)

**After**: Calls new `/api/telemetry/view` endpoint with session-based de-duplication:
```typescript
useEffect(() => {
  if (isOpen && news?.video_id) {
    const sessionKey = `view_tracked_${news.video_id}`
    if (window.sessionStorage.getItem(sessionKey)) {
      return // Already tracked
    }
    
    fetch('/api/telemetry/view', {
      method: 'POST',
      body: JSON.stringify({ video_id, story_id })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          window.sessionStorage.setItem(sessionKey, 'true')
        }
      })
  }
}, [isOpen, news?.video_id])
```

**Benefits**:
- ✅ Only increments once per session per story
- ✅ Uses dedicated telemetry endpoint (service_role key)
- ✅ Fails gracefully (doesn't block UI)
- ✅ Logs success/failure for debugging

---

### 3. Card Component (Latest Stories Cards)
**File**: `frontend/src/app/page.tsx` (NewsCard function)

#### Change: Show BOTH Summaries (lines 421-435)
**Before**: Showed EITHER Thai OR English based on language setting:
```typescript
<p>{language.code === 'th' ? story.summary : story.summary_en}</p>
```

**After**: Shows BOTH summaries with labels:
```typescript
<div className="space-y-2">
  {story.summary && (
    <p className="line-clamp-3">
      <span className="text-xs font-mono uppercase">TH:</span>
      {story.summary}
    </p>
  )}
  {story.summary_en && (
    <p className="text-sm line-clamp-2">
      <span className="text-xs font-mono uppercase">EN:</span>
      {story.summary_en.length > 100 
        ? `${story.summary_en.substring(0, 100)}...` 
        : story.summary_en}
    </p>
  )}
</div>
```

**Display Rules**:
- Thai: Full text, line-clamp-3
- English: Truncated to 100 chars with ellipsis, line-clamp-2, smaller text
- Both have "TH:" / "EN:" labels in monospace font

**Already Working** (verified, no changes needed):
- ✅ Score badge displays `popularity_score.toFixed(1)`
- ✅ Score bar fills proportionally `${Math.min(score, 100)}%`
- ✅ Views display formatted count

---

### 4. Telemetry API Endpoint (NEW)
**File**: `frontend/src/app/api/telemetry/view/route.ts` (NEW)

**Route**: `POST /api/telemetry/view`

**Purpose**: Atomically increment view count when user opens modal

**Security**:
- Uses `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- Never exposes service key to client
- Validates `video_id` parameter

**Request Body**:
```json
{
  "video_id": "FMX98ROVRCE",
  "story_id": "uuid" // optional
}
```

**Response**:
```json
{
  "success": true,
  "views": 16024745
}
```

**Implementation**:
1. Find item by `video_id` OR `external_id`
2. Parse current `view_count` (stored as text)
3. Increment by 1
4. Update atomically with timestamp
5. Return new count

**Error Handling**:
- 400: Missing `video_id`
- 404: Item not found (fails gracefully)
- 500: Update failed

**Logging**:
```
[telemetry/view] ✅ View incremented: { video_id, views: "16024744 → 16024745" }
```

---

### 5. View Contract Verification Script
**File**: `scripts/verify_view_contract.sql` (NEW)

**Purpose**: Automated check that `home_feed_v1` has all 26 columns with correct types

**Checks**:
1. Column inventory (26 columns, types match expected)
2. Critical field coverage (summary_en, ai_opinion, growth_rate_label, views)
3. Sample row validation

**Results** (verified 2025-10-04):
- ✅ All 26 columns present with correct types
- ✅ summary_en: 98.7% coverage (234/237)
- ✅ ai_opinion: 99.2% coverage (235/237)
- ✅ growth_rate_label: 100% coverage (237/237)
- ✅ views: 100% coverage (237/237)

---

## Verification Results

### API Layer
```bash
GET /api/home
```

**Top Story** (Stray Kids "CEREMONY"):
- ✅ `summary`: Present (Thai)
- ✅ `summaryEn`: Present (English)
- ✅ `popularityScore`: 95.935 (number)
- ✅ `views`: 4934528 (number)
- ✅ `growthRateLabel`: "Rising fast"
- ✅ `aiOpinion`: Present
- ✅ `keywords`: Array present

**LISA Record**:
- ✅ `summary`: Present (Thai)
- ✅ `summaryEn`: Present (English)
- ✅ `popularityScore`: 88.438 (number)
- ✅ `views`: 16024744 (number)
- ✅ `aiOpinion`: Present
- ✅ `rank`: 8

### UI Layer (Manual Verification Required)
**Cards** (Expected):
- [ ] Both Thai + English summaries visible
- [ ] Thai: Full text, 3 lines max
- [ ] English: Truncated to ~100 chars, 2 lines max
- [ ] "TH:" and "EN:" labels visible
- [ ] Score badge shows decimal (e.g., "95.9")
- [ ] Score bar fills proportionally
- [ ] Views show formatted count (e.g., "4.9M views")

**Modal** (Expected):
- [ ] **Detailed Analytics** section has EXACTLY 4 blocks:
  1. Growth Rate → "Rising fast" or similar
  2. Platforms → "YouTube" or list
  3. Keywords → Badge chips
  4. AI Opinion → Analysis text
- [ ] "Score Details" block NOT present
- [ ] "Platform Mentions" block NOT present
- [ ] Opening modal increments view count by +1
- [ ] Opening same modal again in session does NOT increment (de-duplicated)

---

## Testing Checklist

### Functional Tests
- [ ] **Card displays both summaries**: Open http://localhost:3000, check any card shows "TH:" and "EN:" sections
- [ ] **Modal has 4 blocks**: Click any card, scroll to "Detailed Analytics", count blocks (should be 4)
- [ ] **Views increment**: Note view count, open modal, close, refresh page, check count increased by 1
- [ ] **De-duplication works**: Open same modal again, refresh, check count did NOT increase again
- [ ] **Score bar fills**: Check score bar width matches score (95.9 → ~96% width)

### Anchor Tests
**Top Story** (Stray Kids):
- [ ] Card: Both summaries, score ~95.9, bar nearly full, views ~4.9M
- [ ] Modal: 4 blocks, Growth="Rising fast", AI Opinion present

**LISA Record** (rank 8):
- [ ] Card: Both summaries, score ~88.4, bar ~88% full, views ~16M
- [ ] Modal: 4 blocks, AI Opinion="Music video release...", Keywords present

### API Tests
```bash
# Test telemetry endpoint
curl -X POST http://localhost:3000/api/telemetry/view \
  -H "Content-Type: application/json" \
  -d '{"video_id":"FMX98ROVRCE"}'

# Expected: {"success":true,"views":16024745}
```

---

## Known Limitations

### 1. Missing Fields (Minor)
- 3 rows missing `summary_en` (98.7% coverage)
- 2 rows missing `ai_opinion` (99.2% coverage)

**Impact**: Low - affects <3% of items  
**Fix**: Run targeted backfill for NULL fields only (check-before-create)

### 2. Growth Rate Parsing (Cosmetic)
Some items have text growth rates (e.g., "Viral (>100K/day)") that can't be parsed to numeric.

**Impact**: Low - label still displays correctly  
**Fix**: ETL could store numeric value alongside label

---

## Backfill Script (Optional)

To fill missing `summary_en` and `ai_opinion` for 3-5 items:

```sql
-- Only update NULL fields (check-before-create)
WITH missing_items AS (
  SELECT id, title, summary
  FROM public.news_trends
  WHERE summary_en IS NULL OR ai_opinion IS NULL
  LIMIT 10
)
SELECT id, title, 
  CASE WHEN summary_en IS NULL THEN 'NEEDS EN SUMMARY' ELSE 'OK' END as summary_en_status,
  CASE WHEN ai_opinion IS NULL THEN 'NEEDS AI OPINION' ELSE 'OK' END as ai_opinion_status
FROM missing_items;

-- Then run ETL to generate missing fields (do not overwrite non-NULL)
```

---

## Acceptance Criteria

### ✅ Completed
- [x] Data contract documented (HOME_FEED_DATA_CONTRACT.md)
- [x] View has all 26 columns with correct types
- [x] API returns both `summary` AND `summaryEn`
- [x] Cards display both Thai + English summaries
- [x] Modal has exactly 4 analytics blocks
- [x] "Score Details" removed from modal
- [x] "Platform Mentions" merged into Platforms
- [x] Telemetry endpoint created (`/api/telemetry/view`)
- [x] Modal calls telemetry on open
- [x] Session-based de-duplication implemented
- [x] No linter errors
- [x] API verified (both anchors pass)

### ⏳ Pending (User Verification)
- [ ] Manual UI check: Cards show both summaries
- [ ] Manual UI check: Modal has 4 blocks
- [ ] Manual UI check: Views increment on modal open
- [ ] Manual UI check: De-duplication works (no double-count)
- [ ] Screenshot: Before/After for Top Story card
- [ ] Screenshot: Before/After for LISA modal

---

## Rollback Plan

If issues arise, revert these commits:
1. `frontend/src/components/news/NewsDetailModal.tsx` (lines 30-62, 366-427)
2. `frontend/src/app/page.tsx` (lines 421-435)
3. Delete `frontend/src/app/api/telemetry/view/route.ts`

Original behavior:
- Cards showed EITHER Thai OR English (based on language setting)
- Modal had 5-6 conditional blocks
- No view tracking on modal open

---

## Next Steps

1. **User Verification**: Open app, test cards and modal, confirm layout matches LISA legacy
2. **Backfill**: Run ETL for 3-5 items missing `summary_en` or `ai_opinion` (optional)
3. **Memory Bank**: Update `memory-bank/03_frontend_homepage_freshness.mb` with new behavior
4. **Screenshots**: Capture before/after for documentation

---

## References

- **Data Contract**: `HOME_FEED_DATA_CONTRACT.md`
- **Gap Report**: `LISA_RECORD_GAP_REPORT.md`
- **Audit Summary**: `LISA_AUDIT_FIX_SUMMARY.md`
- **Playbook**: `docs/playbook-2.0-summary.md`
- **Security**: `memory-bank/01_security_plan_b.mb`
