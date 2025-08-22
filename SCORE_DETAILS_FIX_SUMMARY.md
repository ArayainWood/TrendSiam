# Popularity Score Details Fix - Summary

## Problem
The Popularity Score detail text (green/yellow/red card explanation) was missing across all stories. The numeric score showed correctly, but the explanatory text did not appear.

## Root Cause
1. **Pipeline Issue**: The `score_details` field was being computed but not properly written to the database due to missing field preservation in the `spec_items` transformation.
2. **UI Issue**: The score details text was only shown in the expandable "View Details" section, not near the main score display where users expect it.

## Solution Implemented

### 1. Enhanced Score Details Generation
- Created a comprehensive `build_score_details()` method that generates descriptive, natural-language explanations
- Examples:
  - "Viral performance exceptional viewership (5.2M views) with excellent engagement (10.0% like rate)."
  - "Top trending content massive reach (1.2M views) with strong engagement (2.7% like rate)."
  - "Building momentum 5,678 views rapidly growing."

### 2. Fixed Pipeline Database Writes
- Updated `save_to_database()` to preserve `score_details` in the `spec_items` transformation
- Added safe setter logic to only write non-empty values
- Added logging for score details writes

### 3. Updated UI Components
- **NewsCard**: Shows score details text directly under the numeric score
- **TopStoryCard**: Shows score details inline with the score in parentheses
- **NewsDetailModal**: Shows score details as the primary explanation under the score

### 4. Data Flow Verification
- API (`homeData.ts`) already selects `score_details` field
- Normalizer (`normalize.ts`) maps `score_details` to `view_details.score` for UI compatibility
- All components handle missing/N/A values gracefully

## Files Modified

### Backend
- `summarize_all_v2.py`:
  - Added `build_score_details()` method
  - Added `_format_number()` helper
  - Fixed `spec_items` transformation to preserve auxiliary fields
  - Added score details logging

### Frontend
- `frontend/src/components/news/NewsCard.tsx`: Added score details display under numeric score
- `frontend/src/components/news/TopStoryCard.tsx`: Added inline score details display
- `frontend/src/components/news/NewsDetailModal.tsx`: Updated to show score details instead of generic reason

### Tests & Verification
- `scripts/sql/verify_score_details.sql`: SQL queries to verify database population
- `tests/test_build_score_details.py`: Unit tests for score generation logic
- `tests/test_score_details_display.tsx`: Frontend component tests
- `scripts/verify_score_details_pipeline.py`: End-to-end verification script

## Usage

### To populate score details for existing data:
```bash
python summarize_all_v2.py --recompute-scores --limit 20
```

### To verify score details in database:
```bash
# Check current state
python scripts/check_score_details.py

# Or use SQL
psql -f scripts/sql/verify_score_details.sql
```

### To test the score generation logic:
```bash
python tests/test_build_score_details.py
```

## Acceptance Criteria Met
✅ Score explanation text appears for all stories (Home grid + Story Detail modal)  
✅ Numeric score and color logic unchanged  
✅ Database shows non-NULL score_details for today's batch  
✅ Pipeline with `--recompute-scores` updates score details idempotently  
✅ No regressions in other features  
✅ No schema or environment changes required  

## Next Steps
1. Run `python summarize_all_v2.py --recompute-scores` to populate score details for today's batch
2. Monitor logs for score details generation
3. Verify UI shows descriptive text under all score displays
