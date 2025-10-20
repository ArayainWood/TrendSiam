# Weekly Snapshot Consistency Verification

**Date:** 2025-10-16  
**Focus:** Confirm Weekly Report page and PDF share same snapshot source  
**Status:** ✅ VERIFIED — NO REGRESSIONS

---

## Data Source Verification

### Shared Data Layer

**Both Weekly page AND PDF use:** `frontend/src/lib/data/weeklySnapshot.ts`

**Function:** `fetchWeeklySnapshot()`
- Fetches from: `public_v_weekly_snapshots` view (Plan-B compliant)
- Returns: Full snapshot object with `items` array
- No hardcoded limits
- No JSON fallbacks

**Verified in:**
- `frontend/src/app/weekly-report/page.tsx` (page data)
- `frontend/src/app/api/weekly/pdf/route.tsx` (PDF data)

---

## Story Count Verification

### Dynamic Count Logic

**Function:** `countTotalStories()` in `weeklyRepo.ts`

```
Logic:
1. If items array exists: return items.length
2. Else if meta.total_items exists: return that
3. Else: return 0

NO HARDCODED 20 LIMIT
```

**PDF Display Logic:**
- PDF component: `WeeklyDoc.tsx`
- Slices items to top 20 for display: `items.slice(0, 20)`
- This is INTENTIONAL design (PDF space constraints)
- But full count is available and dynamic

**Verified:**
- Snapshot fetches ALL items from database
- Count reflects actual items (not locked at 20)
- PDF shows "Top 20" by design, not by data limitation

---

## Snapshot ID Consistency

**Weekly Page:**
- Displays: `snapshotData.snapshotId`
- Fetched from: `fetchWeeklySnapshot()` → latest or specific ID

**Weekly PDF:**
- Generated for: Same `snapshotId` passed via query param
- URL: `/api/weekly/pdf?snapshot={snapshotId}`
- Data source: `fetchWeeklySnapshot(snapshotId)`

**Result:** ✅ **SAME SNAPSHOT** used by both

---

## Date Range Consistency

**Weekly Page:**
- Start: `snapshotData.meta.window_start`
- End: `snapshotData.meta.window_end`
- Displayed: "As of {date}"

**Weekly PDF:**
- Same fields from same snapshot
- Rendered: `startDate.toLocaleDateString('th-TH')`
- Buddhist Era (B.E.) formatting applied

**Result:** ✅ **SAME DATE RANGE** displayed

---

## Ordering Consistency

**Ranking Logic:**
- Applied at: Database view level (`public_v_weekly_snapshots`)
- Ordering: `ORDER BY weekly_rank ASC, item_id`
- Both page and PDF receive pre-ranked items

**No Client-Side Re-sorting:**
- Weekly page: Displays items as received
- PDF: Displays items as received
- Top 20: First 20 items from ordered array

**Result:** ✅ **SAME ORDERING** in both

---

## Bilingual Content Consistency

**Language Toggle:**
- Weekly page: User can toggle TH/EN
- PDF: Contains BOTH languages (bilingual)

**Thai Date Format:**
- Weekly page: Buddhist Era (B.E.)
- PDF: Buddhist Era (B.E.)

**Result:** ✅ **CONSISTENT** bilingual support

---

## Evidence Summary

| Aspect | Weekly Page | Weekly PDF | Match? |
|--------|-------------|-----------|---------|
| **Data Source** | `fetchWeeklySnapshot()` | `fetchWeeklySnapshot()` | ✅ YES |
| **View Used** | `public_v_weekly_snapshots` | `public_v_weekly_snapshots` | ✅ YES |
| **Snapshot ID** | `snapshotData.snapshotId` | Same `snapshotId` | ✅ YES |
| **Date Range** | `meta.window_start/end` | Same fields | ✅ YES |
| **Story Count** | `countTotalStories()` | `countTotalStories()` | ✅ YES |
| **Hardcoded 20?** | ❌ NO | ❌ NO | ✅ DYNAMIC |
| **Ordering** | DB-ranked | DB-ranked | ✅ YES |
| **Thai Dates** | B.E. format | B.E. format | ✅ YES |

---

## Font Changes Impact

**Weekly Page:** ❌ NO IMPACT (uses web fonts, not PDF fonts)
**Weekly PDF:** ✅ IMPROVED (Static fonts + optimized layout for correct Thai rendering)

**No Data Regressions:** All data fetching logic unchanged

---

## Update 2025-10-16: Post-Thai Rendering Fix

### Font Strategy Change

**Before:** Variable font preferred → Static fonts fallback  
**After:** Static fonts preferred → Variable font fallback

**Rationale:** @react-pdf/renderer compatibility with static fonts proven more reliable for Thai

**Impact on Weekly Report:**
- ❌ Weekly page: NO IMPACT (uses web fonts)
- ✅ Weekly PDF: Font selection changed, but data source unchanged
- ✅ Snapshot source: Still same `fetchWeeklySnapshot()` function
- ✅ Story count: Still dynamic (not hardcoded)

### Layout Changes Impact

**Line Height:** 2.5 → 1.4 (titles), 1.8 → 1.35 (text)  
**Letter Spacing:** 0.05-0.2 → 0 (all elements)  
**Padding:** Reduced to minimal

**Impact on Data Consistency:**
- ❌ NO IMPACT on data fetching
- ❌ NO IMPACT on snapshot selection
- ❌ NO IMPACT on story ordering
- ✅ Visual presentation improved (no data changes)

---

**Status:** ✅ **VERIFIED — CONSISTENT**  
**Conclusion:** Weekly page and PDF share identical snapshot data source, no hardcoded limits, dynamic story count. Font and layout changes affect only PDF visual presentation, not data integrity.

---

**Related Documents:**
- EXEC_SUMMARY_PDF_THAI_FIX.md
- PDF_FONT_STACK_AUDIT.md
- PDF_LAYOUT_AUDIT.md
- BASIC_INFO_AUDIT.md

