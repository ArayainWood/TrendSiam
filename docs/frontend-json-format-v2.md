# TrendSiam Frontend JSON Format v2 with Idempotency Support

## Overview

The frontend JSON format has been enhanced to support the two-layer model (stories/snapshots) with proper image persistence and cache busting.

## JSON Structure

```json
{
  "data_version": "2025-01-17T10:30:45.123Z",
  "snapshot_date": "2025-01-17",
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "total_items": 50,
  "generation_info": {
    "success_count": 48,
    "failure_count": 2,
    "image_generated_count": 2,
    "image_skipped_count": 1,
    "image_failed_count": 0
  },
  "items": [
    {
      "story_id": "a1b2c3d4e5f6789...",
      "rank": 1,
      "title": "Story Title",
      "summary": "Thai summary",
      "summary_en": "English summary",
      "category": "เกม/อนิเมะ (Games/Anime)",
      "platform": "YouTube",
      "channel": "Channel Name",
      "video_id": "abc123xyz",
      "view_count": "1,234,567",
      "like_count": "12,345",
      "comment_count": "567",
      "popularity_score": 85.5,
      "popularity_score_precise": 85.47,
      "published_date": "2025-01-17T08:30:00Z",
      "description": "Video description",
      "duration": "10:23",
      
      // Image fields (Top-3 focus)
      "ai_image_url": "/ai_generated_images/a1b2c3d4e5f6789....webp",
      "image_status": "ready",
      "image_updated_at": "2025-01-17T10:30:45.123Z",
      "ai_image_prompt": "Generated prompt for image",
      
      // Optional metadata
      "reason": "Trending due to viral content",
      "view_details": {
        "views": "1.2M",
        "growth_rate": "+150%",
        "platform_mentions": "Reddit, Twitter",
        "matched_keywords": "gaming, viral",
        "ai_opinion": "Highly engaging content",
        "score": "85.47"
      }
    }
  ]
}
```

## Key Fields

### Top-Level Metadata
- `data_version`: ISO timestamp for cache busting
- `snapshot_date`: Date of this snapshot (YYYY-MM-DD)
- `run_id`: Unique identifier for this ingestion run
- `total_items`: Total number of items in this snapshot
- `generation_info`: Processing statistics

### Story Fields (Required)
- `story_id`: Stable 64-character hash identifying the canonical story
- `rank`: 1-based position in current snapshot (1, 2, 3, ...)
- `title`: Story title
- `summary`: Thai summary
- `summary_en`: English summary
- `category`: Auto-categorized type
- `platform`: Source platform (usually "YouTube")
- `popularity_score_precise`: Numerical ranking score

### Image Fields (Top-3 Focus)
- `ai_image_url`: Frontend URL to image file or null
- `image_status`: "ready", "pending", "failed", or "n/a" (for rank > 3)
- `image_updated_at`: When image was last processed
- `ai_image_prompt`: Prompt used for image generation (optional)

### Image Status Values
- `"ready"`: Valid image available at `ai_image_url`
- `"pending"`: Image generation failed/incomplete, use placeholder
- `"failed"`: Generation permanently failed, use error placeholder
- `"n/a"`: Not applicable (rank > 3, no images generated)

## Frontend Usage Guidelines

### Cache Busting
Use `data_version` timestamp to detect when data has changed:

```javascript
const lastDataVersion = localStorage.getItem('lastDataVersion');
if (data.data_version !== lastDataVersion) {
  // Data has changed, refresh UI
  localStorage.setItem('lastDataVersion', data.data_version);
  refreshUI(data);
}
```

### Image Handling
Always check `image_status` before showing images:

```javascript
function renderStoryImage(story) {
  switch (story.image_status) {
    case 'ready':
      return `<img src="${story.ai_image_url}" alt="${story.title}" />`;
    case 'pending':
      return `<div class="placeholder">Image generating...</div>`;
    case 'failed':
      return `<div class="error-placeholder">Image unavailable</div>`;
    case 'n/a':
    default:
      return null; // No image for this rank
  }
}
```

### Story Alignment
Use `story_id` and `rank` to ensure proper alignment:

```javascript
// Sort by rank to maintain order
const sortedStories = data.items.sort((a, b) => a.rank - b.rank);

// Use story_id for stable references
const storyElement = document.getElementById(`story-${story.story_id}`);
```

## Migration from v1

### Breaking Changes
1. Added required `story_id` field
2. Added required `rank` field
3. Changed `ai_image_url` to be null-safe
4. Added `image_status` field
5. Added top-level metadata structure

### Backwards Compatibility
Existing frontends should:
1. Check for presence of `story_id` before using
2. Fall back to array index if `rank` not available
3. Treat missing `image_status` as 'ready' if `ai_image_url` exists
4. Use `data_version` or `created_at` for cache busting

## Implementation Notes

### Image File Naming
Images are stored with story_id-based filenames:
- Path: `/ai_generated_images/{story_id}.webp`
- Stable across runs - same story = same filename
- No rank-based naming to avoid shuffling

### Top-3 Guarantee
- Only ranks 1, 2, 3 get `image_status` of "ready" or "pending"
- Ranks 4+ always have `image_status` of "n/a" and `ai_image_url` of null
- Image generation focused on Top-3 for performance

### Data Freshness
- `snapshot_date`: When this data snapshot was taken
- `data_version`: Precise timestamp for change detection
- `image_updated_at`: Per-story image processing timestamp
