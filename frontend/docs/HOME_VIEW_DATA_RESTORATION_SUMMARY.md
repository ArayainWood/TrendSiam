# Home View Data Restoration Summary

## Problem
After fixing the permission and zero-rows issues, the home view was missing critical data:
- English summaries (summary_en) were not showing
- Analysis fields (ai_opinion, score_details) were missing
- Popularity scores were not properly retrieved
- The LISA item specifically was missing its detailed analysis

## Root Cause Analysis
1. The simplified view created earlier only pulled data from news_trends directly
2. It didn't properly join with snapshots table for latest metrics
3. Analysis fields (ai_opinion, score_details) are stored in news_trends, not snapshots
4. English summaries exist in both stories and news_trends tables but weren't being coalesced

## Solution
Created `2025-09-26_home_view_with_latest_snapshot.sql` that properly joins all data sources:

### Data Source Mapping
```sql
-- English summaries
summary_en: COALESCE(stories.summary_en, news_trends.summary_en)

-- Analysis fields (from news_trends)
ai_opinion: news_trends.ai_opinion
score_details: news_trends.score_details

-- Metrics (prefer latest snapshot, fallback to news_trends)
popularity_score: COALESCE(snapshots.popularity_score, news_trends.popularity_score)
rank: COALESCE(snapshots.rank, calculated_rank)
views/likes/comments: COALESCE(snapshots.*, news_trends.*)

-- Images (Top-3 only)
image_url: CASE WHEN is_top3 THEN COALESCE(ai_images.image_url, news_trends.ai_image_url)
```

### Key Implementation Details
1. **Primary data source**: news_trends (has all the analysis fields)
2. **Joins**:
   - LEFT JOIN stories for additional translations
   - LEFT JOIN latest_snapshots for current metrics
   - LEFT JOIN public_v_ai_images_latest for AI images
3. **All joins are LEFT** to ensure no rows are dropped
4. **Proper type conversions** for all numeric fields
5. **JSON validation** for score_details field

## Testing
The fix includes:
- `2025-09-26_debug_lisa_item.sql` - Specific checks for LISA data completeness
- Verification within the migration that checks all 26 columns
- Sample LISA item validation

## Results
After applying the fix:
- ✅ All 26 columns present in correct order
- ✅ English summaries (summary_en) restored
- ✅ AI opinion and score details visible
- ✅ Popularity scores properly calculated
- ✅ LISA item shows complete analysis
- ✅ Plan-B security model maintained

## Security Notes
- View uses definer semantics (security_invoker = false)
- Base tables remain inaccessible to anon/authenticated
- Only public_v_* views are exposed
- No system_meta dependencies
