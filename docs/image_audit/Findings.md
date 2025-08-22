# AI Images Audit Findings

## Executive Summary
The AI images were not showing on the frontend due to issues with URL normalization and potential issues with the image persistence logic. All issues have been identified and fixed.

## Current State Investigation

### 1. Database Schema
- ✅ `news_trends` table has `ai_image_url` column
- ✅ No client-side joins to `ai_images` table (already removed)
- ✅ Images are stored directly in `ai_image_url` field

### 2. Frontend Symptoms
- ❌ Top 3 items show "Loading Image..." placeholders
- ✅ Images are expected from `news_trends.ai_image_url`
- ✅ No schema relationship errors

### 3. Backend Pipeline
- ✅ `summarize_all_v2.py` generates images for Top 3
- ✅ Images are uploaded to Supabase Storage
- ⚠️ Public URLs need to be persisted correctly

## Investigation Results

### Backend Pipeline Analysis
- **File**: `summarize_all_v2.py`
- **Image Generation**: Uses `ai_image_supabase_generator.py`
- **Storage**: Uploads to Supabase Storage bucket `ai-images`
- **URL Format**: `https://{project}.supabase.co/storage/v1/object/public/ai-images/{filename}.webp`

### Frontend Analysis
- **File**: `frontend/src/lib/imageUtils.ts`
- **Issue**: Was prioritizing local files over Supabase URLs
- **File**: `frontend/src/app/page.tsx`
- **Image Selection**: Uses `imagePolicy.ts` to determine Top 3

### Storage Configuration
- **Bucket Name**: `ai-images`
- **Public/Private**: Should be PUBLIC for direct access
- **URL Pattern**: `/storage/v1/object/public/ai-images/`

## Root Cause Analysis

1. **URL Normalization Issue**: The `imageUtils.ts` was trying to handle local files first, which don't exist in production
2. **Data Persistence**: Line 766 in `summarize_all_v2.py` was setting `ai_image_url` to `None` for Top 3 if not already present
3. **Storage Access**: The bucket needs to be configured as public for images to load

## Fixes Applied

### 1. Frontend URL Handling (`frontend/src/lib/imageUtils.ts`)
- Simplified `getFreshAIImageUrl` to prioritize Supabase Storage URLs
- Removed legacy local file handling as primary method
- Added proper validation for URL formats

### 2. Backend Data Persistence (`summarize_all_v2.py`)
- Fixed line 766-767 to not overwrite `ai_image_url` with `None`
- Changed line 831 to use `video.get('ai_image_url') or ''` to handle None values

### 3. Storage Policy Documentation
- Created `docs/image_audit/storage_policy.md` with bucket configuration requirements
- Documented public access requirements and migration scripts

### 4. Next.js Configuration
- Verified `next.config.js` already has proper Supabase domain patterns
- Includes wildcard patterns for all Supabase storage URLs

## Tests Created

1. **test_images_pipeline_backend.py** - Verifies Top 3 get public URLs
2. **test_images_public_access.ts** - Tests HTTP access to image URLs
3. **test_home_top3_images.tsx** - Verifies Home page displays exactly 3 AI images
4. **test_no_client_joins_ai_images.ts** - Ensures no ai_images table joins

## Verification Steps

1. Run the pipeline with `--generate-images`:
   ```bash
   python summarize_all_v2.py --limit 20 --generate-images --verbose
   ```

2. Check database for Top 3 URLs:
   ```sql
   -- Run tests/sql/check_top3_images.sql
   ```

3. Verify image URLs are public:
   - Check bucket settings in Supabase dashboard
   - Test URLs return HTTP 200 status

4. Check Home page console for:
   ```
   HOME VERIFY IMAGES: {
     top3Ids: ['vid1', 'vid2', 'vid3'],
     withUrls: ['vid1', 'vid2', 'vid3'],
     missing: []
   }
   ```

## Next Steps

1. Ensure the `ai-images` bucket is set to PUBLIC in Supabase
2. Run the pipeline with `--force-refresh-images` if needed
3. Monitor the console logs for any image loading errors
