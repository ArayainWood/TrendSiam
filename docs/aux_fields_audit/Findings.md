# Auxiliary Fields Audit Findings

## Executive Summary
The Story Detail modal shows primary fields but many supplementary fields (AI opinion, growth estimate, platform, keywords, score details) are missing or showing N/A. This document tracks the investigation and fixes.

## Fields Under Investigation
- `ai_opinion` - AI analysis/commentary
- `score_details` - Scoring breakdown
- `keywords` - Extracted keywords
- `growth_rate` - Growth estimate
- `platform` - Platform name
- `platform_mentions` - Platform-specific metrics
- `duration` - Video/content duration
- `channel` - Channel name
- `category` - Content category
- `view_count`, `like_count`, `comment_count` - Engagement metrics
- `published_date` - Publication date
- `summary`, `summary_en` - Content summaries

## Investigation Results

### 1. Database Schema Check
The `news_trends` table includes columns for all auxiliary fields:
- ✅ ai_opinion
- ✅ score_details
- ✅ keywords
- ✅ growth_rate
- ✅ platform_mentions
- ✅ duration

### 2. Pipeline Analysis
**Issue Found**: The pipeline (`summarize_all_v2.py`) was NOT writing most auxiliary fields to the database.
- ❌ score_details - Not computed or written
- ❌ keywords - Not computed or written
- ❌ growth_rate - Not computed or written
- ❌ platform_mentions - Not computed or written
- ✅ duration - Provided by YouTube API
- ⚠️ ai_opinion - Written but often empty

### 3. API/Fetcher Analysis
**Issue Found**: The fetcher (`homeData.ts`) WAS selecting all fields correctly, but the data was missing a structural transformation.
- The modal expects fields in `view_details` object
- The API returns fields at root level
- Missing mapping between structures

### 4. UI Component Analysis
**Issue Found**: The NewsDetailModal expects auxiliary fields in a nested structure:
```typescript
news.view_details.growth_rate
news.view_details.platform_mentions
news.view_details.matched_keywords
news.view_details.ai_opinion
```

But the data has these fields at the root level.

## Root Causes

1. **Missing Field Computation**: The pipeline was not computing auxiliary fields
2. **Missing Database Writes**: The computed fields were not being written to `news_trends`
3. **Structure Mismatch**: UI expects nested `view_details` but API returns flat structure
4. **No Enrichment Step**: Pipeline lacked a step to enrich videos with analytical data

## Fixes Applied

### 1. Added Enrichment Function (`summarize_all_v2.py`)
Created `enrich_auxiliary_fields()` that computes:
- Growth rate based on views and publish date
- Keywords extracted from title/description
- Platform mentions from description
- Score details explaining the popularity score
- Basic AI opinion (template-based for now)

### 2. Updated Database Write (`summarize_all_v2.py`)
Added all auxiliary fields to the database upsert:
```python
'score_details': video.get('score_details', ''),
'keywords': video.get('keywords', ''),
'growth_rate': video.get('growth_rate', ''),
'platform_mentions': video.get('platform_mentions', ''),
'duration': video.get('duration', ''),
'raw_view': video.get('raw_view', ''),
```

### 3. Created Normalization Utility (`frontend/src/lib/utils/normalize.ts`)
- `normalizeText()` - Treats empty strings and "N/A" as null
- `mapToViewDetails()` - Maps flat structure to nested view_details
- `mergeWithSnapshot()` - For future snapshot fallback support

### 4. Updated Data Fetcher (`frontend/src/lib/data/homeData.ts`)
- Applied `mapToViewDetails()` transformation
- Ensures compatibility with modal expectations

## Verification

Run the pipeline to generate auxiliary fields:
```bash
python summarize_all_v2.py --limit 20 --verbose
```

Check database:
```sql
-- Run tests/sql/check_aux_fields_today.sql
```

Expected output:
- All Top 10 stories should have non-null auxiliary fields
- growth_rate: "Viral", "High", "Medium", "Steady", etc.
- keywords: Comma-separated list
- platform_mentions: "YouTube only" or list of platforms
- score_details: Descriptive scoring explanation

## Additional Fix: BNK48 Multilingual Support

### Problem Identified
The BNK48 story "【MV full】11-Gatsu no Anklet – กำไลข้อเท้าแห่งความทรงจำ / BNK48" was missing auxiliary fields due to:
1. Keyword extraction regex not handling Japanese characters
2. Platform detection only checking description
3. Generic AI opinion not recognizing J-pop idol groups

### Fix Applied
Enhanced the enrichment function in `summarize_all_v2.py`:

1. **Multilingual Keywords** (lines 560-583)
   - Old: `r'\b[A-Za-zก-๙]{3,}\b'` 
   - New: `r'[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u0E00-\u0E7F]+'`
   - Now handles Japanese (Hiragana, Katakana, Kanji), Thai, Chinese

2. **Improved Platform Detection** (lines 584-608)
   - Checks both title AND description
   - Recognizes "all platforms", "streaming platforms"
   - Added more platform patterns

3. **Content-Aware AI Opinion** (lines 631-663)
   - Detects J-pop/K-pop idol groups by name
   - Provides specific insights for different content types

### Verification
Run targeted fix for specific video:
```bash
python summarize_all_v2.py --verbose --only-video-id <VIDEO_ID> --recompute-summaries
```

The enhanced enrichment now properly handles multilingual content and provides more accurate auxiliary fields.
