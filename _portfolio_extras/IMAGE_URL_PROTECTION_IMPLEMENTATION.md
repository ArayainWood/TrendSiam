# Image URL Protection Implementation

## Summary

This implementation hardens the image write path to ensure that existing `ai_image_url` values in the database are never accidentally overwritten by `NULL` or empty strings when running the pipeline.

## Key Features

### 1. Python-Level Protection (`utils/safe.py`)

```python
def truthy_url(url: str | None) -> bool:
    """Check if URL is truthy (not None, not empty)"""
    return bool(url) and str(url).strip() != ""

def set_if_truthy(d: dict, key: str, value):
    """Only set dict key if value is truthy"""
    if truthy_url(value):
        d[key] = value
```

### 2. Pipeline Protection (`summarize_all_v2.py`)

#### Database Write Protection
- Only includes `ai_image_url` in payload if value is truthy
- Logs when URLs are updated vs protected
- Supports `--override-images` flag for explicit overwrites

```python
# Default behavior: protect existing URLs
if ai_url:
    set_if_truthy(item, 'ai_image_url', ai_url)
    logger.debug(f"🖼️ IMG URL updated for {video_id}")
else:
    logger.debug(f"🛡️ IMG URL protected for {video_id}")
```

#### Rank Assignment Protection
- No longer sets `ai_image_url = None` for non-top-3 items
- Preserves existing URLs in the data structure

### 3. SQL-Level Protection (`scripts/sql_upsert_image_protection.sql`)

Provides database-side protection using CASE statements:

```sql
ON CONFLICT (video_id, date) DO UPDATE SET
    ai_image_url = CASE
        WHEN EXCLUDED.ai_image_url IS NOT NULL AND EXCLUDED.ai_image_url <> ''
            THEN EXCLUDED.ai_image_url
        ELSE public.news_trends.ai_image_url
    END
```

### 4. CLI Flags

- `--force-refresh-stats`: Refresh metrics WITHOUT touching image URLs
- `--override-images`: NEW flag to explicitly allow URL overwrites (default: False)
- `--regen-missing-images`: Only regenerate for items without URLs

## Usage Examples

### Normal Run (Protected)
```bash
# Refresh stats without touching images
python summarize_all_v2.py --limit 20 --verbose --force-refresh-stats

# Generate only for missing images
python summarize_all_v2.py --limit 20 --verbose --generate-images --regen-missing-images
```

### Explicit Override (Rare)
```bash
# Force overwrite existing URLs (use with caution)
python summarize_all_v2.py --limit 20 --verbose --generate-images --override-images
```

## Logging

The pipeline now provides clear logging for image URL operations:

```
🖼️ IMG URL updated for vid_123: https://example.com/image...
🛡️ IMG URL protected (not overwritten) for vid_456
🔄 IMG URL explicitly overwritten to None for vid_789 (--override-images)
```

## Testing

Run the test suite to verify protection:

```bash
python tests/test_image_url_protection.py
```

Test cases cover:
- Utility functions (truthy_url, set_if_truthy)
- Pipeline behavior with/without override flag
- Protection for non-top-3 items
- Database upsert patterns

## Verification Query

Check that image URLs are preserved:

```sql
SELECT 
    video_id,
    title,
    ai_image_url,
    updated_at,
    CASE 
        WHEN ai_image_url IS NULL THEN 'NULL'
        WHEN ai_image_url = '' THEN 'EMPTY'
        ELSE 'HAS_VALUE'
    END AS url_status
FROM public.news_trends
WHERE date = CURRENT_DATE
  AND ai_image_url IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;
```

## Benefits

1. **Data Safety**: Existing AI-generated images are never lost
2. **Idempotent**: Pipeline can be run multiple times safely
3. **Flexible**: Explicit override available when needed
4. **Auditable**: Clear logging of all URL operations
5. **Multi-Layer**: Protection at both Python and SQL levels

## Migration Note

If you have existing database procedures or triggers, ensure they also respect the image URL protection pattern. The SQL examples in `scripts/sql_upsert_image_protection.sql` can be adapted for your specific schema.
