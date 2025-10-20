# Home Feed 500 Error Fix - Complete Report

**Date**: 2025-10-08  
**Status**: ✅ **FIXED**  
**Issue**: "invalid input syntax for type integer" 22P02 error  
**Execution Time**: ~20 minutes  

---

## Executive Summary

Fixed the "Unable to Load News" 500 error caused by attempting to cast the text field `platform_mentions` (containing comma-separated platform names like "Facebook, Instagram, Twitter/X...") to an integer in the database view. The migration from earlier today inadvertently included an unsafe `::integer` cast that PostgreSQL rejected.

**Result**: `/api/home` now returns 20 items successfully with `platform_mentions` properly handled as TEXT.

---

## Root Cause Analysis (RCA)

### Symptoms
- **UI**: "Unable to Load News — Home API returned 500: Internal Server Error"
- **Server logs**: `invalid input syntax for type integer: "Facebook, Instagram, Twitter/X, TikTok, Spotify, Apple Music"`
- **PostgreSQL error code**: 22P02 (invalid text representation)

### Investigation
1. **Column type inspection**: Confirmed `platform_mentions` in both `news_trends` and `snapshots` tables is **TEXT** type
2. **Sample data**: Values like "Facebook, Instagram, Twitter/X, TikTok, Spotify, Apple Music" or "Primary platform only"
3. **Migration file review**: Found `nt.platform_mentions::integer` cast on line 140 of the migration SQL

### Root Causes Identified

| # | Root Cause | Impact | Location |
|---|------------|--------|----------|
| **1** | **Unsafe integer cast on text field** | 🔴 **CRITICAL** - 500 error | SQL migration line 135-142 |
| 2 | TypeScript schema mismatch | 🟡 MEDIUM - Type errors | mapNews.ts line 43, 86 |
| 3 | Unused CTE confusing LSP | 🟢 LOW - False LSP errors | SQL migration line 35-40 |

**Primary root cause**: Migration attempted `nt.platform_mentions::integer` when the column contains text values.

---

## Solution Implemented

### 1. Database Migration Fixed

**File**: `frontend/db/sql/fixes/2025-10-08_fix_home_views_zero_rows.sql`

**Changes**:
- ✅ **Removed unsafe cast**: Changed from complex COALESCE with integer casting to simple text handling:
  ```sql
  -- BEFORE (broken):
  COALESCE(
    CASE WHEN snap.platform_mentions ~ '^[0-9]+$' THEN snap.platform_mentions::integer ELSE NULL END,
    nt.platform_mentions::integer,  -- ❌ This fails!
    0
  ) AS platform_mentions
  
  -- AFTER (fixed):
  COALESCE(snap.platform_mentions, nt.platform_mentions, 'Primary platform only') AS platform_mentions
  ```
- ✅ **Removed unused CTE**: Deleted `platform_id` CTE that was never referenced
- ✅ **Kept case-insensitive filter**: `WHERE LOWER(nt.platform) = 'youtube'`
- ✅ **Maintained web_view_count**: Column 27 properly exposed

### 2. TypeScript Mapper Fixed

**File**: `frontend/src/lib/mapNews.ts`

**Changes**:
- ✅ Line 43: `platform_mentions: z.number()` → `z.string()`
- ✅ Line 86: `platformMentions: z.number()` → `z.string()`
- ✅ Line 203: Simplified view_details formatting to use raw text value

### 3. Migration Re-executed

- Dry-run passed: 149 rows confirmed
- Execution successful: Both views recreated
- TypeScript compilation clean: 0 errors

---

## Verification Results

### API Endpoints ✅

```powershell
# /api/home
✅ SUCCESS: API returned data
   Items count: 20
   First item title: Stray Kids "CEREMONY" M/V
   First item platformMentions: Facebook, Instagram, Twitter/X, TikTok, Spotify, Apple Music
   Schema guard hasWebViewCount: True
   Schema guard usingFallback: False

# /api/home/diagnostics
✅ SUCCESS: Diagnostics returned data
   Items count: 10
   Columns count: 27
   Missing columns: 0
   ✅ No missing columns!
```

### Database ✅

```sql
home_feed_v1: 149 rows (27 columns)
public_v_home_news: 149 rows (26 columns)

Sample row:
  title: "Stray Kids \"CEREMONY\" M/V"
  rank: 1
  popularity_score: 95.935
  web_view_count: 4934529
  platform_mentions: "Facebook, Instagram, Twitter/X, TikTok, Spotify, Apple Music"
```

### TypeScript ✅

```bash
npx tsc --noEmit
# Exit code: 0 (no errors)
```

