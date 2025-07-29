#!/usr/bin/env python3
"""
TrendSiam Configuration Constants

Centralized configuration constants to eliminate hardcoded values
throughout the codebase and improve maintainability.
"""

from typing import Dict, List, Any
import os

# ===== SECURITY CONFIGURATION =====

# Developer access control - Use environment variable for security
DEVELOPER_PASSWORD_ENV_VAR = "TRENDSIAM_DEV_PASSWORD"
DEFAULT_DEV_PASSWORD = None  # Must be set via environment variable

def get_developer_password() -> str:
    """Get developer password from environment variable."""
    return os.getenv(DEVELOPER_PASSWORD_ENV_VAR, "")

# ===== API CONFIGURATION =====

# YouTube Data API
YOUTUBE_API_KEY_ENV_VAR = "YOUTUBE_API_KEY"
YOUTUBE_TRENDING_URL = "https://www.youtube.com/feed/trending?gl=TH"
YOUTUBE_MAX_VIDEOS = 50
YOUTUBE_BATCH_SIZE = 50  # YouTube API limit per request

# OpenAI API  
OPENAI_API_KEY_ENV_VAR = "OPENAI_API_KEY"
OPENAI_MODEL_THAI = "gpt-3.5-turbo"
OPENAI_MODEL_ENGLISH = "gpt-3.5-turbo"
OPENAI_MAX_TOKENS_THAI = 200
OPENAI_MAX_TOKENS_ENGLISH = 120
OPENAI_TEMPERATURE_THAI = 0.7
OPENAI_TEMPERATURE_ENGLISH = 0.3

# Rate limiting
API_MIN_DELAY = 1.5  # seconds
API_MAX_DELAY = 3.0  # seconds

# ===== FILE PATHS =====

# Data files
TRENDING_API_DATA_FILE = "thailand_trending_api.json"
TRENDING_SUMMARY_FILE = "thailand_trending_summary.json"
TRENDING_DETAILS_FILE = "thailand_trending_summary_with_view_details.json"

# Output files
HTML_REPORT_FILE = "trendsiam_report.html"
PDF_REPORT_FILE = "trendsiam_report.pdf"
HTML_TEMPLATE_FILE = "report_template.html"

# AI generated images
AI_IMAGES_DIR = "ai_generated_images"
AI_IMAGE_PATTERNS = ["image_1.png", "image_2.png", "image_3.png"]

# Logs
LOG_DIR = "logs"
YOUTUBE_FETCHER_LOG = "youtube_fetcher.log"
STREAMLIT_TEST_LOG = "streamlit_test.log"

# ===== UI CONFIGURATION =====

# Streamlit page config
PAGE_TITLE = "🇹🇭 TrendSiam - Thailand YouTube Trending Analysis"
PAGE_ICON = "🇹🇭"
LAYOUT = "wide"

# Display limits
MAX_STORIES_DISPLAY = 50
MAX_TITLE_LENGTH = 100
MAX_DESCRIPTION_LENGTH = 500
MAX_SUMMARY_PREVIEW_LENGTH = 150

# ===== CATEGORIZATION CONSTANTS =====

# Category names (Thai/English)
CATEGORIES = {
    "entertainment": "บันเทิง (Entertainment)",
    "games_anime": "เกม/อนิเมะ (Games/Anime)", 
    "sports": "กีฬา (Sports)",
    "politics": "การเมือง (Politics)",
    "education": "การศึกษา (Education)",
    "lifestyle": "ไลฟ์สไตล์ (Lifestyle)",
    "business": "ธุรกิจ (Business)",
    "health": "สุขภาพ (Health)",
    "others": "อื่นๆ (Others)"
}

# Default category for unclassified content
DEFAULT_CATEGORY = CATEGORIES["others"]

# ===== POPULARITY SCORING =====

# Score ranges
MIN_POPULARITY_SCORE = 0
MAX_POPULARITY_SCORE = 100

# View count thresholds
VIEW_COUNT_THRESHOLDS = {
    "low": 10000,
    "medium": 100000,
    "high": 1000000,
    "viral": 10000000
}

# Engagement rate thresholds  
ENGAGEMENT_RATE_THRESHOLDS = {
    "low": 0.005,    # 0.5%
    "medium": 0.02,  # 2%
    "high": 0.05,    # 5%
    "excellent": 0.1 # 10%
}

# ===== KEYWORD WEIGHTS =====

# Field importance weights for categorization
FIELD_WEIGHTS = {
    "title": 4.0,        # Highest weight - most descriptive
    "channel": 2.5,      # Channel type is important indicator
    "summary_en": 2.0,   # English summary
    "summary": 1.5,      # Thai summary
    "description": 1.0   # Supporting information
}

# ===== TIME CONFIGURATION =====

# Date formats
DATE_FORMAT_YOUTUBE = "%Y%m%d"
DATE_FORMAT_DISPLAY = "%Y-%m-%d %H:%M:%S"
DATE_FORMAT_BACKUP = "%Y%m%d_%H%M%S"

# Time windows
RECENT_VIDEO_THRESHOLD_DAYS = 1
GROWTH_RATE_CALCULATION_DAYS = 7

# ===== VALIDATION PATTERNS =====

# YouTube video ID pattern (11 characters, alphanumeric with hyphens/underscores)
YOUTUBE_VIDEO_ID_PATTERN = r'^[a-zA-Z0-9_-]{11}$'

# OpenAI API key pattern (starts with sk- followed by 48 characters)
OPENAI_KEY_PATTERN = r'^sk-[a-zA-Z0-9]{48}$'

# ===== ERROR MESSAGES =====

ERROR_MESSAGES = {
    "no_data": "❌ No data available",
    "file_not_found": "❌ File not found: {filename}",
    "api_key_missing": "❌ API key not found in environment variables",
    "invalid_api_key": "❌ Invalid API key format",
    "rate_limit": "⚠️ Rate limit exceeded, retrying...",
    "network_error": "❌ Network error: {error}",
    "processing_error": "❌ Error processing data: {error}",
    "validation_error": "❌ Validation error: {error}"
}

# Success messages
SUCCESS_MESSAGES = {
    "data_loaded": "✅ Data loaded successfully: {count} items",
    "file_saved": "✅ File saved: {filename}",
    "processing_complete": "✅ Processing completed successfully",
    "api_connected": "✅ API connection successful",
    "classification_complete": "✅ Classification completed: {count} items"
}

# ===== FEATURE FLAGS =====

# Enable/disable features via environment variables
FEATURE_FLAGS = {
    "ai_image_generation": True,
    "pdf_generation": True,
    "auto_classification": True,
    "view_count_updates": True,
    "developer_mode": False  # Overridden by environment variable
}

def get_feature_flag(flag_name: str) -> bool:
    """Get feature flag value, with environment variable override."""
    env_var = f"TRENDSIAM_{flag_name.upper()}"
    env_value = os.getenv(env_var)
    if env_value is not None:
        return env_value.lower() in ("true", "1", "yes", "on")
    return FEATURE_FLAGS.get(flag_name, False)

# ===== LOGGING CONFIGURATION =====

LOG_LEVEL = os.getenv("TRENDSIAM_LOG_LEVEL", "INFO")
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

# ===== BACKUP CONFIGURATION =====

# Backup file patterns (for cleanup)
BACKUP_PATTERNS = [
    "*_backup_*",
    "*.backup_*", 
    "*_backup.*",
    "*.bak",
    "*~"
]

# Keep only N most recent backups
MAX_BACKUPS_TO_KEEP = 3 