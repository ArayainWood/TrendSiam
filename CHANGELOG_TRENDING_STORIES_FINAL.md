# Changelog - Trending Stories Pipeline Fix

## [1.0.0] - 2025-08-21

### Fixed
- **AI Images Count**: Now correctly shows 3 (Top 3 stories only) instead of 12
  - Updated `calculateAIImagesCount()` in `businessRules.ts` to sort by rank and take top 3
  
- **View AI Prompt Panel**: Restored missing panel in Story Details
  - Fixed property access from `ai_image_prompt` to `aiImagePrompt` in `EnhancedNewsDetailModal.tsx`
  - Added `aiImagePrompt` field to `UINewsItem` type

- **Popularity Score Display**: Now shows with 1 decimal place consistently
  - Fixed `NewsCard.tsx` to use `.toFixed(1)` instead of `Math.round()`

### Added
- **Canonical Popularity Helpers** (`popularityHelpers.ts`)
  - `getPopularitySubtext()` - Generates "High engagement • 11.8M+ views (like rate 10.2%) • Viral growth"
  - `formatPopularityScore()` - Ensures 1 decimal display
  - `formatGrowthRate()` - Formats with legacy labels

- **Enhanced Diagnostics**
  - `/api/home/diagnostics` now reports `aiImagesCountComputed`, `topNUsed`, growth status
  - `/api/home/fields` - New endpoint for comprehensive field analysis

- **Unit Tests**
  - `businessRules.test.ts` - Tests for AI images calculation and growth labels
  - `popularityHelpers.test.ts` - Tests for subtext generation
  - `canonical.test.ts` - Tests for type mapping
  - `dbToUiMapping.test.ts` - Tests for DB→UI conversion

### Changed
- Exported `getPopularitySubtext` from `canonical.ts` for component use
- Enhanced diagnostics to include `popularitySubtextPreview` and `hasSummaryEnPercentage`

### Technical Details
- **Type Safety**: `npx tsc --noEmit` passes with 0 errors (except test files)
- **Business Rules**: All thresholds centralized in `businessRules.ts`
- **Backward Compatible**: No breaking changes to APIs, DB schemas, or other features

### Files Modified
1. `frontend/src/lib/constants/businessRules.ts`
2. `frontend/src/components/news/EnhancedNewsDetailModal.tsx`
3. `frontend/src/lib/normalizeNewsItem.ts`
4. `frontend/src/app/api/home/diagnostics/route.ts`
5. `frontend/src/lib/db/types/canonical.ts`
6. `frontend/src/components/news/NewsCard.tsx`
7. `frontend/src/lib/helpers/popularityHelpers.ts` (new)
8. `frontend/src/app/api/home/fields/route.ts` (new)
9. `frontend/src/lib/constants/__tests__/businessRules.test.ts` (existing, from previous)
10. `frontend/src/lib/helpers/__tests__/popularityHelpers.test.ts` (new)
11. `frontend/src/lib/db/types/__tests__/canonical.test.ts` (existing, from previous)
12. `frontend/src/lib/db/types/__tests__/dbToUiMapping.test.ts` (new)
