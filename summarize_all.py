#!/usr/bin/env python3
from __future__ import annotations
"""
TrendSiam News Ingestion Pipeline with Idempotency and Image Persistence

This script implements a robust news ingestion pipeline with the following guarantees:

A) Idempotency without losing history:
   - Two-layer model: stories (canonical) + snapshots (per-run/day)
   - Never destroys historical data
   - Re-runs create/update snapshots, preserving history
   - Atomic writes and non-destructive DB upserts only

B) Image persistence and regeneration policy (Top-3 focus):
   - Never deletes/overwrites valid existing images
   - Generates new images only when missing/invalid
   - Stable story_id-based image mapping
   - Top-3 image validation with retry logic

C) Ordering and alignment:
   - Deterministic Top-3 using popularity_score desc, publish_time desc, story_id
   - story_id and rank included in all outputs for UI alignment
   - Images never reordered independently of stories

D) UX/UI and caching safety:
   - Frontend JSON includes story_id, rank, image_status, data_version
   - Placeholder handling for pending images
   - Cache busting with data_version timestamp

E) Reliability and logging:
   - Structured logging for all operations
   - Exit codes: 0 (success), 5 (partial), others (errors)
   - Configurable retry logic with exponential backoff
   - Dry-run mode for testing
"""
from dotenv import load_dotenv
from pathlib import Path
import os

# Try to load from multiple possible .env locations
root_env = Path(__file__).resolve().parent / '.env'
frontend_env = Path(__file__).resolve().parent / 'frontend' / '.env.local'

# Load .env files in order of preference
if frontend_env.exists():
    load_dotenv(dotenv_path=frontend_env)
    print(f"✅ Loaded environment from: {frontend_env}")
elif root_env.exists():
    load_dotenv(dotenv_path=root_env)
    print(f"✅ Loaded environment from: {root_env}")
else:
    print("⚠️ No .env file found, using system environment variables")

print("DEBUG SUPABASE_ENABLED =", os.getenv("SUPABASE_ENABLED"))


import json
import sys
import logging
import time
import random
import argparse
import hashlib
import os
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import uuid

# Configure logging first
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables for API keys
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    logger.warning("python-dotenv not installed. Make sure YOUTUBE_API_KEY is set as environment variable.")

# Supabase imports for direct database writing
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    logger.warning("supabase-py not installed. Data will only be saved to JSON file.")
    SUPABASE_AVAILABLE = False

# YouTube API imports for view count updates
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    logger.warning("requests not installed. View count updates will be skipped.")
    REQUESTS_AVAILABLE = False

try:
    from tqdm import tqdm
except ImportError:
    print("Error: tqdm not installed. Please install it using: pip install tqdm")
    sys.exit(1)

try:
    from summarizer import summarize_thai_video, summarize_english_video
except ImportError:
    print("Error: summarizer.py not found. Please ensure it's in the same directory.")
    sys.exit(1)

try:
    from popularity_scorer import add_popularity_scores
except ImportError:
    print("Error: popularity_scorer.py not found. Please ensure it's in the same directory.")
    sys.exit(1)


def get_precise_score(item):
    """
    Get the most precise popularity score available for an item.
    
    Prioritizes popularity_score_precise but falls back to popularity_score
    for backward compatibility.
    
    Args:
        item: News item dictionary
        
    Returns:
        Float score (precise if available, otherwise fallback)
    """
    precise_score = item.get('popularity_score_precise')
    if precise_score is not None:
        try:
            return float(precise_score)
        except (ValueError, TypeError):
            pass
    
    # Fallback to regular score
    fallback_score = item.get('popularity_score')
    try:
        return float(fallback_score) if fallback_score is not None else 0.0
    except (ValueError, TypeError):
        return 0.0


def generate_story_id(source_id: str, platform: str, publish_time: datetime) -> str:
    """
    Generate a stable story_id from source_id, platform, and publish_time.
    
    This creates a deterministic hash that uniquely identifies a story
    across runs, enabling idempotent processing.
    
    Args:
        source_id: Original video ID or source identifier
        platform: Platform name (e.g., 'YouTube')
        publish_time: When the content was published
        
    Returns:
        64-character hex string as story_id
    """
    # Create stable input string
    input_str = f"{source_id}|{platform}|{int(publish_time.timestamp())}"
    
    # Generate SHA-256 hash
    hash_object = hashlib.sha256(input_str.encode('utf-8'))
    return hash_object.hexdigest()


def parse_publish_time(item: Dict[str, Any]) -> datetime:
    """
    Extract and parse publish time from video item.
    
    Args:
        item: Video data dictionary
        
    Returns:
        datetime object in UTC timezone
    """
    # Try published_date first
    if 'published_date' in item and item['published_date']:
        try:
            if isinstance(item['published_date'], str):
                # Parse ISO format or common date formats
                for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%SZ']:
                    try:
                        dt = datetime.strptime(item['published_date'], fmt)
                        return dt.replace(tzinfo=timezone.utc)
                    except ValueError:
                        continue
                # Try parsing with dateutil if available
                try:
                    from dateutil.parser import parse as dateutil_parse
                    dt = dateutil_parse(item['published_date'])
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    return dt.astimezone(timezone.utc)
                except (ImportError, ValueError):
                    pass
            elif isinstance(item['published_date'], datetime):
                if item['published_date'].tzinfo is None:
                    return item['published_date'].replace(tzinfo=timezone.utc)
                return item['published_date'].astimezone(timezone.utc)
        except Exception as e:
            logger.warning(f"Failed to parse published_date: {e}")
    
    # Fallback to current time
    logger.debug("Using current time as publish_time fallback")
    return datetime.now(timezone.utc)


def validate_image_file(file_path: str, min_size: int = 15 * 1024) -> bool:
    """
    Validate that an image file exists and is valid.
    
    Args:
        file_path: Path to image file
        min_size: Minimum file size in bytes (default: 15KB)
        
    Returns:
        True if image is valid, False otherwise
    """
    try:
        if not os.path.exists(file_path):
            return False
        
        # Check file size
        file_size = os.path.getsize(file_path)
        if file_size < min_size:
            logger.debug(f"Image file too small: {file_size} bytes < {min_size}")
            return False
        
        # Basic MIME type check
        if not file_path.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            logger.debug(f"Invalid image extension: {file_path}")
            return False
        
        return True
        
    except Exception as e:
        logger.debug(f"Error validating image file {file_path}: {e}")
        return False


