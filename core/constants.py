#!/usr/bin/env python3
"""
Constants and configuration values for TrendSiam application.
This file centralizes all magic numbers and hardcoded values to improve maintainability.
"""

# API and Rate Limiting Constants
YOUTUBE_API_BATCH_SIZE = 50  # Maximum video IDs per YouTube API request
YOUTUBE_API_TIMEOUT = 30  # Timeout for YouTube API requests in seconds
YOUTUBE_API_RATE_LIMIT_DELAY = 0.1  # Delay between API requests in seconds
YOUTUBE_VIDEO_ID_LENGTH = 11  # Standard YouTube video ID length
YOUTUBE_MAX_REASONABLE_VIEWS = 10_000_000_000  # 10 billion max reasonable views

# OpenAI API Constants
OPENAI_MAX_TOKENS_DEFAULT = 150
OPENAI_MAX_TOKENS_ENGLISH = 120  # Reduced tokens for English summaries
OPENAI_TEMPERATURE_DEFAULT = 0.3
OPENAI_MODEL_DEFAULT = "gpt-3.5-turbo"

# File Processing Constants
MAX_TITLE_DISPLAY_LENGTH = 50
MAX_DESCRIPTION_PREVIEW_LENGTH = 100
MAX_SUMMARY_PREVIEW_LENGTH = 100
CSV_FILENAME_DEFAULT = "thailand_trending_videos.csv"

# Popularity Scoring Constants
POPULARITY_SCORE_MIN = 0
POPULARITY_SCORE_MAX = 100
VIEWS_SCORE_MAX = 30
ENGAGEMENT_SCORE_MAX = 50
KEYWORD_SCORE_MAX = 20
PRECISION_SCORE_MAX = 110  # With bonuses

# UI Constants
PROGRESS_BAR_MIN_WIDTH = 130
CARD_BORDER_RADIUS = 12
BACKDROP_BLUR = 10
DEFAULT_GRID_MIN_WIDTH = 200

# Thailand Specific Constants
THAILAND_COUNTRY_CODE = "TH"
YOUTUBE_TRENDING_URL_THAILAND = "https://www.youtube.com/feed/trending?gl=TH"
MAX_TRENDING_VIDEOS = 50

# Time Constants (in seconds)
RECENT_VIDEO_THRESHOLD_DAYS = 1
BATCH_PROCESSING_DELAY = 0.5  # Delay between summary generations
API_DELAY_MIN = 1.5
API_DELAY_MAX = 3.0

# Image Generation Constants
MAX_AI_IMAGES = 3  # Generate images for top 3 stories
AI_IMAGE_SIZE = "1024x1024"
AI_IMAGE_DELAY = 3  # Seconds between image generations

# File Backup Constants
BACKUP_TIMESTAMP_FORMAT = "%Y%m%d_%H%M%S"

# Category Classification Constants
TITLE_WEIGHT = 4
CHANNEL_WEIGHT = 2.5
SUMMARY_EN_WEIGHT = 2
SUMMARY_WEIGHT = 1.5
DESCRIPTION_WEIGHT = 1

# Security Constants
# NOTE: These are for validation only, not actual credentials
MIN_API_KEY_LENGTH = 20
OPENAI_API_KEY_PREFIX = "sk-"
YOUTUBE_API_KEY_MIN_LENGTH = 30

# Regular Expressions
YOUTUBE_VIDEO_ID_PATTERN = r'^[a-zA-Z0-9_-]{11}$'
VIEW_COUNT_CLEANUP_PATTERN = r'[^\d]'

# Error Messages
ERROR_NO_OPENAI_KEY = "OpenAI API key not found. Please set OPENAI_API_KEY in your .env file"
ERROR_NO_YOUTUBE_KEY = "YouTube API key not found. Please set YOUTUBE_API_KEY in your .env file"
ERROR_INVALID_VIDEO_ID = "Invalid YouTube video ID format"
ERROR_API_TIMEOUT = "API request timed out"

# Success Messages
SUCCESS_DATA_LOADED = "Data loaded successfully"
SUCCESS_PROCESSING_COMPLETE = "Processing completed successfully"
SUCCESS_BACKUP_CREATED = "Backup created successfully"

# File Extensions
JSON_EXTENSION = ".json"
CSV_EXTENSION = ".csv"
PDF_EXTENSION = ".pdf"
PNG_EXTENSION = ".png"
LOG_EXTENSION = ".log"

# Paths (relative to project root)
DATA_DIR = "."
BACKUP_DIR = "."
LOGS_DIR = "logs"
AI_IMAGES_DIR = "ai_generated_images"
CORE_DIR = "core"

# Default Filenames
TRENDING_API_FILENAME = "thailand_trending_api.json"
TRENDING_SUMMARY_FILENAME = "thailand_trending_summary.json"
TRENDING_WITH_DETAILS_FILENAME = "thailand_trending_summary_with_view_details.json"
ENVIRONMENT_TEMPLATE = "environment_template.txt"
REQUIREMENTS_FILENAME = "requirements.txt" 