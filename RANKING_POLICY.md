# TrendSiam Home Feed Ranking Policy

**Version**: 2.0  
**Date**: 2025-10-10  
**Status**: Active  
**Compliance**: Playbook 2.0, Asia/Bangkok Timezone

---

## Policy Statement

The TrendSiam home feed displays **freshness-first** content ranking, where "freshness" is determined by **when we captured the content** (snapshot_date), **NOT** when the platform originally published it (published_at).

This ensures users see what's **trending NOW** (regardless of platform publish date), not just what was **published today** on the platform.

---

## Core Principles

### 1. Freshness-First by Snapshot Date

**Definition**: "Today" means items we ingested/captured today (Thai timezone), regardless of their platform publish date.

**Implementation:**
```sql
-- Primary filter: Today's snapshot (Thai TZ)
WHERE COALESCE(nt.date, DATE(nt.created_at AT TIME ZONE 'Asia/Bangkok')) = thai_today
```

**Example:**
- Video published on YouTube: October 1, 2025 (9 days ago)
- We ingested it: October 10, 2025 (today, because it just went viral)
- **Result**: Appears in "Today's" feed (snapshot_date = Oct 10)

### 2. Deterministic Ranking Within Same Date

**Order (descending priority):**
```
1. is_top3 status (DESC)
2. popularity_score (DESC)  
3. video_views (DESC)
4. id (ASC) - deterministic tiebreaker
```

**Implementation:**
```sql
ROW_NUMBER() OVER (
  ORDER BY 
    CASE WHEN rank <= 3 THEN 0 ELSE 1 END,  -- is_top3 DESC
    popularity_score DESC NULLS LAST,        -- score DESC
    video_views DESC NULLS LAST,             -- views DESC
    id ASC                                    -- tiebreaker
)
```

**Why These Criteria:**
- **is_top3**: Top-3 items always appear first (policy requirement for AI images)
- **popularity_score**: Primary quality metric (0-100 range)
- **video_views**: Platform engagement indicator
- **id**: Stable tiebreaker (prevents rank flipping on ties)

### 3. Fallback Block Behavior

**Trigger**: If today's snapshot has < 20 items, append fallback block

**Fallback Logic:**
```sql
-- Fallback: Last 60 days EXCLUDING today
WHERE snapshot_date < thai_today
  AND snapshot_date >= thai_today - INTERVAL '60 days'
  AND (SELECT COUNT(*) FROM today_items) < 20
```

**Fallback Ranking:**
```sql
-- Order: Newest snapshots first, then within each date by score/views/id
ORDER BY
  snapshot_date DESC,                          -- Newest snapshots first
  CASE WHEN rank_within_date <= 3 THEN 0 ELSE 1 END,  -- is_top3 DESC
  popularity_score DESC NULLS LAST,            -- score DESC
  video_views DESC NULLS LAST,                 -- views DESC
  id ASC                                        -- tiebreaker
```

**Result Structure:**
```
[Today's Items - Ranks 1 to N]
[Fallback Block - Ranks 1000+ to avoid collisions]
```

**Never Intermixed**: Today's items ALWAYS appear before fallback items, even if fallback items have higher scores.

---

## Ranking Scenarios Explained

### Scenario 1: High Score at Bottom (EXPECTED)

**Data:**
```
Item A: score=95, snapshot_date=2025-10-09 (yesterday)
Item B: score=42, snapshot_date=2025-10-10 (today)
```

**Home Feed:**
```
Rank 1: Item B (score=42, today)
...
Rank 1001: Item A (score=95, fallback - yesterday)
```

**Explanation**: ✅ **EXPECTED BEHAVIOR**
- Item B appears first because it's in today's snapshot (freshness-first)
- Item A appears in fallback block because it's from yesterday
- This is correct: we prioritize **recent capture** over **high score**

**Why**: Users want to see what's trending **NOW**, not what was trending yesterday (even if it had a higher score then).

### Scenario 2: High Score at Top (EXPECTED)

**Data:**
```
Item A: score=95, snapshot_date=2025-10-10 (today)
Item B: score=42, snapshot_date=2025-10-10 (today)
```

**Home Feed:**
```
Rank 1: Item A (score=95, today)
Rank 2: Item B (score=42, today)
```

**Explanation**: ✅ **EXPECTED BEHAVIOR**
- Both items are from today's snapshot
- Ordered by score DESC within same snapshot_date
- High score appears at top

### Scenario 3: Score Ties