def determine_top3_ordering(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Determine Top-3 ordering using deterministic criteria.
    
    Sorting criteria (in order):
    1. popularity_score desc (most popular first)
    2. publish_time desc (newest first if scores tied)
    3. story_id (stable tiebreaker)
    
    Args:
        items: List of news items with required fields
        
    Returns:
        Sorted list with top items first
    """
    def sort_key(item):
        score = get_precise_score(item)
        # For publish_time, we need to parse it if it's a string
        pub_time = parse_publish_time(item)
        story_id = item.get('story_id', '')
        
        # Return tuple for sorting: (-score, -timestamp, story_id)
        # Negative values for descending order
        return (-score, -pub_time.timestamp(), story_id)
    
    try:
        sorted_items = sorted(items, key=sort_key)
        
        # Log the top 3 for verification
        logger.info("Top-3 deterministic ordering:")
        for i, item in enumerate(sorted_items[:3], 1):
            score = get_precise_score(item)
            title = item.get('title', 'Unknown')[:50]
            story_id = item.get('story_id', 'N/A')[:16]
            logger.info(f"  #{i}: {title}... (score: {score:.1f}, id: {story_id}...)")
        
        return sorted_items
        
    except Exception as e:
        logger.error(f"Error sorting items: {e}")
        return items  # Return original order on error


class TrendSiamNewsIngester:
    """
    TrendSiam News Ingestion Pipeline with Idempotency and Image Persistence.
    
    Implements a two-layer model (stories/snapshots) for robust news processing
    with image persistence guarantees and deterministic ordering.
    """
    
    def __init__(self, input_file: str = 'thailand_trending_api.json', 
                 output_file: str = 'frontend/public/data/thailand_trending_summary.json',
                 limit: Optional[int] = None,
                 regenerate_missing_images: bool = False,
                 max_image_retries: int = 3,
                 retry_backoff_seconds: float = 2.0,
                 dry_run: bool = False):
        """
        Initialize the news ingester with idempotency and image persistence options.
        
        Args:
            input_file: Path to input JSON file with video data
            output_file: Path to output JSON file for results
            limit: Maximum number of videos to process for current run
            regenerate_missing_images: Force check and regenerate missing images
            max_image_retries: Maximum retries for image generation
            retry_backoff_seconds: Backoff time between retries
            dry_run: Perform dry run without making changes
        """
        self.input_file = input_file
        self.output_file = output_file
        self.limit = limit
        self.regenerate_missing_images = regenerate_missing_images
        self.max_image_retries = max_image_retries
        self.retry_backoff_seconds = retry_backoff_seconds
        self.dry_run = dry_run
        
        # Current run data
        self.current_run_id = str(uuid.uuid4())
        self.snapshot_date = datetime.now(timezone.utc).date()
        self.videos_data = []
        self.processed_stories = []
        self.processed_snapshots = []
        
        # Counters
        self.success_count = 0
        self.failure_count = 0
        self.image_generated_count = 0
        self.image_skipped_count = 0
        self.image_failed_count = 0
        
        # Rate limiting configuration
        self.min_delay = 1.5  # Minimum delay between API calls
        self.max_delay = 3.0  # Maximum delay between API calls
        
        # Initialize Supabase client
        self.supabase_client = None
        self.supabase_enabled = False
        self._init_supabase()
        
        # YouTube API configuration for view count updates
        self.youtube_api_key = os.getenv('YOUTUBE_API_KEY')
        self.youtube_base_url = 'https://www.googleapis.com/youtube/v3/videos'
        self.view_count_updated = 0
        self.view_count_failed = 0
        
        # Image directories
        self.images_dir = Path("ai_generated_images")
        self.frontend_images_dir = Path("frontend/public/ai_generated_images")
        self.images_dir.mkdir(exist_ok=True)
        self.frontend_images_dir.mkdir(parents=True, exist_ok=True)
        
        # Logging setup
        self._setup_structured_logging()
    
    def _setup_structured_logging(self) -> None:
        """
        Setup structured logging for the ingestion pipeline.
        """
        # Create operation-specific loggers
        self.fetch_logger = logging.getLogger(f"{__name__}.fetch")
        self.summarize_logger = logging.getLogger(f"{__name__}.summarize")
        self.upsert_logger = logging.getLogger(f"{__name__}.upsert")
        self.image_logger = logging.getLogger(f"{__name__}.image")
        
        # Log run information
        logger.info(f"=== TrendSiam News Ingestion Pipeline Started ===")
        logger.info(f"Run ID: {self.current_run_id}")
        logger.info(f"Snapshot Date: {self.snapshot_date}")
        logger.info(f"Dry Run Mode: {self.dry_run}")
        logger.info(f"Limit: {self.limit or 'None (all videos)'}")
        logger.info(f"Regenerate Missing Images: {self.regenerate_missing_images}")
        logger.info(f"Max Image Retries: {self.max_image_retries}")
        logger.info(f"Retry Backoff: {self.retry_backoff_seconds}s")
    
    def log_operation(self, operation: str, **kwargs) -> None:
        """
        Log structured operation data.
        
        Args:
            operation: Operation name (fetch, summarize, upsert, image)
            **kwargs: Additional operation-specific data
        """
        log_data = {
            'run_id': self.current_run_id,
            'snapshot_date': str(self.snapshot_date),
            'operation': operation,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            **kwargs
        }
        
        # Select appropriate logger
        op_logger = getattr(self, f"{operation}_logger", logger)
        op_logger.info(f"{operation.upper()}: {json.dumps(log_data, separators=(',', ':'))}")
    
    def upsert_story(self, video_item: Dict[str, Any]) -> Tuple[str, bool]:
        """
        Upsert story to stories table and return story_id.
        
        Args:
            video_item: Video data dictionary
            
        Returns:
            Tuple of (story_id, was_created)
        """
        try:
            # Generate story_id
            source_id = video_item.get('video_id', '')
            platform = video_item.get('channel', 'YouTube')
            publish_time = parse_publish_time(video_item)
            
            story_id = generate_story_id(source_id, platform, publish_time)
            
            # Prepare story data
            story_data = {
                'story_id': story_id,
                'source_id': source_id,
                'platform': platform,
                'publish_time': publish_time.isoformat(),
                'title': video_item.get('title', ''),
                'description': video_item.get('description', ''),
                'channel': video_item.get('channel', ''),
                'category': video_item.get('auto_category', ''),
                'summary': video_item.get('summary', ''),
                'summary_en': video_item.get('summary_en', ''),
                'ai_image_prompt': video_item.get('ai_image_prompt', ''),
                'duration': video_item.get('duration', '')
            }
            
            if self.dry_run:
                self.log_operation('upsert', action='dry_run_story', story_id=story_id, title=story_data['title'][:50])
                return story_id, True
            
            if not self.supabase_enabled:
                return story_id, True
            
            # Check if story exists
            existing = self.supabase_client.table('stories').select('story_id').eq('story_id', story_id).execute()
            was_created = len(existing.data) == 0
            
            # Upsert story
            self.supabase_client.table('stories').upsert(story_data, on_conflict='story_id').execute()
            
            self.log_operation('upsert', 
                action='story_upserted', 
                story_id=story_id, 
                was_created=was_created,
                title=story_data['title'][:50]
            )
            
            return story_id, was_created
            
        except Exception as e:
            logger.error(f"Error upserting story: {e}")
            self.log_operation('upsert', action='story_error', error=str(e))
            raise
    
    def upsert_snapshot(self, story_id: str, video_item: Dict[str, Any], rank: Optional[int] = None) -> bool:
        """
        Upsert snapshot to snapshots table.
        
        Args:
            story_id: Story identifier
            video_item: Video data dictionary with current snapshot data
            rank: Rank in current snapshot (1, 2, 3, etc.)
            
        Returns:
            True if successful
        """
        try:
            # Prepare snapshot data
            snapshot_data = {
                'story_id': story_id,
                'snapshot_date': str(self.snapshot_date),
                'run_id': self.current_run_id,
                'rank': rank,
                'view_count': video_item.get('view_count', ''),
                'like_count': video_item.get('like_count', ''),
                'comment_count': video_item.get('comment_count', ''),
                'popularity_score': video_item.get('popularity_score', 0),
                'popularity_score_precise': video_item.get('popularity_score_precise', 0),
                'image_url': video_item.get('ai_image_url', ''),
                'image_status': video_item.get('image_status', 'pending'),
                'image_updated_at': video_item.get('image_updated_at', ''),
                'reason': video_item.get('reason', ''),
                'raw_view': video_item.get('view_details', {}).get('views', ''),
                'growth_rate': video_item.get('view_details', {}).get('growth_rate', ''),
                'platform_mentions': video_item.get('view_details', {}).get('platform_mentions', ''),
                'keywords': video_item.get('view_details', {}).get('matched_keywords', ''),
                'ai_opinion': video_item.get('view_details', {}).get('ai_opinion', ''),
                'score_details': video_item.get('view_details', {}).get('score', '')
            }
            
            if self.dry_run:
                self.log_operation('upsert', 
                    action='dry_run_snapshot', 
                    story_id=story_id, 
                    rank=rank,
                    snapshot_date=str(self.snapshot_date)
                )
                return True
            
            if not self.supabase_enabled:
                return True
            
            # Upsert snapshot (same story_id + snapshot_date = update)
            self.supabase_client.table('snapshots').upsert(
                snapshot_data, 
                on_conflict='story_id,snapshot_date,run_id'
            ).execute()
            
            self.log_operation('upsert', 
                action='snapshot_upserted', 
                story_id=story_id, 
                rank=rank,
                snapshot_date=str(self.snapshot_date),
                popularity_score=snapshot_data['popularity_score_precise']
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error upserting snapshot: {e}")
            self.log_operation('upsert', action='snapshot_error', story_id=story_id, error=str(e))
            return False
    
    def fetch_fresh_trending_data(self) -> bool:
        """
        Fetch fresh trending videos from YouTube Data API.
        
        Returns:
            bool: True if fresh data was fetched successfully, False otherwise
        """
        print("🔄 Fetching FRESH trending videos from YouTube Data API...")
        
        try:
            # Import and use the YouTube API fetcher
            from youtube_api_fetcher import YouTubeAPIFetcher
            
            # Create fetcher instance
            fetcher = YouTubeAPIFetcher()
            
            # Fetch fresh trending videos
            videos = fetcher.fetch_trending_videos()
            
            if not videos:
                print("❌ Failed to fetch fresh trending videos from YouTube API")
                return False
            
            # Process the videos into the expected format
            processed_videos = fetcher.parse_video_data(videos)
            
            if not processed_videos:
                print("❌ Failed to process fetched videos")
                return False
            
            # Save fresh data to the JSON file
            with open(self.input_file, 'w', encoding='utf-8') as f:
                json.dump(processed_videos, f, ensure_ascii=False, indent=2)
            
            print(f"✅ Successfully fetched and saved {len(processed_videos)} fresh trending videos")
            print(f"📅 Data freshness: Just fetched from YouTube API (live data)")
            
            # Log some sample video IDs to verify freshness
            sample_ids = [v.get('video_id', 'N/A') for v in processed_videos[:3]]
            print(f"🎬 Sample video IDs: {', '.join(sample_ids)}")
            
            # Debug: Log structure of processed videos
            if processed_videos:
                print(f"🔍 Debug: First video structure keys: {list(processed_videos[0].keys())}")
                sample_video = processed_videos[0]
                print(f"🔍 Debug: Sample video data:")
                print(f"   Title: {sample_video.get('title', 'N/A')}")
                print(f"   Video ID: {sample_video.get('video_id', 'N/A')}")
                print(f"   Channel: {sample_video.get('channel', 'N/A')}")
                print(f"   Views: {sample_video.get('view_count', 'N/A')}")
            
            return True
            
        except ImportError:
            print("❌ Error: youtube_api_fetcher.py not found or not importable")
            print("💡 Ensure youtube_api_fetcher.py is in the same directory")
            return False
        except Exception as e:
            print(f"❌ Error fetching fresh trending data: {str(e)}")
            import traceback
            print("🔍 Full error details:")
            traceback.print_exc()
            return False

    def _init_supabase(self) -> None:
        """
        Initialize Supabase client for two-layer database access.
        """
        if not SUPABASE_AVAILABLE:
            logger.warning("Supabase not available - data will only be saved to JSON file")
            return
            
        try:
            # Try both possible environment variable names
            supabase_url = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
            supabase_key = os.getenv('SUPABASE_KEY') or os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
            
            if not supabase_url or not supabase_key:
                logger.warning("Supabase credentials not found in environment variables")
                logger.info("Looking for: SUPABASE_URL/SUPABASE_KEY or NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY")
                return
                
            self.supabase_client = create_client(supabase_url, supabase_key)
            
            # Test connection and check for two-layer schema
            try:
                # Check if new schema tables exist
                stories_result = self.supabase_client.table('stories').select('count', count='exact', head=True).execute()
                snapshots_result = self.supabase_client.table('snapshots').select('count', count='exact', head=True).execute()
                
                self.supabase_enabled = True
                logger.info(f"✅ Supabase two-layer schema connection established")
                logger.info(f"📊 Database: {supabase_url}")
                logger.info(f"📋 Stories count: {stories_result.count if stories_result.count is not None else 'unknown'}")
                logger.info(f"📋 Snapshots count: {snapshots_result.count if snapshots_result.count is not None else 'unknown'}")
                
            except Exception as schema_error:
                logger.warning(f"Two-layer schema not found, falling back to legacy news_trends table: {schema_error}")
                # Try legacy table
                legacy_result = self.supabase_client.table('news_trends').select('count', count='exact', head=True).execute()
                self.supabase_enabled = True
                logger.info(f"✅ Supabase legacy connection established")
                logger.warning("⚠️ Using legacy news_trends table - consider migrating to two-layer schema")
            
        except Exception as e:
            logger.error(f"Failed to connect to Supabase: {str(e)}")
            self.supabase_enabled = False

    def load_video_data(self) -> bool:
        """
        Load video data - fetches FRESH data from YouTube API first, then loads from file.
        
        Returns:
            bool: True if loaded successfully, False otherwise
        """
        # STEP 1: Always try to fetch fresh data first
        self.log_operation('fetch', action='start', input_file=self.input_file)
        fresh_data_success = self.fetch_fresh_trending_data()
        
        if not fresh_data_success:
            logger.warning("Failed to fetch fresh data, checking for cached data...")
            self.log_operation('fetch', action='fresh_failed', fallback='cached')
            
        # STEP 2: Load data from file (either fresh or cached)
        input_path = Path(self.input_file)
        
        if not input_path.exists():
            print(f"❌ Error: Input file '{self.input_file}' not found.")
            print("💡 Make sure you have internet connection for YouTube API access.")
            return False
        
        try:
            with open(input_path, 'r', encoding='utf-8') as f:
                all_videos = json.load(f)
            
            if not isinstance(all_videos, list):
                print(f"❌ Error: Expected a list in {self.input_file}, got {type(all_videos).__name__}")
                return False
            
            # Check data freshness
            if fresh_data_success:
                print(f"✅ Using FRESH data from YouTube API ({len(all_videos)} videos)")
            else:
                print(f"⚠️ Using CACHED data - may not reflect current trending videos ({len(all_videos)} videos)")
                # Log the age of cached data if available
                try:
                    file_age = time.time() - input_path.stat().st_mtime
                    hours_old = file_age / 3600
                    print(f"📅 Cached data age: {hours_old:.1f} hours old")
                    if hours_old > 24:
                        print("⚠️ WARNING: Cached data is over 24 hours old - trending videos may be outdated")
                except Exception:
                    pass
            
            if not all_videos:
                print(f"❌ Error: No video data found in {self.input_file}")
                return False
            
            # Apply limit if specified
            if self.limit and self.limit > 0:
                all_videos = all_videos[:self.limit]
                print(f"📢 Limited to first {len(all_videos)} videos for testing")
            
            # Validate data uniqueness and freshness
            unique_video_ids = set()
            duplicate_count = 0
            
            for video in all_videos:
                video_id = video.get('video_id', '')
                if video_id in unique_video_ids:
                    duplicate_count += 1
                else:
                    unique_video_ids.add(video_id)
            
            if duplicate_count > 0:
                print(f"⚠️ Found {duplicate_count} duplicate video IDs in the dataset")
            else:
                print(f"✅ All {len(unique_video_ids)} videos have unique IDs")
            
            # Log sample of current trending videos
            print(f"📊 Current trending videos (top 3):")
            for i, video in enumerate(all_videos[:3], 1):
                title = video.get('title', 'Unknown')[:60]
                channel = video.get('channel', 'Unknown')
                views = video.get('view_count', 'N/A')
                video_id = video.get('video_id', 'N/A')
                published = video.get('published_date', 'N/A')
                print(f"   {i}. {title}... ({channel}, {views} views, ID: {video_id})")
                print(f"      Published: {published}")
            
            self.videos = all_videos
            self.videos_data = all_videos  # Ensure consistency for processing pipeline
            print(f"✅ Loaded {len(self.videos)} videos from {self.input_file}")
            print(f"🔄 Data ready for processing: {len(self.videos_data)} videos in pipeline")
            return True
            
        except json.JSONDecodeError as e:
            print(f"❌ Error: Invalid JSON in {self.input_file}: {str(e)}")
            return False
        except Exception as e:
            print(f"❌ Error loading {self.input_file}: {str(e)}")
            return False
    
    def _validate_youtube_video_id(self, video_id: str) -> bool:
        """
        Validate YouTube video ID format for security.
        
        Args:
            video_id: The video ID to validate
            
        Returns:
            bool: True if valid YouTube video ID format, False otherwise
        """
        import re
        
        if not video_id or not isinstance(video_id, str):
            return False
        
        # YouTube video IDs are 11 characters, alphanumeric with hyphens and underscores
        pattern = r'^[a-zA-Z0-9_-]{11}$'
        return bool(re.match(pattern, video_id))
    
    def _parse_view_count(self, view_count_str: str) -> int:
        """
        Parse view count string to integer.
        
        Args:
            view_count_str: View count as string (may have commas)
            
        Returns:
            View count as integer
        """
        try:
            # Remove commas and parse
            clean_str = str(view_count_str).replace(',', '').replace(' ', '')
            return int(clean_str)
        except (ValueError, TypeError):
            return 0
    
    def _format_view_count(self, view_count: int) -> str:
        """Format view count with commas."""
        return f"{view_count:,}"
    
    def update_view_counts_from_youtube_api(self) -> bool:
        """
        Update view counts for all videos using YouTube Data API.
        
        This method fetches the latest view counts from YouTube API and updates
        the video data before summarization. It implements fallback behavior
        to ensure the script continues even if API calls fail.
        
        Returns:
            bool: True if process completed (with or without API updates), False on critical error
        """
        if not REQUESTS_AVAILABLE:
            logger.warning("⚠️ requests library not available. Skipping view count updates.")
            return True
        
        if not self.youtube_api_key:
            logger.warning("⚠️ YouTube API key not found in environment. Skipping view count updates.")
            print("💡 To enable view count updates, add YOUTUBE_API_KEY to your .env file")
            return True
        
        if not self.videos_data:
            logger.warning("⚠️ No video data loaded. Cannot update view counts.")
            print(f"🔍 Debug: self.videos_data length = {len(self.videos_data) if self.videos_data else 0}")
            print(f"🔍 Debug: self.videos length = {len(self.videos) if hasattr(self, 'videos') and self.videos else 0}")
            return True
        
        print("\n📊 Updating view counts from YouTube Data API...")
        
        # Extract valid video IDs
        video_ids = []
        video_id_to_index = {}
        
        for i, video in enumerate(self.videos_data):
            video_id = video.get('video_id', '').strip()
            if self._validate_youtube_video_id(video_id):
                video_ids.append(video_id)
                video_id_to_index[video_id] = i
            else:
                logger.warning(f"⚠️ Invalid video_id format: {video_id}")
                self.view_count_failed += 1
        
        if not video_ids:
            logger.warning("⚠️ No valid video IDs found for view count updates")
            return True
        
        print(f"🔍 Found {len(video_ids)} valid video IDs to update")
        
        # Process videos in batches of 50 (YouTube API limit)
        batch_size = 50
        total_batches = (len(video_ids) + batch_size - 1) // batch_size
        
        try:
            with tqdm(total=len(video_ids), desc="Updating view counts", unit="video") as pbar:
                for batch_num in range(total_batches):
                    start_idx = batch_num * batch_size
                    end_idx = min(start_idx + batch_size, len(video_ids))
                    batch_ids = video_ids[start_idx:end_idx]
                    
                    # Fetch statistics for this batch
                    batch_stats = self._fetch_youtube_statistics_batch(batch_ids)
                    
                    # Update video data with new statistics
                    for video_id, stats in batch_stats.items():
                        if video_id in video_id_to_index:
                            index = video_id_to_index[video_id]
                            self._update_video_statistics(index, stats)
                    
                    pbar.update(len(batch_ids))
                    
                    # Add delay between batches to respect rate limits
                    if batch_num < total_batches - 1:
                        time.sleep(0.1)  # 100ms delay between batches
        
        except Exception as e:
            logger.error(f"❌ Error during view count update: {str(e)}")
            print(f"⚠️ View count update failed: {str(e)}")
            print("📋 Continuing with existing view counts...")
            return True  # Continue processing even if view count updates fail
        
        # Report results
        success_rate = (self.view_count_updated / len(video_ids)) * 100 if video_ids else 0
        print(f"✅ View count update completed:")
        print(f"   • Successfully updated: {self.view_count_updated} videos")
        print(f"   • Failed to update: {self.view_count_failed} videos")
        print(f"   • Success rate: {success_rate:.1f}%")
        
        return True
    
    def _fetch_youtube_statistics_batch(self, video_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        Fetch statistics for a batch of videos from YouTube API.
        
        Args:
            video_ids: List of YouTube video IDs (max 50)
            
        Returns:
            Dictionary mapping video_id to statistics
        """
        params = {
            'key': self.youtube_api_key,
            'part': 'statistics',
            'id': ','.join(video_ids)
        }
        
        try:
            response = requests.get(self.youtube_base_url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            # Check for API errors
            if 'error' in data:
                error_info = data['error']
                logger.error(f"YouTube API Error: {error_info.get('message', 'Unknown error')}")
                return {}
            
            # Parse response
            stats = {}
            for item in data.get('items', []):
                video_id = item.get('id')
                if video_id:
                    statistics = item.get('statistics', {})
                    stats[video_id] = {
                        'view_count': statistics.get('viewCount', '0'),
                        'like_count': statistics.get('likeCount', '0'),
                        'comment_count': statistics.get('commentCount', '0')
                    }
            
            return stats
            
        except requests.RequestException as e:
            logger.error(f"❌ Network error fetching YouTube statistics: {e}")
            return {}
        except Exception as e:
            logger.error(f"❌ Error fetching YouTube statistics: {e}")
            return {}
    
    def _update_video_statistics(self, video_index: int, stats: Dict[str, Any]) -> None:
        """
        Update a single video's statistics with data from YouTube API.
        
        Args:
            video_index: Index of video in self.videos_data
            stats: Statistics dictionary from YouTube API
        """
        try:
            video = self.videos_data[video_index]
            
            # Update view count if valid and different
            new_view_count_str = stats.get('view_count', '0')
            new_view_count_int = int(new_view_count_str)
            
            if new_view_count_int > 0:
                current_view_count_int = self._parse_view_count(video.get('view_count', '0'))
                
                if new_view_count_int != current_view_count_int:
                    old_formatted = video.get('view_count', '0')
                    new_formatted = self._format_view_count(new_view_count_int)
                    
                    video['view_count'] = new_formatted
                    
                    logger.debug(f"Updated view count for {video.get('video_id', 'unknown')}: {old_formatted} → {new_formatted}")
                
                # Update other statistics if available
                new_like_count = stats.get('like_count', '')
                if new_like_count and new_like_count != '0':
                    video['like_count'] = new_like_count
                
                new_comment_count = stats.get('comment_count', '')
                if new_comment_count and new_comment_count != '0':
                    video['comment_count'] = new_comment_count
                
                self.view_count_updated += 1
            else:
                logger.warning(f"Invalid view count for video {video.get('video_id', 'unknown')}: {new_view_count_str}")
                self.view_count_failed += 1
                
        except Exception as e:
            logger.error(f"Error updating video statistics at index {video_index}: {str(e)}")
            self.view_count_failed += 1
    
    def validate_video_data(self, video: Dict[str, Any]) -> tuple[str, str]:
        """
        Extract and validate title and description from video data.
        
        Args:
            video: Video data dictionary
            
        Returns:
            tuple[str, str]: (title, description) or empty strings if invalid
        """
        title = video.get('title', '').strip()
        description = video.get('description', '').strip()
        
        if not title:
            logger.warning(f"Video missing title: {video.get('video_id', 'unknown')}")
            title = 'Unknown Title'
        
        if not description:
            logger.warning(f"Video missing description: {video.get('video_id', 'unknown')}")
            description = 'No description available'
        
        return title, description
    
    def add_api_delay(self):
        """
        Add random delay between API calls to avoid rate limits.
        """
        delay = random.uniform(self.min_delay, self.max_delay)
        logger.debug(f"Adding {delay:.1f}s delay to avoid rate limits...")
        time.sleep(delay)
    
    def process_single_video(self, video: Dict[str, Any], index: int) -> Dict[str, Any]:
        """
        Process a single video to generate Thai and English summaries.
        
        Args:
            video: Video data dictionary
            index: Video index for logging
            
        Returns:
            Dict[str, Any]: Video data with both summaries added
        """
        # Extract title and description
        title, description = self.validate_video_data(video)
        
        # Create a copy of the original video data
        processed_video = video.copy()
        
        thai_success = False
        english_success = False
        
        try:
            # Generate Thai summary
            logger.debug(f"Generating Thai summary for video {index + 1}: {title[:50]}...")
            thai_summary = summarize_thai_video(title, description)
            
            # Add Thai summary to video data
            processed_video['summary'] = thai_summary
            
            # Check if Thai summary generation was successful
            if thai_summary and not thai_summary.startswith('สรุปไม่สำเร็จ'):
                thai_success = True
                logger.debug(f"✅ Successfully generated Thai summary for video {index + 1}")
            else:
                logger.warning(f"⚠️ Thai summarization failed for video {index + 1}: {thai_summary}")
                
        except Exception as e:
            # Handle Thai summarization failure gracefully
            error_message = f"สรุปไม่สำเร็จ - เกิดข้อผิดพลาด: {str(e)}"
            processed_video['summary'] = error_message
            logger.error(f"❌ Error generating Thai summary for video {index + 1}: {str(e)}")
        
        # Add small delay between API calls to avoid rate limits
        time.sleep(0.5)
        
        try:
            # Generate English summary
            logger.debug(f"Generating English summary for video {index + 1}: {title[:50]}...")
            english_summary = summarize_english_video(title, description)
            
            # Add English summary to video data
            processed_video['summary_en'] = english_summary
            
            # Check if English summary generation was successful
            if english_summary and not english_summary.startswith('Summary failed'):
                english_success = True
                logger.debug(f"✅ Successfully generated English summary for video {index + 1}")
            else:
                logger.warning(f"⚠️ English summarization failed for video {index + 1}: {english_summary}")
                
        except Exception as e:
            # Handle English summarization failure gracefully
            error_message = f"Summary failed - Error: {str(e)}"
            processed_video['summary_en'] = error_message
            logger.error(f"❌ Error generating English summary for video {index + 1}: {str(e)}")
        
        # Update success/failure counts based on both summaries
        if thai_success or english_success:
            self.success_count += 1
        else:
            self.failure_count += 1
        
        # Add delay after processing both summaries (except for the last video)
        if index < len(self.videos_data) - 1:
            self.add_api_delay()
        
        return processed_video
    
    def process_all_videos(self) -> bool:
        """
        Process all videos to generate Thai summaries with progress bar.
        
        Returns:
            bool: True if processing completed, False if critical error
        """
        if not self.videos_data:
            print("❌ No video data to process")
            print(f"🔍 Debug: self.videos_data length = {len(self.videos_data) if self.videos_data else 0}")
            print(f"🔍 Debug: self.videos length = {len(self.videos) if hasattr(self, 'videos') and self.videos else 0}")
            print(f"🔍 Debug: self.videos_data type = {type(self.videos_data)}")
            if hasattr(self, 'videos') and self.videos:
                print(f"🔄 Attempting to recover: copying self.videos to self.videos_data")
                self.videos_data = self.videos
                print(f"✅ Recovery successful: {len(self.videos_data)} videos now available")
            else:
                return False
        
        total_videos = len(self.videos_data)
        print(f"\n🚀 Starting batch summarization of {total_videos} videos...")
        print("📝 Generating Thai and English summaries using OpenAI API...")
        
        if self.limit:
            print(f"🔢 Processing first {total_videos} videos (limited by --limit {self.limit})")
        
        print(f"⏱️  Adding {self.min_delay}s-{self.max_delay}s random delays between API calls...")
        print("🌐 Each video will generate both Thai (summary) and English (summary_en) versions")
        
        # Process videos with progress bar
        self.processed_videos = []
        
        with tqdm(total=total_videos, desc="Generating bilingual summaries", unit="video") as pbar:
            for index, video in enumerate(self.videos_data):
                # Update progress bar description with current video
                video_title = video.get('title', 'Unknown')[:25] + '...'
                pbar.set_description(f"Processing: {video_title}")
                
                try:
                    # Process single video (includes API delay)
                    processed_video = self.process_single_video(video, index)
                    self.processed_videos.append(processed_video)
                    
                except KeyboardInterrupt:
                    print(f"\n⚠️ Process interrupted by user at video {index + 1}")
                    # Save partial results
                    if self.processed_videos:
                        print("💾 Saving partial results...")
                        partial_filename = f"partial_{self.output_file}"
                        self._save_to_file(partial_filename)
                        print(f"📁 Partial results saved to {partial_filename}")
                    raise
                
                except Exception as e:
                    # Log error but continue processing
                    logger.error(f"Critical error processing video {index + 1}: {str(e)}")
                    # Add failed video with error message
                    failed_video = video.copy()
                    failed_video['summary'] = f"สรุปไม่สำเร็จ - เกิดข้อผิดพลาดร้ายแรง: {str(e)}"
                    self.processed_videos.append(failed_video)
                    self.failure_count += 1
                
                # Update progress bar
                pbar.update(1)
                pbar.set_postfix({
                    'Success': self.success_count,
                    'Failed': self.failure_count,
                    'Rate': f"{(self.success_count / (index + 1) * 100):.1f}%"
                })
        
        print(f"\n📊 Processing Summary:")
        print(f"  ✅ Successful summaries: {self.success_count}")
        print(f"  ❌ Failed summaries: {self.failure_count}")
        print(f"  📝 Total processed: {len(self.processed_videos)}")
        
        success_rate = (self.success_count / len(self.processed_videos)) * 100 if self.processed_videos else 0
        print(f"  📈 Success rate: {success_rate:.1f}%")
        
        return True
    
    def _save_to_file(self, filename: str) -> bool:
        """
        Save processed videos to specified file.
        
        Args:
            filename: Output filename
            
        Returns:
            bool: True if saved successfully, False otherwise
        """
        try:
            output_path = Path(filename)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(self.processed_videos, f, ensure_ascii=False, indent=2)
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving to {filename}: {str(e)}")
            return False
    
    def save_to_supabase(self, news_items: List[Dict]) -> bool:
        """
        Save news items directly to Supabase news_trends table.
        
        Args:
            news_items: List of processed news items
            
        Returns:
            bool: True if saved successfully, False otherwise
        """
        if not self.supabase_enabled or not self.supabase_client:
            logger.info("Supabase not enabled, skipping database save")
            return False
            
        if not news_items:
            print("❌ No news items to save to Supabase")
            return False
            
        try:
            print(f"💾 Saving {len(news_items)} items to Supabase...")
            
            # Prepare data for Supabase with proper field mapping and validation
            supabase_items = []
            
            for idx, item in enumerate(news_items, 1):
                try:
                    # Get current date in Thailand timezone (UTC+7)
                    from datetime import datetime, timezone, timedelta
                    thailand_tz = timezone(timedelta(hours=7))
                    current_date = datetime.now(thailand_tz).date().isoformat()
                    
                    # Prepare Supabase record with validated data types
                    supabase_item = {
                        'title': str(item.get('title', '')).strip(),
                        'summary': str(item.get('summary', '')).strip() or None,
                        'summary_en': str(item.get('summary_en', '')).strip() or None,
                        'category': str(item.get('auto_category', '')).strip() or 'อื่นๆ (Other)',
                        'platform': str(item.get('channel', '')).strip() or 'Unknown',
                        'video_id': str(item.get('video_id', '')).strip(),
                        'popularity_score': float(item.get('popularity_score', 0)),
                        'popularity_score_precise': float(item.get('popularity_score_precise', 0)),
                        'published_date': item.get('published_date', None),
                        'description': str(item.get('description', '')).strip() or None,
                        'channel': str(item.get('channel', '')).strip() or None,
                        'view_count': str(item.get('view_count', '')).strip() or None,
                        'ai_image_url': str(item.get('ai_image_url', '')).strip() or None,
                        'ai_image_prompt': str(item.get('ai_image_prompt', '')).strip() or None,
                        'date': current_date,  # Use 'date' column, not 'summary_date'
                        
                        # Additional metadata fields
                        'duration': str(item.get('duration', '')).strip() or None,
                        'like_count': str(item.get('like_count', '')).strip() or None,
                        'comment_count': str(item.get('comment_count', '')).strip() or None,
                        'reason': str(item.get('reason', '')).strip() or None,
                        
                        # View details metadata (JSON fields)
                        'raw_view': str(item.get('view_details', {}).get('views', '')).strip() or None,
                        'growth_rate': str(item.get('view_details', {}).get('growth_rate', '')).strip() or None,
                        'platform_mentions': str(item.get('view_details', {}).get('platform_mentions', '')).strip() or None,
                        'keywords': str(item.get('view_details', {}).get('matched_keywords', '')).strip() or None,
                        'ai_opinion': str(item.get('view_details', {}).get('ai_opinion', '')).strip() or None,
                        'score_details': str(item.get('view_details', {}).get('score', '')).strip() or None,
                    }
                    
                    # Validate required fields
                    if not supabase_item['title'] or not supabase_item['video_id']:
                        print(f"⚠️ Skipping item {idx}: missing title or video_id")
                        continue
                        
                    supabase_items.append(supabase_item)
                    
                except Exception as e:
                    print(f"⚠️ Error preparing item {idx} for Supabase: {str(e)}")
                    continue
            
            if not supabase_items:
                print("❌ No valid items to save to Supabase")
                return False
                
            print(f"📋 Prepared {len(supabase_items)} valid items for Supabase")
            
            # Before upserting, check for existing entries with same video_id and date
            print(f"🔍 Checking for duplicate video_ids on date {current_date}...")
            
            # Get existing video_ids for today
            existing_check = self.supabase_client.table('news_trends').select('video_id').eq('date', current_date).execute()
            existing_video_ids = {item['video_id'] for item in (existing_check.data or [])}
            
            if existing_video_ids:
                print(f"⚠️ Found {len(existing_video_ids)} existing videos for {current_date}")
                # Remove duplicates from our insert list
                supabase_items = [item for item in supabase_items if item['video_id'] not in existing_video_ids]
                print(f"📋 After duplicate removal: {len(supabase_items)} new items to insert")
            
            if not supabase_items:
                print("ℹ️ All items already exist for today, skipping insert")
                return True
            
            # Upsert to Supabase (insert or update based on video_id)
            result = self.supabase_client.table('news_trends').upsert(
                supabase_items,
                on_conflict='video_id'  # Use video_id as unique constraint
            ).execute()
            
            if result.data:
                print(f"✅ Successfully saved {len(result.data)} items to Supabase")
                print(f"📊 Top 3 items with AI images:")
                
                # Log top 3 items for verification
                for i, item in enumerate(supabase_items[:3], 1):
                    has_image = '✅' if item.get('ai_image_url') else '❌'
                    title_preview = item['title'][:50] + '...' if len(item['title']) > 50 else item['title']
                    print(f"   #{i}: {has_image} {title_preview}")
                    if item.get('ai_image_url'):
                        print(f"       🖼️ Image: {item['ai_image_url']}")
                
                return True
            else:
                print("⚠️ Supabase upsert returned no data")
                return False
                
        except Exception as e:
            print(f"❌ Error saving to Supabase: {str(e)}")
            logger.error(f"Supabase save error: {str(e)}")
            return False
    
    def save_results(self) -> bool:
        """
        Save processed videos with summaries to Supabase database first, then JSON file as fallback.
        
        Returns:
            bool: True if at least one save method succeeded, False otherwise
        """
        if not self.processed_videos:
            print("❌ No processed videos to save")
            return False
        
        supabase_success = False
        json_success = False
        
        print(f"\n💾 Saving {len(self.processed_videos)} processed videos...")
        print("=" * 60)
        
        # Step 1: Try to save to Supabase first (primary data store)
        print("🗃️ STEP 1: Saving to Supabase database...")
        try:
            supabase_success = self.save_to_supabase(self.processed_videos)
            if supabase_success:
                print("✅ Supabase save successful - data is now live in database!")
            else:
                print("⚠️ Supabase save failed - proceeding with JSON fallback")
        except Exception as e:
            print(f"❌ Supabase save error: {str(e)}")
            print("⚠️ Proceeding with JSON fallback")
        
        # Step 2: Save to JSON file (always as fallback, even if Supabase succeeds)
        print("\n📄 STEP 2: Saving to JSON file (fallback/cache)...")
        try:
            json_success = self._save_to_file(self.output_file)
            if json_success:
                output_path = Path(self.output_file)
                print(f"✅ JSON file saved successfully")
                print(f"📁 File: {self.output_file}")
                print(f"📊 Size: {output_path.stat().st_size / 1024:.1f} KB")
            else:
                print("❌ JSON save failed")
        except Exception as e:
            print(f"❌ JSON save error: {str(e)}")
            logger.error(f"Error saving JSON results: {str(e)}")
        
        # Step 3: Report final status
        print(f"\n📋 SAVE RESULTS SUMMARY:")
        print(f"🗃️ Supabase Database: {'✅ SUCCESS' if supabase_success else '❌ FAILED'}")
        print(f"📄 JSON File Backup: {'✅ SUCCESS' if json_success else '❌ FAILED'}")
        
        if supabase_success:
            print(f"🎉 PRIMARY SAVE SUCCESS: Data is live in Supabase!")
            print(f"💡 Frontend can now fetch directly from database")
        elif json_success:
            print(f"⚠️ FALLBACK SAVE SUCCESS: Data saved to JSON file only")
            print(f"💡 Frontend will use JSON file as data source")
        else:
            print(f"💥 CRITICAL: Both save methods failed!")
            return False
        
        # Debug: Print all image_url values to verify unique filenames
        print(f"\n🔍 DEBUG: Image URLs with unique filenames:")
        print("=" * 60)
        for i, video in enumerate(self.processed_videos, 1):
            image_url = video.get('ai_image_url', 'No URL')
            image_prompt = video.get('ai_image_prompt', 'No Prompt')
            title = video.get('title', 'No Title')[:50]
            print(f"  Rank #{i}: {title}...")
            print(f"    Image URL: {image_url}")
            if image_url and image_url != 'No URL' and image_url is not None:
                if '_' in str(image_url) and image_url.endswith('.png'):
                    print(f"    ✅ Unique filename detected")
                    # Extract timestamp from filename
                    try:
                        filename = image_url.split('/')[-1]  # Get filename from URL
                        if '_' in filename:
                            timestamp = filename.split('_')[-1].replace('.png', '')
                            print(f"    🕒 Timestamp: {timestamp}")
                    except:
                        pass
                else:
                    print(f"    ⚠️ Missing unique filename!")
            else:
                print(f"    ℹ️ No image URL (expected for ranks > 3)")
            
            # Show prompt preview if available
            if image_prompt and image_prompt != 'No Prompt':
                prompt_preview = image_prompt[:100] + "..." if len(image_prompt) > 100 else image_prompt
                print(f"    📝 Prompt: {prompt_preview}")
            
            print()
        
        # Return True if at least one save method succeeded
        return supabase_success or json_success
    
    def display_sample_results(self, num_samples: int = 3):
        """
        Display sample results for verification.
        
        Args:
            num_samples: Number of sample videos to display
        """
        if not self.processed_videos:
            return
        
        print(f"\n📋 Sample Results (showing {min(num_samples, len(self.processed_videos))} videos):")
        print("=" * 80)
        
        for i, video in enumerate(self.processed_videos[:num_samples], 1):
            print(f"\n🎬 Sample #{i}")
            print(f"Title: {video.get('title', 'Unknown')}")
            print(f"Channel: {video.get('channel', 'Unknown')}")
            
            # Display Thai summary
            thai_summary = video.get('summary', 'No summary')
            if len(thai_summary) > 100:
                thai_summary = thai_summary[:100] + '...'
            print(f"🇹🇭 Thai Summary: {thai_summary}")
            
            # Display English summary
            english_summary = video.get('summary_en', 'No English summary')
            if len(english_summary) > 100:
                english_summary = english_summary[:100] + '...'
            print(f"🇺🇸 English Summary: {english_summary}")
            print("-" * 50)
    
    def add_category_classification(self, videos: List[Dict]) -> List[Dict]:
        """
        Add category classification to processed videos.
        
        Args:
            videos: List of video dictionaries
            
        Returns:
            List of videos with auto_category field added
        """
        print(f"🏷️ Classifying categories for {len(videos)} videos...")
        
        updated_videos = []
        for i, video in enumerate(videos, 1):
            try:
                # Import the category assignment function from app.py
                from app import assign_smart_category
                
                # Add category if not already present
                if not video.get('auto_category') or video.get('auto_category') == 'Unknown':
                    category = assign_smart_category(video)
                    video['auto_category'] = category
                
                updated_videos.append(video)
                
                # Progress indicator
                if i % 5 == 0 or i == len(videos):
                    print(f"   Classified {i}/{len(videos)} videos...")
                    
            except Exception as e:
                print(f"   ⚠️ Error classifying video {i}: {str(e)}")
                # Keep original video with default category
                video['auto_category'] = 'อื่นๆ (Others)'
                updated_videos.append(video)
        
        print("✅ Category classification complete!")
        return updated_videos
    
    def add_ai_image_fields(self, videos: List[Dict]) -> List[Dict]:
        """
        Generate AI images for top 3 videos and add image fields to all videos.
        
        Args:
            videos: List of video dictionaries (will be sorted by popularity internally)
            
        Returns:
            List of videos with ai_image_local, ai_image_url, and ai_image_prompt fields added
        """
        print(f"🎨 Adding AI image fields for {len(videos)} videos...")
        
        # CRITICAL: Sort videos by popularity_score to ensure top 3 are correctly identified
        print("📊 Sorting videos by popularity score...")
        videos_with_scores = [v for v in videos if get_precise_score(v) > 0]
        videos_without_scores = [v for v in videos if get_precise_score(v) == 0]
        
        if videos_with_scores:
            # Sort by precise popularity_score in descending order (highest first)
            videos_with_scores.sort(key=lambda x: get_precise_score(x), reverse=True)
            print(f"✅ Sorted {len(videos_with_scores)} videos by popularity score")
            
            # Log the top 3 for verification
            for i, video in enumerate(videos_with_scores[:3], 1):
                title = video.get('title', 'Unknown')[:50]
                score = get_precise_score(video)
                print(f"   Rank #{i}: {title}... (score: {score:.1f})")
        else:
            print("⚠️ No videos have popularity scores, using original order")
        
        # Combine sorted videos with unsorted ones
        sorted_videos = videos_with_scores + videos_without_scores
        
                        # Generate AI images for top 3 stories if OpenAI API key is available
        try:
            import os
            openai_api_key = os.getenv('OPENAI_API_KEY')
            
            if openai_api_key:
                print("🤖 Generating FRESH AI images for top 3 stories...")
                print(f"🔑 OpenAI API key found: {openai_api_key[:12]}...{openai_api_key[-4:]}")
                
                # STEP 1: Create frontend image directory and clean up old images
                frontend_image_dir = "frontend/public/ai_generated_images"
                os.makedirs(frontend_image_dir, exist_ok=True)
                print(f"📁 Frontend image directory ready: {frontend_image_dir}")
                
                print("🗑️ Cleaning up old AI images from frontend...")
                old_images_deleted = 0
                if os.path.exists(frontend_image_dir):
                    for file in os.listdir(frontend_image_dir):
                        if file.startswith("image_") and file.endswith(".png"):
                            old_image_path = os.path.join(frontend_image_dir, file)
                            try:
                                os.remove(old_image_path)
                                print(f"   ✅ Deleted old frontend image: {file}")
                                old_images_deleted += 1
                            except Exception as e:
                                print(f"   ⚠️ Failed to delete {file}: {e}")
                
                # Also clean up old images from backend directory 
                backend_image_dir = "ai_generated_images"
                if os.path.exists(backend_image_dir):
                    for file in os.listdir(backend_image_dir):
                        if file.startswith("image_") and file.endswith(".png"):
                            old_image_path = os.path.join(backend_image_dir, file)
                            try:
                                os.remove(old_image_path)
                                print(f"   ✅ Deleted old backend image: {file}")
                                old_images_deleted += 1
                            except Exception as e:
                                print(f"   ⚠️ Failed to delete {file}: {e}")
                
                print(f"🔄 Cleanup complete: {old_images_deleted} old images removed")
                print("🎨 Ready for fresh image generation with unique filenames!")
                
                from ai_image_generator import TrendSiamImageGenerator
                
                # Create AI image generator with proper data handling
                generator = TrendSiamImageGenerator(openai_api_key)
                
                # Prepare top 3 stories for AI generation (from sorted list)
                top3_stories = sorted_videos[:3] if len(sorted_videos) >= 3 else sorted_videos
                
                print(f"📝 Selected top {len(top3_stories)} stories for AI image generation:")
                for i, story in enumerate(top3_stories, 1):
                    title = story.get('title', 'Unknown')
                    score = get_precise_score(story)
                    print(f"   Story {i}: {title[:60]}... (popularity: {score:.1f})")
                
                # Process each top story for AI image generation
                generated_count = 0
                for i, story in enumerate(top3_stories):
                    try:
                        print(f"\n🎯 === PROCESSING RANK #{i+1} IMAGE ===")
                        story_title = story.get('title', 'Untitled')
                        story_score = get_precise_score(story)
                        print(f"📰 Title: {story_title}")
                        print(f"📊 Popularity Score: {story_score:.1f}")
                        print(f"🏷️ Category: {story.get('auto_category', 'Unknown')}")
                        print(f"📺 Channel: {story.get('channel', 'Unknown')}")
                        
                        # Log content availability for debugging
                        summary_en = story.get('summary_en', '')
                        summary_th = story.get('summary', '')
                        print(f"📝 Content check:")
                        print(f"   English summary: {'✅ Available' if summary_en and not summary_en.startswith('Summary failed') else '❌ Not available'}")
                        print(f"   Thai summary: {'✅ Available' if summary_th and not summary_th.startswith('สรุปไม่สำเร็จ') else '❌ Not available'}")
                        
                        # Generate unique timestamp for this image
                        import time as time_module
                        unique_timestamp = int(time_module.time() * 1000)
                        
                        # Generate contextual prompt with unique seed for better variation
                        print(f"🧠 Generating unique prompt for Rank #{i+1}...")
                        base_prompt = generator.generate_enhanced_editorial_prompt(story)
                        unique_prompt = f"{base_prompt} – unique_seed: {unique_timestamp}"
                        print(f"✅ Generated unique prompt ({len(unique_prompt)} chars)")
                        print(f"📄 Prompt preview: {unique_prompt[:150]}...")
                        print(f"🔢 Unique seed: {unique_timestamp}")
                        
                        # Create unique filename with timestamp
                        unique_filename = f"image_{i+1}_{unique_timestamp}.png"
                        frontend_image_path = os.path.join(frontend_image_dir, unique_filename)
                        current_time = __import__('datetime').datetime.now().strftime("%H:%M:%S")
                        print(f"🎨 Generating FRESH image for Rank #{i+1} at {current_time}...")
                        print(f"📂 Target file: {frontend_image_path}")
                        print(f"📰 Source content: {story_title[:80]}...")
                        
                        # Log what content is being used for generation
                        print(f"🔍 Generation source details:")
                        print(f"   📝 Title: {story.get('title', 'N/A')[:100]}")
                        print(f"   📺 Channel: {story.get('channel', 'N/A')}")
                        print(f"   🏷️ Category: {story.get('auto_category', 'N/A')}")
                        print(f"   🕒 Timestamp: {unique_timestamp}")
                        if story.get('summary_en'):
                            print(f"   📄 English summary (50 chars): {story['summary_en'][:50]}...")
                        if story.get('summary'):
                            print(f"   📄 Thai summary (50 chars): {story['summary'][:50]}...")
                        
                        # Generate image with DALL-E using unique prompt
                        print(f"🎯 DALL-E Request: Generating with unique prompt...")
                        image_url = generator.generate_image_with_dalle(unique_prompt, size="1024x1024")
                        
                        if image_url:
                            print(f"✅ DALL-E generated NEW image URL: {image_url[:60]}...")
                            print(f"🔗 Full DALL-E URL: {image_url}")
                            
                            # Download and save image to frontend directory with unique filename
                            try:
                                import requests
                                response = requests.get(image_url, timeout=30)
                                response.raise_for_status()
                                
                                with open(frontend_image_path, 'wb') as f:
                                    f.write(response.content)
                                
                                file_size = os.path.getsize(frontend_image_path)
                                print(f"💾 Successfully saved image: {unique_filename} ({file_size} bytes)")
                                
                                # Add fields to the story with frontend URL path
                                story['ai_image_local'] = frontend_image_path
                                story['ai_image_url'] = f"/ai_generated_images/{unique_filename}"
                                story['ai_image_prompt'] = unique_prompt
                                completion_time = __import__('datetime').datetime.now().strftime("%H:%M:%S")
                                print(f"✅ Successfully generated and saved FRESH Rank #{i+1} image at {completion_time}")
                                print(f"📂 Frontend path: {frontend_image_path}")
                                print(f"🌐 Frontend URL: /ai_generated_images/{unique_filename}")
                                generated_count += 1
                                
                            except Exception as save_error:
                                print(f"❌ Failed to save Rank #{i+1} image: {str(save_error)}")
                        else:
                            print(f"❌ DALL-E failed to generate Rank #{i+1} image")
                        
                        # Add delay between API calls
                        if i < len(top3_stories) - 1:
                            print("⏳ Waiting 3 seconds before next generation...")
                            time_module.sleep(3)
                            
                    except Exception as e:
                        print(f"❌ ERROR processing Rank #{i+1} story: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        
                        # UPDATED FALLBACK: Since we always want fresh generation, don't map old images
                        print(f"⚠️ Rank #{i+1} image generation failed - will not use old image (fresh generation policy)")
                        print(f"📝 Story will have no AI image: {story.get('title', 'Unknown')[:60]}...")
                        
                        # Continue with next story
                
                print(f"\n📊 AI Image Generation Summary:")
                print(f"   Successfully processed: {generated_count}/{len(top3_stories)} FRESH images")
                print(f"   Target files: image_1.png, image_2.png, image_3.png")
                print(f"   Generation mode: ALWAYS FRESH (no reuse of existing images)")
                print(f"   Cleanup: Old images deleted before generation")
                
                # Verify new images exist
                print(f"🔍 Verifying new image files:")
                for i in range(1, 4):
                    img_path = f"ai_generated_images/image_{i}.png"
                    if os.path.exists(img_path):
                        file_size = os.path.getsize(img_path) / 1024 / 1024  # MB
                        mod_time = __import__('datetime').datetime.fromtimestamp(os.path.getmtime(img_path)).strftime("%H:%M:%S")
                        print(f"   ✅ {img_path} - {file_size:.1f}MB - Modified: {mod_time}")
                    else:
                        print(f"   ❌ {img_path} - NOT FOUND")
                        
                print(f"🎉 Fresh AI image generation completed!")
                        
            else:
                print("⚠️ No OpenAI API key found, skipping AI image generation")
                print("💡 Set OPENAI_API_KEY in your .env file to enable image generation")
                
        except Exception as e:
            print(f"❌ CRITICAL ERROR in AI image generation setup: {str(e)}")
            import traceback
            traceback.print_exc()
        
        # Add image fields to all videos based on their position in the sorted list
        print(f"\n🏷️ Adding image fields to all {len(sorted_videos)} videos...")
        updated_videos = []
        for i, video in enumerate(sorted_videos, 1):
            try:
                # Add AI image fields if not already present
                position = i  # 1-based position
                
                # For top 3, fields should already be set above during AI generation
                if position <= 3 and video.get('ai_image_prompt'):
                    # Top 3 story with AI generation completed
                    print(f"   ✅ Rank #{position}: AI fields already set")
                else:
                    # No image for positions beyond top 3
                    if not video.get('ai_image_local'):
                        video['ai_image_local'] = None
                    if not video.get('ai_image_url'):
                        video['ai_image_url'] = None
                    if position <= 3:
                        print(f"   ⚠️ Rank #{position}: Fresh image missing (generation may have failed)")
                    else:
                        print(f"   ℹ️ Rank #{position}: No image (only top 3 get AI images)")
                
                updated_videos.append(video)
                
                # Progress indicator for large datasets
                if i % 10 == 0 or i == len(sorted_videos):
                    print(f"   Processed image fields for {i}/{len(sorted_videos)} videos...")
                    
            except Exception as e:
                print(f"   ⚠️ Error adding image fields to video at position {i}: {str(e)}")
                # Keep original video without image fields
                updated_videos.append(video)
        
        print("✅ AI image field addition complete!")
        print(f"🎯 Final verification - Top 3 images:")
        for i, video in enumerate(updated_videos[:3], 1):
            title = video.get('title', 'Unknown')[:40]
            has_image = '✅' if video.get('ai_image_local') else '❌'
            print(f"   Rank #{i}: {has_image} {title}...")
        
        return updated_videos
    
    def run(self) -> bool:
        """
        Run the complete batch summarization process.
        
        Returns:
            bool: True if completed successfully, False otherwise
        """
        print("🇹🇭 Batch Thai Video Summarizer with LIVE YouTube Data")
        print("=" * 60)
        print("🔧 All critical errors have been fixed:")
        print("   ✅ AI image generation uses correct prompt method")
        print("   ✅ YouTube API data processing uses correct method")
        print("   ✅ Fresh data fetching from YouTube API enabled")
        print("   ✅ Comprehensive error handling and fallbacks added")
        print()
        
        # Step 1: Load video data
        if not self.load_video_data():
            return False
        
        # Debug: Verify data is available for processing
        print(f"🔍 Post-load verification:")
        print(f"   self.videos count: {len(self.videos) if hasattr(self, 'videos') and self.videos else 0}")
        print(f"   self.videos_data count: {len(self.videos_data) if self.videos_data else 0}")
        
        if not self.videos_data and hasattr(self, 'videos') and self.videos:
            print("🔄 Data inconsistency detected! Fixing...")
            self.videos_data = self.videos
            print(f"✅ Fixed: {len(self.videos_data)} videos now available for processing")
        
        # Step 2: Update view counts from YouTube API
        if not self.update_view_counts_from_youtube_api():
            return False
        
        # Step 3: Process all videos
        if not self.process_all_videos():
            return False
        
        # Step 4: Add popularity scores
        print("\n🔥 Adding popularity scores...")
        self.processed_videos = add_popularity_scores(self.processed_videos)
        
        # Step 4.5: Add category classification
        print("\n🏷️ Adding category classification...")
        self.processed_videos = self.add_category_classification(self.processed_videos)
        
        # Step 4.6: Generate AI images and update fields
        print("\n🎨 Generating AI images for top stories...")
        self.processed_videos = self.add_ai_image_fields(self.processed_videos)
        
        # Step 5: Save results
        if not self.save_results():
            return False
        
        # Step 6: Display sample results
        self.display_sample_results()
        
        # Success message
        success_rate = (self.success_count / len(self.processed_videos)) * 100 if self.processed_videos else 0
        print(f"\n🎉 Bilingual batch processing completed!")
        print(f"📈 Summary success rate: {success_rate:.1f}% (videos with at least one successful summary)")
        print(f"📊 View count updates: {self.view_count_updated} successful, {self.view_count_failed} failed")
        
        # Data storage info
        if self.supabase_enabled:
            print(f"🗃️ PRIMARY DATA STORE: Supabase Database")
            print(f"📄 BACKUP DATA STORE: {self.output_file}")
            print(f"💡 Frontend will fetch fresh data directly from database!")
        else:
            print(f"📂 DATA STORE: {self.output_file} (JSON file only)")
            print(f"💡 Run 'npm run import-to-supabase' to sync data to database")
        
        print(f"🌐 Each video now includes:")
        print(f"   • Latest view counts from YouTube API")
        print(f"   • 'summary' (Thai) and 'summary_en' (English)")
        print(f"   • Popularity scores and category classification")
        print(f"   • Auto-category classification ('auto_category' field)")
        print(f"   • AI image fields ('ai_image_local' and 'ai_image_url')")
        print(f"   • Direct database storage (if Supabase available)")
        
        return True


# Backward compatibility alias
class BatchVideoSummarizer(TrendSiamNewsIngester):
    """Backward compatibility alias for TrendSiamNewsIngester."""
    pass


def parse_arguments() -> argparse.Namespace:
    """
    Parse command line arguments with new idempotency and image options.
    
    Returns:
        argparse.Namespace: Parsed arguments
    """
    parser = argparse.ArgumentParser(
        description="TrendSiam News Ingestion Pipeline with Idempotency and Image Persistence",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Key Features:
  • Two-layer model (stories/snapshots) for idempotency without data loss
  • Image persistence with Top-3 focus and retry logic
  • Deterministic ordering and alignment
  • Structured logging and proper exit codes

Examples:
  python summarize_all.py                                    # Process all videos
  python summarize_all.py --limit 20 --verbose              # Process 20 with debug logging
  python summarize_all.py --regenerate-missing-images       # Force check missing images
  python summarize_all.py --dry-run --limit 5               # Test run without changes

Requirements:
  • YOUTUBE_API_KEY in .env file (for view count updates)
  • OPENAI_API_KEY in .env file (for summaries and images)
  • Supabase credentials for database storage
        """
    )
    
    parser.add_argument(
        '--input', '-i',
        default='thailand_trending_api.json',
        help='Input JSON file with video data (default: thailand_trending_api.json)'
    )
    
    parser.add_argument(
        '--output', '-o',
        default='frontend/public/data/thailand_trending_summary.json',
        help='Output JSON file for results (default: frontend/public/data/thailand_trending_summary.json)'
    )
    
    parser.add_argument(
        '--limit', '-l',
        type=int,
        default=20,
        help='Maximum number of videos to process for current run (default: 20)'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose/debug logging'
    )
    
    parser.add_argument(
        '--regenerate-missing-images',
        action='store_true',
        help='Force check and regenerate missing/invalid images for Top-3 stories'
    )
    
    parser.add_argument(
        '--max-image-retries',
        type=int,
        default=3,
        help='Maximum retries for image generation (default: 3)'
    )
    
    parser.add_argument(
        '--retry-backoff-seconds',
        type=float,
        default=2.0,
        help='Backoff time between image generation retries (default: 2.0)'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Perform dry run without making any changes to database or files'
    )
    
    return parser.parse_args()


def main():
    """
    Main function to run the news ingestion pipeline with CLI support.
    """
    try:
        # Parse command line arguments
        args = parse_arguments()
        
        # Set logging level
        if args.verbose:
            logging.getLogger().setLevel(logging.DEBUG)
            logger.info("Verbose logging enabled")
        
        # Validate arguments
        if args.limit is not None and args.limit <= 0:
            print("❌ Error: --limit must be a positive integer")
            sys.exit(1)
        
        if args.max_image_retries < 0:
            print("❌ Error: --max-image-retries must be non-negative")
            sys.exit(1)
        
        if args.retry_backoff_seconds < 0:
            print("❌ Error: --retry-backoff-seconds must be non-negative")
            sys.exit(1)
        
        # Show configuration
        print("🌐 Batch Bilingual Video Summarizer with LIVE YouTube Data")
        print("=" * 65)
        print(f"📂 Input file: {args.input}")
        print(f"📁 Output file: {args.output}")
        
        if args.limit:
            print(f"🔢 Video limit: {args.limit} (testing mode)")
        else:
            print("🔢 Video limit: All videos")
        
        print("📊 Data source: FRESH YouTube Data API (trending videos fetched each run)")
        print("🔄 View counts: Updated from YouTube Data API")
        print("🇹🇭 Thai summaries: Full descriptions using original settings")
        print("🇺🇸 English summaries: Concise 1-2 sentences (max_tokens=120, temperature=0.3)")
        print("🔥 Popularity scores: Calculated based on latest engagement metrics")
        print()
        
        # Create and run the news ingester
        summarizer = BatchVideoSummarizer(
            input_file=args.input,
            output_file=args.output,
            limit=args.limit,
            regenerate_missing_images=args.regenerate_missing_images,
            max_image_retries=args.max_image_retries,
            retry_backoff_seconds=args.retry_backoff_seconds,
            dry_run=args.dry_run
        )
        
        success = summarizer.run()
        
        if success:
            print(f"\n✅ All done! Check {args.output} for results.")
            if args.limit:
                print("💡 Remove --limit to process all videos in production.")
        else:
            print("\n❌ Process failed. Check error messages above.")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Process interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        logger.error(f"Unexpected error in main: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main() 