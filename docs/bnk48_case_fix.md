# BNK48 Story Auxiliary Fields Fix

## Issue Description
Story #3 "【MV full】11-Gatsu no Anklet – กำไลข้อเท้าแห่งความทรงจำ / BNK48" was missing auxiliary fields in the Story Detail modal:
- growth_rate
- platform_mentions  
- keywords
- ai_opinion
- score_details

## Root Cause Analysis

1. **Keyword Extraction Issue**: The regex pattern `r'\b[A-Za-zก-๙]{3,}\b'` didn't handle Japanese characters (Hiragana, Katakana, Kanji) in the title "11-Gatsu no Anklet"

2. **Limited Platform Detection**: Platform mentions only checked description, not title

3. **Generic AI Opinion**: The template-based opinion generator didn't recognize BNK48 as a J-pop idol group

## Fixes Applied

### 1. Enhanced Keyword Extraction (`summarize_all_v2.py`)
```python
# Old regex - missed Japanese characters
words = re.findall(r'\b[A-Za-zก-๙]{3,}\b', text)

# New regex - handles multilingual content
words = re.findall(r'[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u0E00-\u0E7F]+', text)
```

Character ranges:
- `\u3040-\u309F`: Hiragana
- `\u30A0-\u30FF`: Katakana  
- `\u4E00-\u9FAF`: CJK Unified Ideographs
- `\u0E00-\u0E7F`: Thai

### 2. Improved Platform Detection
- Now checks both title AND description
- Added more platform patterns (Line, Spotify, Apple Music)
- Better pattern matching with variations

### 3. Enhanced AI Opinion Generation
Added specific content type detection:
- J-pop idol groups (BNK48, AKB48, etc.)
- Music videos (MV, official video)
- Cover performances
- Reaction content

### 4. Added Targeted Fix Capability
- New `--only-video-id` flag for processing single videos
- Standalone script `scripts/fix_single_video_enrichment.py`
- Safe, idempotent updates (only writes truthy values)

## Implementation Details

### Pipeline Changes
1. Modified `enrich_auxiliary_fields()` to handle multilingual content
2. Added robust error handling for date parsing
3. Improved growth rate calculation with edge cases

### Database Safety
- Uses `set_if_truthy()` to prevent overwriting with NULL
- Only updates fields that have meaningful values
- Preserves existing data

### UI Fallbacks
- Frontend shows graceful fallbacks when DB has NULL
- "N/A", "Primary platform only", "No keywords detected"
- Fallbacks are UI-only, not written to DB

## Usage

### Fix Single Video
```bash
# Using main pipeline
python summarize_all_v2.py --verbose --only-video-id <VIDEO_ID> --recompute-summaries

# Using standalone script  
python scripts/fix_single_video_enrichment.py <VIDEO_ID>
```

### Diagnose Issues
```bash
python scripts/diagnose_missing_enrichment.py
```

## Verification

### SQL Check
```sql
SELECT video_id, title, growth_rate, platform_mentions, keywords, ai_opinion, score_details
FROM public.news_trends  
WHERE video_id = '<VIDEO_ID>';
```

### Expected Results
- **growth_rate**: "Medium (>1K/day)" or similar based on views/age
- **platform_mentions**: "Primary platform only" or detected platforms
- **keywords**: "MV, full, 11, Gatsu, Anklet, กำไลข้อเท้า, BNK48"
- **ai_opinion**: "J-pop idol group content with dedicated fanbase engagement"
- **score_details**: "Good traction • 100K+ views" or similar

## Testing

The enrichment now handles:
- Japanese text (Hiragana, Katakana, Kanji)
- Thai text
- Mixed language content
- Special characters in titles
- Various date formats
- Low view counts

All changes are backwards compatible and don't affect other stories.
