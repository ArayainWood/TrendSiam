# TrendSiam Video Data Updater

## 🎯 Overview

The **TrendSiam Video Data Updater** is a secure, production-ready Python script that safely updates video view counts and categories in the TrendSiam system by fetching the latest data from YouTube Data API v3.

### ✨ Key Features

- **🔄 Real-time Updates**: Fetches latest view counts, likes, and comments from YouTube API
- **🏷️ Smart Classification**: Re-evaluates categories using TrendSiam's existing classification logic
- **🛡️ Data Safety**: Comprehensive backup, validation, and rollback capabilities
- **⚡ API Compliance**: Respects YouTube API terms with rate limiting and error handling
- **🔍 Dry Run Mode**: Preview changes before applying them
- **📊 Detailed Reporting**: Clear summaries of what was updated and why

## 🚀 Quick Start

### Prerequisites

1. **API Key**: Valid `YOUTUBE_API_KEY` in your `.env` file
2. **Data File**: Existing `thailand_trending_summary.json` file
3. **Dependencies**: All TrendSiam dependencies installed

### Basic Usage

```bash
# Preview what would be updated (recommended first step)
python update_video_data.py --dry-run

# Create a manual backup
python update_video_data.py --backup-only

# Run the actual update
python update_video_data.py

# Restore from a backup if needed
python update_video_data.py --restore backups/backup_file.json
```

### Interactive Example

```bash
# Run the guided example with user prompts
python example_update_usage.py
```

## 📋 Detailed Usage

### Command-Line Options

| Option | Description | Example |
|--------|-------------|---------|
| `--dry-run` | Preview changes without saving | `python update_video_data.py --dry-run` |
| `--backup-only` | Create backup without updating | `python update_video_data.py --backup-only` |
| `--restore FILE` | Restore from specific backup | `python update_video_data.py --restore backups/file.json` |
| `--data-file FILE` | Use custom data file path | `python update_video_data.py --data-file custom.json` |

### Safe Update Workflow

```python
from update_video_data import TrendSiamVideoUpdater

# Initialize updater
updater = TrendSiamVideoUpdater()

# Step 1: Create backup
backup_path = updater.create_backup("_before_update")

# Step 2: Preview changes
dry_results = updater.update_all_videos(dry_run=True)
print(f"Would update {dry_results['items_updated']} items")

# Step 3: Apply updates if satisfied
if dry_results['items_updated'] > 0:
    real_results = updater.update_all_videos(dry_run=False)
    print(f"Updated {real_results['items_updated']} items successfully")
```

## 🔧 How It Works

### Data Sources

The updater fetches fresh data from **YouTube Data API v3** for each video:

- **📊 Statistics**: `viewCount`, `likeCount`, `commentCount`
- **📝 Metadata**: `title`, `description`, `publishedAt`, `channelTitle`
- **🏷️ Classification**: Re-runs TrendSiam's category classification logic

### Update Logic

1. **🔍 Validation**: Checks video ID format (`^[a-zA-Z0-9_-]{11}$`)
2. **📡 API Request**: Batches up to 50 video IDs per request
3. **🔢 View Count**: Updates only if new count is valid (1 to 10 billion) and different
4. **👍 Engagement**: Updates likes/comments if changed
5. **🏷️ Category**: Re-classifies using existing TrendSiam logic
6. **💾 Storage**: Atomic file operations (temp file + move)

### Data Validation Rules

| Field | Validation Rules |
|-------|-----------------|
| `video_id` | Must be 11 characters, alphanumeric + hyphens/underscores |
| `view_count` | Must be integer between 1 and 10,000,000,000 |
| `like_count` | Must be non-negative integer or 'N/A' |
| `comment_count` | Must be non-negative integer or 'N/A' |
| `auto_category` | Must be one of TrendSiam's predefined categories |

## 🛡️ Security & Safety Features

### Data Protection

- ✅ **Automatic Backups**: Created before every update with timestamps
- ✅ **Data Validation**: Extensive integrity checks before saving
- ✅ **Atomic Operations**: Temporary file + move to prevent corruption
- ✅ **Rollback Capability**: Easy restore from any backup

### API Security

- ✅ **Rate Limiting**: 100ms delays between requests to respect YouTube limits
- ✅ **Error Handling**: Graceful recovery from network/API errors
- ✅ **Input Validation**: Sanitizes all API responses
- ✅ **Quota Management**: Efficient batching to minimize API usage

### Code Safety

