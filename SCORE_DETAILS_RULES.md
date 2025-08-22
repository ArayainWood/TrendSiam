# Score Details Formatting Rules

## Overview
This document defines the exact rules for generating deterministic, data-driven score details explanations.

## Score Details Format

### Primary Assessment (based on popularity_score_precise)
- **≥ 70**: "High engagement"
- **≥ 50**: "Strong engagement"
- **≥ 30**: "Moderate engagement"
- **< 30**: "Building momentum"

### View Count Buckets
- **> 5M**: "• X.XM+ views"
- **> 1M**: "• X.XM+ views"
- **> 100K**: "• XXXK+ views"
- **≤ 100K**: "• X,XXX views" (with thousand separators)

### Engagement Rates
Always calculated from actual metrics, shown to 1 decimal place:
- **Like Rate**: `(like_count / view_count) * 100`
  - Always shown if views > 0
  - Format: "like rate X.X%"
- **Comment Rate**: `(comment_count / view_count) * 100`
  - Only shown if ≥ 1.0%
  - Format: "comment rate X.X%"

### Growth Rate Buckets
- **"Viral (>100K/day)"**: "• Viral growth"
- **"High (≥10K/day)"**: "• High growth"
- **"Medium (≥1K/day)"**: "• Medium growth"
- **"Steady"**: "• Steady growth"
- **"New (< 1 day)"**: Not shown in score details

### Example Outputs
- "High engagement • 5.2M+ views (like rate 10.0%, comment rate 1.0%) • Viral growth"
- "Strong engagement • 1.2M+ views (like rate 8.0%, comment rate 1.0%) • High growth"
- "Moderate engagement • 235K+ views (like rate 5.3%, comment rate 1.0%) • Medium growth"
- "Building momentum • 5,678 views (like rate 4.1%) • Steady growth"

## Data Field Mappings

### Basic Info Section
| UI Field | Database Column | Format | Fallback |
|----------|----------------|--------|----------|
| Channel | `news_trends.channel` | As-is | "N/A" |
| Published | `news_trends.published_date` | Asia/Bangkok TZ, full date+time | "N/A" |
| Views | `news_trends.view_count` | With K/M suffix | "0" |
| Likes | `news_trends.like_count` | With K/M suffix | "0" |
| Comments | `news_trends.comment_count` | With K/M suffix | "0" |

### Popularity Score Section
| UI Field | Database Column | Format | Fallback |
|----------|----------------|--------|----------|
| Score Number | `news_trends.popularity_score_precise` | Rounded to integer | "0" |
| Score Details | `news_trends.score_details` | See format above | "N/A" |

### Summary Section
| UI Field | Database Column | Format | Fallback |
|----------|----------------|--------|----------|
| Summary | `news_trends.summary` or `summary_en` | As-is | First 1-2 sentences from `description` |

### Detailed Analytics Section
| UI Field | Database Column | Format | Fallback |
|----------|----------------|--------|----------|
| Growth Rate | `news_trends.growth_rate` | Standardized bucket | "N/A" |
| Platforms | `news_trends.platform_mentions` | Canonical names, deduped | "YouTube" |
| Keywords | `news_trends.keywords` | Title case, max 6, deduped | "N/A" |
| AI Opinion | `news_trends.ai_opinion` | As-is | Hide section if empty |

## Implementation Notes

### Number Formatting
```javascript
// Views/Likes/Comments
if (value >= 1000000) return `${(value/1000000).toFixed(1)}M`
if (value >= 1000) return `${(value/1000).toFixed(1)}K`
return value.toLocaleString() // With thousand separators
```

### Date Formatting
```javascript
const options = {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
}
```

### Platform Canonicalization
- "facebook" → "Facebook"
- "instagram" → "Instagram"
- "twitter", "twitter/x" → "Twitter/X"
- "tiktok" → "TikTok"
- "youtube only", "primary platform only" → "YouTube"
- "multiple platforms" → "Multiple Platforms"

### Keyword Processing
1. Split by comma
2. Remove duplicates
3. Limit to 6 keywords
4. Apply title case
5. Join with ", "

## Verification
Run these checks after implementation:
1. All score_details are non-empty for today's batch
2. Rates are always shown to exactly 1 decimal place
3. Same inputs always produce identical output
4. No fields show placeholder text when data exists
