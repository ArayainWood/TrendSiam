# Image Resilience Fix - Changelog

## [2025-01-09] Home Feed Image Resilience

### Root Cause
The home feed would show "No Trending Stories" even when data existed because:
1. Items without images (`ai_image_url` or `display_image_url`) might be filtered out
2. The UI wasn't gracefully handling missing images
3. YouTube domains were included in allowed image sources (not needed for AI-only images)

### Files Changed

1. **`frontend/src/lib/utils/imageUtils.ts`** (NEW)
   - Created `pickDisplayImage()` helper that returns the best available image URL
   - Priority: `display_image_url` > `ai_image_url` > `null`
   - Added `isValidImageUrl()` helper for validation

2. **`frontend/src/lib/data/newsRepo.ts`**
   - Updated `normalizeNewsItem` to use `pickDisplayImage` helper
   - Ensures `display_image_url` is consistently set (or null)

3. **`frontend/src/app/api/home/diagnostics/route.ts`**
   - Added `imageCoverageBefore` and `imageCoverageAfter` metrics
   - Shows how many items have images before/after applying `pickDisplayImage`
   - Added `finalCount` and `sampleIds` for debugging

4. **`frontend/next.config.js`**
   - Removed YouTube domains from `img-src` CSP and `remotePatterns`
   - Now only allows Supabase storage domains for images
   - Maintains security by limiting to AI-generated images only

5. **`frontend/src/components/news/NewsCard.tsx`**
   - Updated image section to show placeholder when no image available
   - Shows "🎨 No image" or "Image unavailable" (on error)
   - AI-Generated badge only appears when image is actually shown

### Result
- Home feed now displays all items regardless of image availability
- Items without images show a clean placeholder
- Image domains restricted to Supabase storage only (no YouTube)
- Diagnostics provide clear visibility into image coverage
- No changes to database schema or security model (Plan-B intact)