- ✅ **Defensive Programming**: Validates every input and operation
- ✅ **Exception Handling**: Comprehensive try-catch blocks
- ✅ **Logging**: Detailed logs for debugging and monitoring
- ✅ **Type Safety**: Full type hints and runtime validation

## 📊 Example Output

### Dry Run Output
```
🔍 Dry Run Results:
   Total items: 10
   Valid video IDs: 10
   Statistics fetched: 10
   Items that would be updated: 3

🔄 Sample changes that would be made:
   📹 🔴 LIVE: 🇹🇭 ไทย พบ 🇨🇦 แคนาดา | VNL 2025...
      • view_count: 2,190,133 → 2,245,678
      • like_count: 36354 → 38901

   📹 Chelsea vs. PSG | FIFA Club World Cup Final...
      • view_count: 16,819,511 → 16,892,445
      • comment_count: 14662 → 15123
```

### Actual Update Output
```
✅ Update completed successfully!
   Items updated: 3
   Items unchanged: 7
   Backup available: backups/thailand_trending_summary_backup_20250123_143052_pre_update.json

🔄 Recent Changes:
   📹 🔴 LIVE: 🇹🇭 ไทย พบ 🇨🇦 แคนาดา | VNL 2025...
      • view_count: 2,190,133 → 2,245,678
      • like_count: 36354 → 38901
      • added last_updated timestamp
```

## 🔄 Integration with TrendSiam

### Compatibility

The updater is designed for **100% compatibility** with existing TrendSiam systems:

- **📁 Same Data Format**: Uses identical JSON structure
- **🏷️ Same Categories**: Uses TrendSiam's `classify_news_item()` function
- **🔧 Same Dependencies**: No additional dependencies required
- **📊 Same Statistics**: Maintains view count formatting with commas

### Workflow Integration

```bash
# Standard TrendSiam workflow with updates
python youtube_api_fetcher.py     # Fetch trending videos
python summarize_all.py           # Generate summaries & categories
python update_video_data.py       # Update latest statistics
streamlit run app.py              # Launch TrendSiam app
```

### Automation

You can schedule regular updates using cron or task scheduler:

```bash
# Update every 6 hours (add to crontab)
0 */6 * * * cd /path/to/trendsiam && python update_video_data.py
```

## 🚨 Error Handling & Troubleshooting

### Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| `YouTube API key not found` | Missing `.env` file | Add `YOUTUBE_API_KEY=your_key` to `.env` |
| `Data file not found` | No summary file | Run `python summarize_all.py` first |
| `Invalid video_id` | Corrupted data | Check data file format and restore from backup |
| `API quota exceeded` | Too many requests | Wait 24 hours or request quota increase |
| `Network timeout` | Connection issues | Check internet connection and retry |

### Recovery Procedures

```bash
# If update fails, restore from backup
python update_video_data.py --restore backups/latest_backup.json

# If data corruption is suspected, validate manually
python -c "
from update_video_data import TrendSiamVideoUpdater
updater = TrendSiamVideoUpdater()
data = updater.load_data()
updater._validate_data_integrity(data)
print('✅ Data integrity OK')
"
```

### Logging

All operations are logged to `logs/update_video_data.log`:

```
2025-01-23 14:30:52 - INFO - ✅ Environment validation passed
2025-01-23 14:30:53 - INFO - ✅ Backup created: backups/thailand_trending_summary_backup_20250123_143052_pre_update.json
2025-01-23 14:30:54 - INFO - ✅ Loaded 10 news items from thailand_trending_summary.json
2025-01-23 14:30:55 - INFO - 📹 Found 10 valid video IDs to update
2025-01-23 14:30:58 - INFO - ✅ Fetched statistics for 10 videos
2025-01-23 14:30:59 - INFO - ✅ Updated 10eYg4r3RQo: view_count: 2,190,133 → 2,245,678, like_count: 36354 → 38901
```

## ⚖️ Legal & Compliance

### YouTube API Terms of Service

The updater is designed to comply with YouTube's API Terms of Service:

- ✅ **Respectful Usage**: Implements rate limiting and error handling
- ✅ **Public Data Only**: Only accesses publicly available video statistics
- ✅ **No Caching**: Does not store API responses beyond immediate processing
- ✅ **Attribution**: Maintains references to original YouTube content
- ✅ **Quota Compliance**: Efficient batching to minimize API usage

### Data Privacy

