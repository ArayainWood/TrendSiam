# Sample Verification Output — 2025-10-10 Hotfix

This document shows the expected output when running the verification script after applying the hotfix.

---

## Command

```bash
node frontend/scripts/verify-home-snapshot.mjs
```

---

## Expected Output (All Tests Pass)

```
╔════════════════════════════════════════════════════════════╗
║     Home Feed Snapshot Date Verification (2025-10-10)     ║
╚════════════════════════════════════════════════════════════╝

📋 Test 1: View Column Schema
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  Total columns: 29
✅ Column present: id
✅ Column present: title
✅ Column present: published_at
✅ Column present: snapshot_date
✅ Column present: rank
✅ Column present: popularity_score
✅ Column present: is_top3
✅ Column present: views
✅ Column present: image_url
✅ Column present: source_url
✅ published_at and snapshot_date are distinct

🌐 Test 2: API Health Check
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  Status: 200
✅ API returns 200 OK
ℹ️  Fetched 20 items
✅ API response includes both publishedAt and snapshotDate

🎯 Test 3: Ranking Determinism
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  Checking ranking for 10 items...
✅ Ranks are sequential
✅ Top-3 flags are correct

📊 Test 4: Score Distribution (Today)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  Today (Bangkok): 2025-10-10
ℹ️  Found 20 items for today

Score Distribution:
  High (≥85): 3 items
  Mid (70-85): 12 items
  Low (<70): 5 items
  Range: 45.2 - 92.7

✅ Score diversity present (no hidden cutoff at 70)

📅 Test 5: Freshness Filtering (snapshot_date)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  Found 1 distinct snapshot dates
  2025-10-10: 20 items (ranks: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20)
✅ Today's items (2025-10-10) appear first

═══════════════════════════════════════════════════════════
SUMMARY
═══════════════════════════════════════════════════════════
Tests: 5/5 passed

✅ All tests passed!
```

**Exit Code:** 0 (success)

---

## Key Indicators (What to Check)

### ✅ View Schema (Test 1)

**Critical Columns:**
- ✅ `published_at` (platform date, display-only)
- ✅ `snapshot_date` (ingestion date, ranking)
- ✅ Both dates are **distinct** (not equal)

**What This Proves:**
- View has been successfully rebuilt with new column
- Two date fields are separate and serve different purposes
- Frontend can now query both fields without error

### ✅ API Health (Test 2)

**Status Code:**
- ✅ `200` (not `500`)

**Response Structure:**
- ✅ `data` array present
- ✅ `publishedAt` field in each item
- ✅ `snapshotDate` field in each item (optional but present)

**What This Proves:**
- API no longer crashes on missing column
- Defensive error handling works
- Frontend receives both date fields

### ✅ Ranking (Test 3)

**Sequential Ranks:**
```
Rank 1 → Rank 2 → Rank 3 → ... → Rank N (no gaps)
```

**Top-3 Flags:**
```
Rank 1: is_top3=true ✅
Rank 2: is_top3=true ✅
Rank 3: is_top3=true ✅
Rank 4: is_top3=false ✅
```

**What This Proves:**
- Ranking is deterministic (no ties causing flips)
- Top-3 logic is correct
- Order stable across queries

### ✅ Score Distribution (Test 4)

**Diverse Buckets:**
```
High (≥85):  3 items   (viral content)
Mid (70-85): 12 items  (strong engagement)
Low (<70):   5 items   (building momentum)
```

**What This Proves:**
- No hidden score cutoff (e.g., `WHERE score >= 70`)
- All items from today included, regardless of score
- Distribution is natural (not artificially filtered)

### ✅ Freshness (Test 5)

**Today First:**
```
2025-10-10: 20 items (ranks: 1-20) ← Today
(No other dates in primary window)
```

**What This Proves:**
- Filtering by `snapshot_date` works (Thai TZ)
- Today's items appear first
- No intermixing with older snapshots

---

## Alternative Output (If No Data Yet)

If pipeline hasn't run today:

```
📋 Test 1: View Column Schema
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  Total columns: 29
✅ Column present: snapshot_date
⚠️  View exists but has no data (pipeline may not have run)

🌐 Test 2: API Health Check
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ API returns 200 OK
⚠️  API returned empty data (pipeline may not have run)

... (remaining tests skip data checks)

═══════════════════════════════════════════════════════════
SUMMARY: Tests: 5/5 passed
✅ All tests passed!
```

