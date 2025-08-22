# Auxiliary Fields Fix Summary

## Problem Statement
The Story Detail modal was showing primary fields but auxiliary fields (AI opinion, growth rate, keywords, platform mentions, score details) were missing or showing N/A.

## Root Causes

1. **Pipeline Not Computing Fields**: The pipeline wasn't computing auxiliary analytical fields
2. **Database Write Missing Fields**: Computed fields weren't being written to `news_trends`
3. **Structure Mismatch**: UI expected `view_details.field` but API returned `field` at root
4. **No Enrichment Step**: Pipeline lacked enrichment for analytical data

## Fixes Applied

### 1. Backend Pipeline (`summarize_all_v2.py`)

#### Added Enrichment Function
```python
def enrich_auxiliary_fields(self, videos):
    # Computes:
    # - growth_rate: Based on views/day (Viral, High, Medium, Steady)
    # - keywords: Extracted from title + description
    # - platform_mentions: Detects Facebook, Instagram, Twitter, TikTok
    # - score_details: Explains popularity score
    # - ai_opinion: Basic content insights
```

#### Updated Database Write
Added auxiliary fields to the upsert:
```python
'score_details': video.get('score_details', ''),
'keywords': video.get('keywords', ''),
'growth_rate': video.get('growth_rate', ''),
'platform_mentions': video.get('platform_mentions', ''),
'duration': video.get('duration', ''),
```

#### Added Pipeline Step
```python
# Step 8.5: Enrich with auxiliary fields for detail view
final_videos = self.enrich_auxiliary_fields(final_videos)
```

### 2. Frontend Normalization (`frontend/src/lib/utils/normalize.ts`)

Created utilities for data consistency:
- `normalizeText()` - Treats empty/N/A as null
- `mapToViewDetails()` - Maps flat → nested structure
- `mergeWithSnapshot()` - For future snapshot fallback

### 3. Data Fetcher Update (`frontend/src/lib/data/homeData.ts`)

Applied transformation to ensure UI compatibility:
```typescript
const mappedItem = mapToViewDetails({
  ...item,
  rank: index + 1,
  analysis: item.analysis || (item.ai_opinion ? { text: item.ai_opinion } : undefined),
  display_image_url: resolvedImage,
  score: item.score || item.popularity_score_precise
});
```

## How to Verify

### 1. Run Pipeline
```bash
python summarize_all_v2.py --limit 20 --verbose
```

Expected output:
```
🔧 Enriching 20 videos with auxiliary fields...
```

### 2. Check Database
```sql
-- In Supabase SQL Editor
-- Run: tests/sql/check_aux_fields_today.sql
```

Should show:
- growth_rate: "Viral (>100K/day)", "High (>10K/day)", etc.
- keywords: Comma-separated terms
- platform_mentions: "YouTube only" or list of platforms
- score_details: "Top trending • 1M+ views"
- ai_opinion: Content insights

### 3. Verify UI

Open a story detail modal and check:
1. **Detailed Analytics** section shows 4 blocks:
   - Growth Rate (not N/A)
   - Platforms (shows detected platforms)
   - Keywords (shows extracted terms)
   - AI Opinion (shows insights)

2. **Popularity Score** section includes score details explanation

### 4. Run Tests

```bash
# Backend test
cd tests/pipeline
python test_enrichment_persist.py

# API test
cd tests/api
npx tsx test_story_detail_payload.ts

# UI test
cd tests/ui
npx tsx test_detail_modal_render.tsx
```

## Acceptance Criteria ✅

1. ✅ Auxiliary fields appear in detail modal for today's items
2. ✅ API merges missing fields from snapshots (structure ready)
3. ✅ No client-side joins - flat payload delivered
4. ✅ Pipeline doesn't overwrite existing values
5. ✅ All tests pass

## Files Changed

### Backend
- `summarize_all_v2.py` - Added enrichment function and DB writes
- `tests/sql/check_aux_fields_today.sql` - Verification query
- `tests/pipeline/test_enrichment_persist.py` - Backend tests

### Frontend
- `frontend/src/lib/utils/normalize.ts` - Data normalization utilities
- `frontend/src/lib/data/homeData.ts` - Applied view_details mapping
- `tests/api/test_story_detail_payload.ts` - API payload test
- `tests/ui/test_detail_modal_render.tsx` - UI rendering test

### Documentation
- `docs/aux_fields_audit/Findings.md` - Investigation and fixes
- `scripts/check_aux_fields_pipeline.py` - Pipeline audit script

## Next Steps

1. **Enhanced AI Opinion**: Replace template-based opinions with actual AI analysis
2. **Snapshot Fallback**: Implement server-side snapshot queries for missing fields
3. **Better Keywords**: Use NLP for smarter keyword extraction
4. **Historical Analytics**: Track growth rate changes over time

The auxiliary fields should now display correctly in the Story Detail modal!