**Data:**
```
Item A: score=85.0, video_views=1,000,000, id=abc123, snapshot_date=today
Item B: score=85.0, video_views=500,000, id=def456, snapshot_date=today
```

**Home Feed:**
```
Rank 1: Item A (score=85.0, 1M views)
Rank 2: Item B (score=85.0, 500K views)
```

**Explanation**: ✅ **EXPECTED BEHAVIOR**
- Same score → tie
- Tiebreaker 1: video_views DESC → Item A wins (1M > 500K)
- Tiebreaker 2: If views also tied, use id ASC (deterministic, stable)

### Scenario 4: Old Platform Content, Recent Ingestion

**Data:**
```
Video X: published_at=2025-09-15 (25 days ago on YouTube)
         ingested=2025-10-10 (today, we just discovered it going viral)
         score=92
```

**Home Feed:**
```
Rank 1: Video X (score=92, snapshot_date=today)
```

**Explanation**: ✅ **EXPECTED BEHAVIOR**
- Platform publish date is old (Sept 15) but we captured it today (Oct 10)
- Appears in today's feed because snapshot_date = today
- Story Details will show "Published: September 15" (platform date)
- Home ranking uses snapshot_date = today (our capture date)

**Why**: This video is trending **NOW** even though it's an old video. Users should see it on today's feed.

---

## Date Fields Clarification

### Two Distinct Fields

| Field | Purpose | Used For | Source | Display |
|-------|---------|----------|--------|---------|
| **`published_at`** | Platform's original publish date | Display-only (Story Details) | Platform API | ✅ Visible: "Published: Oct 1, 2025" |
| **`snapshot_date`** | Our ingestion/capture date | Filtering/ranking | `news_trends.date` or `created_at` | ❌ Hidden: Internal use only |

### Why Both Are Needed

**Without `snapshot_date`:**
```
Problem: Old viral content never appears on home (even if we just ingested it today)
Example: Video from 2020 goes viral today → filtered out (published_at = 2020 ≠ today)
```

**Without `published_at`:**
```
Problem: Users don't know when content was originally published
Example: "Published: October 10" (today) → misleading, video is from 2020
```

**With Both:**
```
Solution: Rank by snapshot_date (freshness), display published_at (attribution)
Example: Rank #1 (captured today), "Published: March 2020" (platform date)
```

---

## Filtering Rules

### Primary Window (Today's Snapshot)

**SQL:**
```sql
WHERE COALESCE(nt.date, DATE(nt.created_at AT TIME ZONE 'Asia/Bangkok')) = thai_today
```

**Includes:**
- ✅ All items ingested today (regardless of platform publish date)
- ✅ Items with any popularity_score (no score cutoff)

**Excludes:**
- ❌ Items ingested yesterday or earlier (even if high score)

**Rank Assignment:**
```sql
ROW_NUMBER() OVER (
  ORDER BY
    CASE WHEN rank <= 3 THEN 0 ELSE 1 END,  -- is_top3 DESC
    popularity_score DESC NULLS LAST,        -- score DESC
    video_views DESC NULLS LAST,             -- views DESC
    id ASC                                    -- tiebreaker
)
```

