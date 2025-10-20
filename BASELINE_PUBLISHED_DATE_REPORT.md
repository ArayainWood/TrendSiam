# Baseline Report: Published Date Issue

**Date:** 2025-10-10  
**Priority:** P1 (User-Facing Issue)  
**Status:** Root Cause Identified

---

## Executive Summary

**Issue:** Story Details displays "Invalid Date" for the "Published" field across all items.

**Root Cause:** Database view `home_feed_v1` queries wrong column (`news_trends.published_at` which is NULL) instead of correct column (`news_trends.published_date` which contains valid timestamps).

**Impact:** 100% of items affected (149/149 items have NULL published_at in view)

---

## Baseline Data

### Test 1: Data Availability
```
Total items in home_feed_v1: 149
Items with published_at: 0 (0%)     ❌
Items with NULL published_at: 149 (100%)  ❌
Items with snapshot_date: 149 (100%)  ✅
```

**Finding:** ALL items have NULL `published_at`, but 100% have valid `snapshot_date`.

### Test 2: Sample Rows (Top 5)

| Rank | Title | Published | Snapshot | Platform |
|------|-------|-----------|----------|----------|
| 1 | Stray Kids "CEREMONY" M/V | **NULL** ❌ | 2025-08-22 ✅ | YouTube |
| 2 | JUJUTSU KAISEN The Culling Game | **NULL** ❌ | 2025-09-01 ✅ | YouTube |
| 3 | Warhammer 40,000: Dawn of War IV | **NULL** ❌ | 2025-08-21 ✅ | YouTube |
| 4 | skibidi toilet 79 (part 2) | **NULL** ❌ | 2025-08-22 ✅ | YouTube |
| 5 | CORTIS 'What You Want' | **NULL** ❌ | 2025-08-19 ✅ | YouTube |

**Finding:** Ranking works (snapshot_date-based freshness), but published_at is missing for display.

### Test 3: Upstream Data (news_trends)

| Title | published_at | published_date | date (snapshot) |
|-------|--------------|----------------|-----------------|
| GO FOR GOLD Champions 2025 | **NULL** ❌ | 2025-08-30T16:54:53+00:00 ✅ | 2025-09-01 |
| RoV Pro League 2025 | **NULL** ❌ | 2025-08-31T14:33:35+00:00 ✅ | 2025-09-01 |
| ILLSLICK - พรุ่งนี้ | **NULL** ❌ | 2025-08-29T04:59:15+00:00 ✅ | 2025-09-01 |

**Finding:** The data EXISTS in `published_date` column, but view is querying `published_at` column.

### Test 4: Date Parsing
```
Sample published_at: null (type: object)
Sample snapshot_date: "2025-08-22" (type: string)
```

**Finding:** NULL values are correctly typed, but frontend creates `new Date(null)` which produces "Invalid Date".

---

## Root Cause Analysis

### Schema Mismatch

**View Definition (BROKEN):**
```sql
-- home_feed_v1 currently does:
COALESCE(st.publish_time, nt.published_at) AS published_at
```

**Problem:**
1. `stories.publish_time` is likely NULL or doesn't exist
2. `news_trends.published_at` is NULL (wrong column)
3. `news_trends.published_date` contains the actual data (correct column) but is not queried

**Fix Required:**
```sql
-- Should be:
COALESCE(st.publish_time, nt.published_date) AS published_at
```

### Data Flow

```
YouTube API
   ↓
summarize_all_v2.py
   ↓ (writes to)
news_trends.published_date ✅ (HAS DATA: 2025-08-30T16:54:53+00:00)
news_trends.published_at ❌ (NULL - column unused)
   ↓ (queried by view)
home_feed_v1.published_at ❌ (NULL - wrong source column)
   ↓ (returned by API)
Frontend publishedAt: null
   ↓ (parsed as)
new Date(null) → Invalid Date ❌
```

### Why snapshot_date Works

```
summarize_all_v2.py
   ↓ (writes to)
news_trends.date ✅ (HAS DATA: 2025-09-01)
   ↓ (queried by view)
home_feed_v1.snapshot_date ✅ (WORKING)
   ↓ (used for ranking)
Home feed: Freshness-first ranking ✅
```

---

## Current Ranking Policy (Verified Working)

### SQL Order (from view)
```sql
ORDER BY
  priority ASC,              -- Today (1) before fallback (2)
  rank ASC NULLS LAST        -- Sequential within same priority
```

### Rank Calculation (ROW_NUMBER)
```sql
ROW_NUMBER() OVER (
  ORDER BY
    CASE WHEN rank <= 3 THEN 0 ELSE 1 END,  -- is_top3 DESC
    popularity_score DESC NULLS LAST,        -- score DESC
    video_views DESC NULLS LAST,             -- views DESC
    id ASC                                    -- deterministic tiebreaker
)
```

### Freshness Filter
```sql
WHERE snapshot_date = DATE(NOW() AT TIME ZONE 'Asia/Bangkok')  -- Today (Thai TZ)
```

**Status:** ✅ Ranking policy is CORRECT and uses `snapshot_date` for freshness.

---

## Impact Assessment

### Severity: HIGH (User-Facing)
- **100% of items** show "Invalid Date" in Story Details
- Users cannot see when content was originally published on platform
- No way to distinguish fresh content from weeks-old content in Story Details

### What Works ✅
- Home feed ranking (uses snapshot_date correctly)
- Freshness filtering (Thai TZ)
- Top-3 determination
- Score distribution

### What's Broken ❌
- Story Details "Published" label (shows "Invalid Date")
- Platform attribution (users don't know original publish time)
- User trust (looks like a bug)

---

## Fix Strategy

### 1. Database View Repair
```sql
-- Fix home_feed_v1 and public_v_home_news
COALESCE(st.publish_time, nt.published_date) AS published_at,  -- Use published_date!
COALESCE(nt.date, DATE(nt.created_at AT TIME ZONE 'Asia/Bangkok')) AS snapshot_date
```

### 2. Frontend Null Handling
```typescript
// mapDbToApi
publishedAt: raw.published_at ?? null  // Already correct

// NewsDetailModal formatter
const formatPublishedDate = (dateStr: string | null) => {
  if (!dateStr) return '—'  // Placeholder for NULL
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('th-TH', { 
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch {
    return '—'
  }
}
```

### 3. Verification
- Query view after migration: should show 100% non-NULL published_at
- Test API: all items should have valid ISO-8601 publishedAt
- Test UI: no more "Invalid Date", either valid date or "—"

---

## Acceptance Criteria

- [ ] View queries `published_date` column (correct source)
- [ ] API returns non-NULL `publishedAt` for 100% of items (or graceful NULL)
- [ ] Frontend displays valid date or "—" placeholder
- [ ] **0 occurrences** of "Invalid Date" in Story Details
- [ ] Ranking still uses `snapshot_date` (no regression)
- [ ] Both fields distinct: `published_at` (display) vs `snapshot_date` (ranking)

---

## Next Steps

1. ✅ **Create SQL migration** to fix view column mapping
2. ✅ **Update frontend formatter** to handle NULL gracefully
3. ✅ **Run verification script** to confirm fix
4. ✅ **Document** in DB_FE_FIELD_MAPPING.md

---

**Report Date:** 2025-10-10  
**Investigator:** TrendSiam Cursor Agent  
**Verification Script:** `frontend/scripts/baseline-check.mjs`