### LSP Status ⚠️

**PostgresTools LSP**: 2 false-positive errors (view syntax valid, PostgreSQL accepts it)
- Line 33: "syntax error at end of input" - **False positive** (dry-run passed)
- Line 168: "relation joined_data does not exist" - **False positive** (migration executed successfully)

**Note**: These are LSP bugs with the `WITH (options) AS WITH cte AS` syntax pattern. The SQL is valid and executes correctly.

---

## Files Modified

| File | Type | Lines Changed | Description |
|------|------|---------------|-------------|
| `frontend/db/sql/fixes/2025-10-08_fix_home_views_zero_rows.sql` | Modified | -8, +1 | Fixed platform_mentions handling |
| `frontend/src/lib/mapNews.ts` | Modified | 3 | Changed platform_mentions type to string |
| `scripts/db/check-column-types.sql` | New | 32 | Diagnostic query for column types |
| `scripts/test-api-quick.ps1` | New | 56 | PowerShell API test script |
| `HOME_FEED_500_ERROR_FIX_COMPLETE.md` | New | This file | Complete RCA |

**Total**: 5 files (2 new, 2 modified, 1 report)

---

## Regression Testing

| Feature | Status | Notes |
|---------|--------|-------|
| /api/home returns data | ✅ Pass | 20 items returned |
| platform_mentions as text | ✅ Pass | Shows comma-separated list |
| web_view_count present | ✅ Pass | Column 27 exposed |
| Schema guard working | ✅ Pass | hasWebViewCount=true, usingFallback=false |
| No missing columns | ✅ Pass | Diagnostics shows 0 missing |
| TypeScript compilation | ✅ Pass | 0 errors |
| Top-3 policy | ✅ Pass | Images only for rank 1-3 |
| Bilingual summaries | ✅ Pass | Both summary and summary_en present |

---

## Key Lessons Learned

1. **Never cast text fields to numeric without validation**: Always check column types before applying casts
2. **Sample data reveals type mismatches**: The error message showed the actual data ("Facebook, Instagram...") 
3. **LSP can have false positives**: Valid SQL may trigger LSP errors; always test with dry-run
4. **Type consistency across stack**: Database → Zod schemas → TypeScript types must align
5. **Diagnostic queries are essential**: Quick column type checks prevent deployment errors

---

## Troubleshooting Guide

### Error: "invalid input syntax for type integer"

**Symptoms**: 500 error, PostgreSQL 22P02 error code

**Diagnosis**:
1. Check error message for the failing value (e.g., "Facebook, Instagram...")
2. Identify which column is being cast
3. Query column type: `\d+ table_name` or check information_schema
4. Check sample data for that column

**Common Causes**:
- Casting comma-separated lists to integers
- Casting descriptive text ("Primary platform only") to numbers
- Missing regex validation before casting
- Type mismatches between base table and view expectations

**Solution**:
- Keep text fields as TEXT in views
- Use COALESCE for NULL handling, not casting
- Apply casts ONLY to genuinely numeric columns (view_count, like_count, etc.)
- Add regex validation before any text-to-numeric cast: `CASE WHEN col ~ '^[0-9]+$' THEN col::integer ELSE 0 END`

---

## Summary (5 lines)

1. **Root cause**: Migration incorrectly cast `platform_mentions` (TEXT with values like "Facebook, Instagram...") to `::integer` → PostgreSQL 22P02 error.
2. **Fix**: Removed unsafe cast, kept `platform_mentions` as TEXT; updated TypeScript schemas from `z.number()` to `z.string()`.
3. **Verification**: `/api/home` returns 20 items with `platformMentions: "Facebook, Instagram, Twitter/X..."` and all 27 columns present.
4. **Compliance**: Idempotent SQL, Plan-B security maintained, no Git push, TypeScript clean (0 errors).
5. **Result**: 500 error resolved, home feed displays correctly, schema guard shows `hasWebViewCount: true, usingFallback: false`.

---

## Compliance Checklist

- ✅ Idempotent SQL (safe to re-run)
- ✅ Plan-B security (SECURITY DEFINER views, no base table grants)
- ✅ No Git push performed
- ✅ TypeScript compilation clean
- ✅ API endpoints tested and verified
- ✅ Documentation updated (this RCA + memory bank update pending)
- ✅ Graceful fallback maintained (schema guard working)
- ✅ No hardcoded values or secrets

---

**Status**: 🟢 **PRODUCTION READY**  
**Confidence**: HIGH ✅  
**Next Action**: Update memory bank and WEB_VIEWS_TRACKING.md with troubleshooting section

---

_End of Report_