**Result:**
- Ranks: 1, 2, 3, ..., N (where N = count of today's items)
- Top-3 items (ranks 1-3) eligible for AI images

### Fallback Window (Last 60 Days)

**Trigger:**
```sql
AND (SELECT COUNT(*) FROM today_items) < 20
```

**SQL:**
```sql
WHERE snapshot_date < thai_today
  AND snapshot_date >= thai_today - INTERVAL '60 days'
```

**Includes:**
- ✅ Items from last 60 days (excluding today)
- ✅ Only activated if today < 20 items

**Rank Assignment:**
```sql
1000 + ROW_NUMBER() OVER (
  ORDER BY
    snapshot_date DESC,                          -- Newest first
    CASE WHEN rank_within_date <= 3 THEN 0 ELSE 1 END,
    popularity_score DESC NULLS LAST,
    video_views DESC NULLS LAST,
    id ASC
)
```

**Result:**
- Ranks: 1001, 1002, 1003, ..., 1000+M (where M = count of fallback items)
- Always appear AFTER today's items (due to rank offset)

---

## API Response Structure

### Home API (`/api/home`)

**Query:**
```sql
SELECT * FROM home_feed_v1 ORDER BY priority ASC, rank ASC LIMIT 20;
```

**Priority:**
- `priority=1`: Today's items
- `priority=2`: Fallback items

**Response:**
```json
{
  "success": true,
  "fetchedCount": 20,
  "data": [
    {
      "id": "...",
      "rank": 1,
      "isTop3": true,
      "publishedAt": "2025-09-15T...",  // Platform date (display-only)
      "snapshotDate": "2025-10-10",     // Our capture date (internal, optional)
      "popularityScore": 95.8,
      ...
    }
  ],
  "meta": {
    "updatedAt": "2025-10-10T..."
  }
}
```

**Field Usage:**
- `publishedAt`: Display in Story Details "Published" label
- `snapshotDate`: Internal use only (not shown in UI)
- `rank`: Display position on home feed
- `isTop3`: Determines if AI image should be shown

---

## Score Distribution Expectations

### Today's Snapshot

**Expected Distribution:**
```
Score Range    | Expected Count | Notes
---------------|----------------|-------
95-100 (Top)   | 1-5 items      | Rare, viral content
85-94 (Exc)    | 5-15 items     | Strong engagement
70-84 (Good)   | 10-30 items    | Moderate engagement
50-69 (Avg)    | 20-50 items    | Building momentum
0-49 (Low)     | 10-20 items    | Early stage
```

**No Hidden Cutoff:**
- ❌ No filtering by score (e.g., `WHERE score >= 78`)
- ✅ All items from today's snapshot included, regardless of score
- ✅ Ranking is score-based, but no items are filtered out

**Verification Query:**
```sql
SELECT 
  CASE
    WHEN popularity_score >= 95 THEN '95-100 (Top)'
    WHEN popularity_score >= 85 THEN '85-94 (Exc)'
    WHEN popularity_score >= 70 THEN '70-84 (Good)'
    WHEN popularity_score >= 50 THEN '50-69 (Avg)'
    ELSE '0-49 (Low)'
  END AS score_range,
  COUNT(*) AS count
FROM home_feed_v1
WHERE snapshot_date = (SELECT DATE(NOW() AT TIME ZONE 'Asia/Bangkok'))
GROUP BY score_range
ORDER BY MIN(popularity_score) DESC;
```

---

## Diagnostics & Monitoring

### Key Metrics

**Daily Checks:**
```sql
-- 1. Today's count
SELECT COUNT(*) FROM home_feed_v1 
WHERE snapshot_date = (SELECT DATE(NOW() AT TIME ZONE 'Asia/Bangkok'));

-- 2. Fallback activation
SELECT 
  CASE WHEN COUNT(*) < 20 THEN 'ACTIVE' ELSE 'INACTIVE' END AS fallback_status
FROM home_feed_v1
WHERE snapshot_date = (SELECT DATE(NOW() AT TIME ZONE 'Asia/Bangkok'));

-- 3. Score distribution
SELECT 
  MIN(popularity_score) AS min,
  ROUND(AVG(popularity_score)::numeric, 1) AS avg,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY popularity_score) AS median,
  MAX(popularity_score) AS max
FROM home_feed_v1
WHERE snapshot_date = (SELECT DATE(NOW() AT TIME ZONE 'Asia/Bangkok'));

-- 4. Date alignment check
SELECT 
  published_at::date AS platform_date,
  snapshot_date AS ingestion_date,
  COUNT(*) AS count
FROM home_feed_v1
WHERE snapshot_date = (SELECT DATE(NOW() AT TIME ZONE 'Asia/Bangkok'))
GROUP BY published_at::date, snapshot_date
ORDER BY snapshot_date DESC, COUNT(*) DESC
LIMIT 10;
```

### Automated Checker Script

**Path**: `frontend/scripts/data-freshness-check.mjs`

**Checks:**
- ✅ Today's count >= 1
- ✅ Fallback status (active/inactive)
- ✅ Score distribution (min/median/max)
- ✅ Buckets: `<70`, `70-85`, `>85`
- ✅ Top 5 items: snapshot_date, score, is_top3, video_views, published_at
- ✅ Bottom 5 items: same fields (to verify no intermixing)

**Usage:**
```bash
node frontend/scripts/data-freshness-check.mjs
```

**Expected Output:**
```
✅ Today's snapshot: 149 items
✅ Fallback: INACTIVE (today >= 20)
✅ Score distribution: min=41.7, avg=65.3, median=63.2, max=95.8
✅ Score buckets: <70 (89), 70-85 (45), >85 (15)
✅ Top 5 items:
   #1: snapshot=2025-10-10, score=95.8, is_top3=true, views=4934531, published=2025-09-20
   #2: snapshot=2025-10-10, score=92.4, is_top3=true, views=4036507, published=2025-09-18
   ...
✅ Bottom 5 items:
   #145: snapshot=2025-10-10, score=42.1, is_top3=false, views=12345, published=2025-10-01
   ...
```

---

## Edge Cases

### Case 1: No Items Today

**Scenario:** Pipeline hasn't run today

**Behavior:**
```
- Primary window: 0 items
- Fallback window: Activated automatically
- Result: Shows last 60 days' items, ordered by snapshot_date DESC
```

**User Impact:** Low - still see recent trending content

### Case 2: All Items Have Same Score

**Scenario:** All items have score=85.0

**Behavior:**
```
- Tiebreaker 1: video_views DESC (higher views wins)
- Tiebreaker 2: id ASC (deterministic, stable)
- Result: Consistent ordering, no rank flipping
```

**User Impact:** None - stable ordering maintained

### Case 3: Platform Date Missing

**Scenario:** `published_at` is NULL

**Behavior:**
```
- Story Details: Shows "—" placeholder (not snapshot_date)
- Home ranking: Unaffected (uses snapshot_date)
- Result: No confusion about dates
```

**User Impact:** Low - users know date is unavailable

### Case 4: Snapshot Date Missing

**Scenario:** `news_trends.date` is NULL AND `created_at` is NULL (shouldn't happen)

**Behavior:**
```
- Fallback: Use current date as snapshot_date
- Log warning: "Missing snapshot_date for item {id}"
- Result: Item appears in today's feed (safe default)
```

**User Impact:** None - item still appears

---

## Migration History

### Version 1.0 (Before Oct 9)

**Filtering:** No date filtering  
**Ranking:** `popularity_score DESC NULLS LAST`  
**Problem:** Showed all-time top items, not today's snapshot

### Version 1.5 (Oct 9)

**Filtering:** `DATE(published_at AT TIME ZONE 'Asia/Bangkok') = today`  
**Ranking:** `score DESC, published_at DESC, id`  
**Problem:** Used platform publish date for "today", missed recently ingested old content

### Version 2.0 (Oct 10) - Current

**Filtering:** `COALESCE(nt.date, DATE(created_at AT TIME ZONE 'Asia/Bangkok')) = today`  
**Ranking:** `is_top3 DESC, score DESC, video_views DESC, id ASC`  
**Improvement:** Uses snapshot date for freshness, deterministic ranking, separate display date

---

## Future Enhancements

### Potential Improvements (Not Implemented)

1. **Time-Based Sub-Ranking**
   - Rank by: snapshot_date + snapshot_time (hour-level freshness)
   - Benefit: Users see "just now" content at top
   - Complexity: Requires snapshot_datetime field

2. **Personalization**
   - Rank by: user preferences + score
   - Benefit: Users see content matching their interests
   - Complexity: Requires user profile + ML model

3. **Category-Aware Ranking**
   - Rank by: category diversity + score
   - Benefit: Users see mix of categories, not all one type
   - Complexity: Requires category balancing logic

4. **Time Decay**
   - Rank by: (score * time_decay_factor) + snapshot_recency
   - Benefit: Newer content gets boost, older content fades
   - Complexity: Requires decay parameter tuning

---

## Summary

**Ranking Policy (2.0):**
```
1. Freshness-first by snapshot_date (Thai TZ)
2. Within same date: is_top3 DESC → score DESC → video_views DESC → id ASC
3. Fallback block (if today < 20): Last 60 days, ordered by snapshot_date DESC
4. No score cutoff, no pre-LIMIT filtering
5. High-score items in fallback may appear below low-score items in today's feed (expected)
```

**Key Fields:**
```
- published_at: Platform's original publish date (display-only, Story Details)
- snapshot_date: Our ingestion date (ranking/filtering only, Thai TZ)
```

**Acceptance Criteria:**
```
✅ Today's snapshot appears first (not platform's "today")
✅ Ranking is deterministic (is_top3, score, views, id)
✅ No hidden cutoff (all items from today included)
✅ Fallback block AFTER today (never intermixed)
✅ High scores in fallback explained (older snapshot = lower priority)
```

---

**Policy Owner**: TrendSiam Team  
**Last Updated**: 2025-10-10  
**Next Review**: After 30 days of production usage

