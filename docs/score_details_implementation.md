# Score Details Implementation Guide

## Overview
This document provides technical implementation details for the Popularity Score details feature, which generates and displays natural language explanations for numeric popularity scores throughout the application.

## Backend Implementation

### Score Generation Logic (`summarize_all_v2.py`)

The `build_score_details()` method generates descriptive text based on multiple factors:

```python
def build_score_details(self, video: Dict[str, Any]) -> str:
    """Build a descriptive explanation of the popularity score."""
    score = video.get('popularity_score_precise', 0)
    parts = []
    
    # Primary score assessment (7 tiers)
    if score >= 90:
        parts.append('Viral performance')
    elif score >= 80:
        parts.append('Top trending content')
    elif score >= 70:
        parts.append('High engagement')
    elif score >= 60:
        parts.append('Strong traction')  
    elif score >= 50:
        parts.append('Good performance')
    elif score >= 40:
        parts.append('Moderate engagement')
    else:
        parts.append('Building momentum')
```

### View Count Tiers
- 5M+: "exceptional viewership"
- 1M+: "massive reach"
- 500K+: "strong viewership"
- 100K+: "solid viewership"
- 10K+: Just the formatted number
- <10K: Comma-formatted number

### Engagement Rate Calculation
```python
like_rate = (likes / views) * 100
# Thresholds:
# >10%: "outstanding engagement"
# >5%: "excellent engagement"
# >2%: "strong engagement"

comment_rate = (comments / views) * 100
# >1%: "high discussion activity"
```

### Example Outputs
- "Viral performance exceptional viewership (5.2M views) with excellent engagement (10.0% like rate)."
- "Top trending content massive reach (1.2M views) with strong engagement (2.7% like rate)."
- "Building momentum 5,678 views rapidly growing."

## Database Persistence

### Protection Logic
```python
# Only write score_details if meaningful
if self.recompute_scores or item.get('score_details'):
    set_if_truthy(spec_item, 'score_details', item.get('score_details'))
    if item.get('score_details'):
        logger.debug(f"📊 SCORE_DETAILS[{item.get('video_id')}]: \"{item.get('score_details')[:80]}...\"")
```

### Database Column
- Table: `public.news_trends`
- Column: `score_details` (text)
- Constraints: None (nullable)

## Frontend Data Flow

### 1. API Selection (`homeData.ts`)
```typescript
const { data, error } = await supa
  .from('news_trends')
  .select(`
    ...,
    score_details,
    ...
  `)
```

### 2. Data Normalization (`normalize.ts`)
```typescript
export function mapToViewDetails(item: any): NewsItemAnalysis {
  const viewDetails = {
    ...,
    score: normalizeText(item.score_details) || normalizeText(existingViewDetails.score) || 'N/A'
  };
  
  return {
    ...item,
    view_details: viewDetails,
    score_details: normalizeText(item.score_details)
  };
}
```

### 3. UI Display Patterns

#### NewsCard (Grid View)
- Location: Under numeric score
- Style: Small text, centered, max-width constrained
- Condition: Only shows if not 'N/A'

#### TopStoryCard (List View)
- Location: Inline with score, in parentheses
- Style: Smaller text, muted color
- Format: "85/100 (Top trending content...)"

#### NewsDetailModal (Detail View)
- Location: Main score card description
- Style: Standard paragraph text
- Fallback: Shows `news.reason` if score_details unavailable

## Color Coding Rules (Unchanged)
- Score >= 80: Green (emerald)
- Score >= 60: Yellow (amber)
- Score < 60: Red

## Testing Strategy

### Unit Tests
- Test all score ranges (0-100)
- Test various view counts
- Test engagement rate calculations
- Test with/without growth rate

### Integration Tests
- Verify database writes
- Verify API returns data
- Verify UI displays correctly

### Manual Verification
```bash
# Check a specific video
SELECT video_id, title, popularity_score_precise, score_details
FROM public.news_trends
WHERE video_id = 'YOUR_VIDEO_ID';
```

## Performance Considerations
- Score generation is fast (<1ms per video)
- No additional API calls required
- Minimal storage overhead (~100-200 bytes per record)
- UI rendering unchanged (text replacement only)

## Migration Notes
- Existing records will have NULL score_details
- Use `--recompute-scores` to backfill
- No schema changes required
- Fully backwards compatible
