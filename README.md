# YouTube Trending Videos Fetcher for Thailand

A comprehensive Python toolkit that fetches trending YouTube videos in Thailand using `yt-dlp`, extracts relevant metadata, and generates Thai-language summaries using OpenAI's GPT-3.5-turbo model.

## Features

### Core Functionality
- 🇹🇭 Fetches trending videos specifically from Thailand
- ⏰ Filters videos from the last 24 hours
- 📊 Extracts comprehensive metadata (title, description, views, etc.)
- 💾 Saves data to CSV file
- 📝 Comprehensive logging
- ⚡ Efficient and legally compliant (public data only)

### AI-Powered Summarization
- 🤖 Generates Thai-language summaries using OpenAI GPT-3.5-turbo
- 📰 News-style reporting format (max 3 lines)
- 🔧 Configurable AI settings
- 🛡️ Robust error handling and graceful degradation
- 🔄 Integration with video fetcher for complete workflow

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Ensure `yt-dlp` is properly installed:
```bash
yt-dlp --version
```

## Usage

### Basic Usage
```python
from youtube_fetcher import YouTubeTrendingFetcher

# Create fetcher instance
fetcher = YouTubeTrendingFetcher()

# Fetch trending videos (saves to CSV by default)
videos = fetcher.get_trending_videos()

# Print results
for video in videos:
    print(f"Title: {video['title']}")
    print(f"Views: {video['view_count']}")
    print(f"URL: {video['video_url']}")
    print()
```

### Command Line Usage
```bash
python youtube_fetcher.py
```

### Programmatic Usage
```python
# Fetch without saving to CSV
videos = fetcher.get_trending_videos(save_csv=False)

# Custom CSV filename
fetcher.save_to_csv(videos, 'custom_filename.csv')
```

### AI Summarizer Usage

#### Setup OpenAI API
1. Get your OpenAI API key from https://platform.openai.com/
2. Edit `config_openai.py` and replace the placeholder with your API key:
```python
OPENAI_API_KEY = "your-actual-api-key-here"
```

#### Basic Summarization
```python
from summarizer import summarize_video_info

# Single video summary
video_data = {
    'title': 'วิธีทำต้มยำกุ้ง',
    'description': 'สอนทำต้มยำกุ้งแบบดั้งเดิม...',
    'view_count': '1500000',
    'publish_date': '20231201',
    'channel': 'ครัวไทย'
}

summary = summarize_video_info(video_data)
print(summary)  # Thai summary in 3 lines or less
```

#### Complete Integration
```python
# Method 1: yt-dlp integration (works without API key)
python example_integration.py

# Method 2: YouTube Data API v3 + Batch summarization
python youtube_api_fetcher.py    # Generate thailand_trending_api.json
python summarize_all.py          # Process and add Thai summaries
```

## Batch Processing Workflow

### YouTube Data API v3 + AI Summarization

For the most reliable results, use the two-step process:

1. **Fetch videos using YouTube Data API v3:**
   ```bash
   python youtube_api_fetcher.py
   ```
   - Generates `thailand_trending_api.json` with 50 trending videos
   - Requires YouTube Data API key (see `setup_youtube_api.md`)
   - More reliable than yt-dlp scraping

2. **Generate Thai summaries for all videos:**
   ```bash
   python summarize_all.py
   ```
   - Processes `thailand_trending_api.json`
   - Generates Thai summaries using OpenAI API  
   - Shows progress bar with success/failure counts
   - Saves results to `thailand_trending_summary.json`

**Expected Output:**
```
🇹🇭 Batch Thai Video Summarizer
====================================================
✅ Loaded 50 videos from thailand_trending_api.json
🚀 Starting batch summarization...

Processing: วิธีทำต้มยำกุ้ง สูตรต้นตำรับ...  80%|████████  | 40/50 [02:15<00:30, 2.1video/s, Success=38, Failed=2]

📊 Processing Summary:
  ✅ Successful summaries: 48
  ❌ Failed summaries: 2  
  📝 Total processed: 50

🎉 Batch processing completed!
📈 Success rate: 96.0%
```

## Output Format

### yt-dlp Based Fetcher (`youtube_fetcher.py`)
- **title**: Video title
- **description**: Video description (truncated to 500 chars)
- **view_count**: Number of views
- **publish_date**: Upload date (YYYYMMDD format)
- **video_url**: YouTube video URL
- **channel**: Channel/uploader name
- **duration**: Video duration in seconds
- **thumbnail**: Thumbnail URL

### YouTube Data API v3 Fetcher (`youtube_api_fetcher.py`)
- **title**: Video title
- **channel**: Channel name
- **view_count**: Formatted view count (1,234,567)
- **published_date**: Readable timestamp (2024-01-15 10:30:00 UTC)
- **video_id**: YouTube video ID
- **description**: Video description (truncated to 200 chars)
- **duration**: Formatted duration (1:30 or 1:30:45)
- **like_count**: Number of likes
- **comment_count**: Number of comments

### With Thai Summaries (`summarize_all.py` output)
All original fields plus:
- **summary**: AI-generated Thai summary (1-2 lines)

## Files Generated

### Core Files
- `thailand_trending_videos.csv`: Main output file with video data (yt-dlp)
- `youtube_fetcher.log`: Log file with execution details
- `thailand_trending_api.json`: Video data from YouTube Data API v3

### AI Summarization Files
- `thailand_trending_with_summaries.csv`: Video data with Thai AI summaries (yt-dlp workflow)
- `thailand_trending_summary.json`: Complete data with Thai summaries (API workflow)
- `config_openai.py`: OpenAI API configuration (edit with your API key)

### Available Scripts
- `youtube_fetcher.py`: Core video fetching functionality (yt-dlp based)
- `youtube_api_fetcher.py`: YouTube Data API v3 alternative fetcher
- `summarizer.py`: AI-powered Thai summarization
- `summarize_all.py`: Batch processing for YouTube API data
- `example_integration.py`: Complete workflow example  
- `debug_fetcher.py`: Debug script with detailed logging for troubleshooting

## Legal and Ethical Compliance

This script:
- ✅ Only accesses publicly available data
- ✅ Uses official YouTube URLs
- ✅ Respects rate limits
- ✅ Does not download video content
- ✅ Complies with YouTube's terms of service for public data access

## Troubleshooting

### Common Issues

1. **yt-dlp not found**: Install using `pip install yt-dlp`
2. **No videos found**: May occur if no videos were uploaded in Thailand in the last 24 hours
3. **Timeout errors**: Check internet connection or increase timeout values
4. **"Filtered to 0 videos"**: Use debug mode to see why videos are rejected

### Debugging "No Videos Found" Issues

If you see "Filtered to 0 videos from last 24 hours", run the debug script:

```bash
python debug_fetcher.py
```

This will show:
- Which videos were fetched from trending page
- Upload dates extracted for each video
- Why each video was rejected (too old, missing date, etc.)
- Detailed error messages for troubleshooting

### Error Logs

Check `youtube_fetcher.log` for detailed error information.

## Requirements

### Core Requirements
- Python 3.7+
- yt-dlp
- Internet connection
- No YouTube API key required

### AI Summarization Requirements (Optional)
- OpenAI API key (for `summarizer.py`)
- openai Python library (included in `requirements.txt`)
- Active internet connection for API calls

**Note**: The video fetcher works independently without OpenAI. AI summarization is an optional enhancement. 