- ✅ **No Personal Data**: Only processes public video metadata
- ✅ **No User Tracking**: Does not collect or store user information
- ✅ **Local Processing**: All data processing happens locally
- ✅ **Secure Storage**: API keys stored securely in `.env` files

## 🧪 Testing

### Unit Tests

```bash
# Test video ID validation
python -c "
from update_video_data import TrendSiamVideoUpdater
updater = TrendSiamVideoUpdater()
assert updater._validate_youtube_video_id('10eYg4r3RQo') == True
assert updater._validate_youtube_video_id('invalid') == False
print('✅ Video ID validation tests passed')
"

# Test view count parsing
python -c "
from update_video_data import TrendSiamVideoUpdater
updater = TrendSiamVideoUpdater()
assert updater._parse_view_count('1,234,567') == 1234567
assert updater._format_view_count(1234567) == '1,234,567'
print('✅ View count formatting tests passed')
"
```

### Integration Testing

```bash
# Test with a small subset of data
python update_video_data.py --dry-run --data-file test_data.json
```

## 📚 API Reference

### Class: `TrendSiamVideoUpdater`

#### Constructor
```python
TrendSiamVideoUpdater(data_file: str = "thailand_trending_summary.json")
```

#### Key Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `update_all_videos(dry_run=False)` | Update all videos in dataset | `Dict[str, Any]` |
| `fetch_video_statistics(video_ids)` | Get stats for video IDs | `Dict[str, Dict]` |
| `create_backup(suffix="")` | Create data backup | `Path` |
| `restore_from_backup(backup_path)` | Restore from backup | `bool` |
| `load_data()` | Load data from JSON | `List[Dict]` |
| `save_data(data, validate=True)` | Save data to JSON | `None` |

#### Update Results Format

```python
{
    'success': True,
    'total_items': 10,
    'valid_video_ids': 10,
    'stats_fetched': 10,
    'items_updated': 3,
    'items_unchanged': 7,
    'errors': 0,
    'changes': [
        {
            'video_id': '10eYg4r3RQo',
            'title': '🔴 LIVE: 🇹🇭 ไทย พบ 🇨🇦 แคนาดา...',
            'changes': [
                'view_count: 2,190,133 → 2,245,678',
                'like_count: 36354 → 38901'
            ]
        }
    ]
}
```

## 🔮 Future Enhancements

### Planned Features

- **📈 Trend Analysis**: Track view count changes over time
- **⚡ Real-time Mode**: WebSocket integration for live updates
- **📊 Analytics Dashboard**: Visual reports of engagement trends
- **🔔 Smart Notifications**: Alerts for significant view count changes
- **🌐 Multi-language**: Support for additional YouTube regions

### Configuration Options

Future versions may support configurable options:

```json
{
    "update_frequency": "6h",
    "view_count_threshold": 10000,
    "category_confidence_min": 0.8,
    "backup_retention_days": 30,
    "api_rate_limit_ms": 100
}
```

## 🤝 Contributing

### Development Setup

```bash
# Clone the repository
git clone <repository_url>
cd trendsiam

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp environment_template.txt .env
# Edit .env with your API keys

# Run tests
python update_video_data.py --dry-run
```

### Code Style

- **Type Hints**: All functions must have complete type annotations
- **Docstrings**: Google-style docstrings for all classes and methods
- **Error Handling**: Comprehensive exception handling with logging
- **Security**: Input validation and safe defaults for all operations

## 📞 Support

### Getting Help

1. **📖 Documentation**: Check this README and inline code comments
2. **🐛 Issues**: Create GitHub issues for bugs or feature requests
3. **💬 Discussions**: Use GitHub Discussions for questions
4. **📧 Contact**: Email maintainers for security-related issues

### Common Questions

**Q: How often should I update video data?**
A: Every 6-12 hours is recommended for trending content.

**Q: What happens if my API quota is exceeded?**
A: The updater will log the error and continue with remaining videos. You can retry after 24 hours.

**Q: Can I run this on a schedule?**
A: Yes, the updater is designed for automated scheduling with cron or task scheduler.

**Q: Is it safe to interrupt the update process?**
A: Yes, data is only saved at the end. Interrupting during execution won't corrupt your data.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## 🙏 Acknowledgments

- **YouTube Data API v3** for providing access to video statistics
- **TrendSiam Community** for feedback and testing
- **Contributors** who helped improve the security and reliability

---

**Last Updated**: January 23, 2025  
**Version**: 1.0.0  
**Compatibility**: TrendSiam v2.0+ 