**Note:** Empty data is **OK** if pipeline hasn't run. Key is that:
1. View has `snapshot_date` column ✅
2. API returns 200 (not 500) ✅
3. No schema errors ✅

---

## Failure Scenarios (What to Watch For)

### ❌ Test 1 Fails: Column Missing

```
❌ Column missing: snapshot_date

→ Action: Re-run migration
→ Command: psql -f frontend/db/sql/fixes/2025-10-10_hotfix_snapshot_date.sql
```

### ❌ Test 2 Fails: API Returns 500

```
ℹ️  Status: 500
❌ API returned 500 instead of 200
Response: {"error": "column snapshot_date does not exist"}

→ Action: Check if migration completed
→ Verify: SELECT snapshot_date FROM home_feed_v1 LIMIT 1;
```

### ❌ Test 3 Fails: Ranks Not Sequential

```
❌ Rank not sequential: 1 → 3 (gap detected)

→ Action: Check view definition, ranking logic may be broken
→ Debug: SELECT rank, title FROM home_feed_v1 ORDER BY rank LIMIT 10;
```

### ❌ Test 4 Fails: All Scores High

```
⚠️  All scores >= 70 (may have a cutoff)

→ Action: Check if WHERE clause filters low scores
→ Debug: SELECT MIN(popularity_score) FROM home_feed_v1 WHERE snapshot_date = today;
```

### ❌ Test 5 Fails: Old Dates First

```
⚠️  Latest snapshot is 2025-10-09, expected today (2025-10-10)

→ Action: Pipeline may not have run today
→ Fix: Run python summarize_all_v2.py --force-refresh-stats
```

---

## SQL Quick Checks (Manual Verification)

If automated script has issues, run these SQL queries manually:

### 1. Check View Columns
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'home_feed_v1'
  AND column_name IN ('published_at', 'snapshot_date')
ORDER BY column_name;

-- Expected:
-- published_at  | timestamp with time zone
-- snapshot_date | date
```

### 2. Check Data Presence
```sql
SELECT 
  snapshot_date,
  COUNT(*) AS count,
  MIN(popularity_score) AS min_score,
  MAX(popularity_score) AS max_score
FROM home_feed_v1
WHERE snapshot_date = DATE(NOW() AT TIME ZONE 'Asia/Bangkok')
GROUP BY snapshot_date;

-- Expected: >= 1 row with today's date
```

### 3. Check Ranking
```sql
SELECT rank, is_top3, popularity_score, video_views, id
FROM home_feed_v1
ORDER BY rank ASC
LIMIT 10;

-- Expected: Sequential ranks (1,2,3...), Top-3 flagged, scores descending
```

### 4. Check Date Distinction
```sql
SELECT 
  published_at::date AS platform_date,
  snapshot_date AS ingestion_date,
  COUNT(*) AS count
FROM home_feed_v1
WHERE snapshot_date = DATE(NOW() AT TIME ZONE 'Asia/Bangkok')
GROUP BY published_at::date, snapshot_date
ORDER BY count DESC
LIMIT 5;

-- Expected: Different platform dates, same snapshot_date (today)
```

---

## Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | All tests passed | ✅ Proceed to production |
| 1 | 1+ tests failed | ❌ Check failures, fix issues |
| Error | Script crashed | 💥 Check Supabase connection, env vars |

---

## Checklist for Manual Verification

- [ ] Migration completed without SQL errors
- [ ] View `home_feed_v1` exists
- [ ] Column `snapshot_date` is selectable
- [ ] Column `published_at` is selectable
- [ ] Both dates are distinct (not always equal)
- [ ] API returns HTTP 200 (not 500)
- [ ] API response has `data` array
- [ ] Items have both `publishedAt` and `snapshotDate` fields
- [ ] Ranks are sequential (1, 2, 3, ...)
- [ ] Top-3 items have `is_top3=true`
- [ ] Score distribution is diverse (not all >= 70)
- [ ] Today's snapshot_date items appear first

---

**Documentation Date:** 2025-10-10  
**Verification Script:** `frontend/scripts/verify-home-snapshot.mjs`  
**Related Docs:** `HOME_API_HOTFIX_REPORT.md`, `HOTFIX_2025-10-10_SUMMARY.md`

