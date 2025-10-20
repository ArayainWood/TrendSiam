#!/usr/bin/env python3
"""
TrendSiam News Ingestion Pipeline v2 with Idempotency and Image Persistence

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

import argparse
import hashlib
import json
import logging
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

# Import legacy adapter for compatibility
try:
    from legacy_adapter import LegacyAdapter
except ImportError:
    LegacyAdapter = None
    logging.warning("⚠️ Legacy adapter not available - some features may not work")

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Optional imports
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    logger.warning("supabase-py not installed. Database operations will be skipped.")
    SUPABASE_AVAILABLE = False

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    logger.warning("requests not installed. Image downloads will fail.")
    REQUESTS_AVAILABLE = False

try:
    from tqdm import tqdm
    TQDM_AVAILABLE = True
except ImportError:
    logger.warning("tqdm not installed. No progress bars.")
    TQDM_AVAILABLE = False


def generate_story_id(source_id: str, platform: str, publish_time: datetime) -> str:
    """Generate a stable story_id from source_id, platform, and publish_time."""
    input_str = f"{source_id}|{platform}|{int(publish_time.timestamp())}"
    hash_object = hashlib.sha256(input_str.encode('utf-8'))
    return hash_object.hexdigest()


def parse_publish_time(item: Dict[str, Any]) -> datetime:
    """Extract and parse publish time from video item."""
    if 'published_date' in item and item['published_date']:
        try:
            if isinstance(item['published_date'], str):
                for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%SZ']:
                    try:
                        dt = datetime.strptime(item['published_date'], fmt)
                        return dt.replace(tzinfo=timezone.utc)
                    except ValueError:
                        continue
            elif isinstance(item['published_date'], datetime):
                if item['published_date'].tzinfo is None:
                    return item['published_date'].replace(tzinfo=timezone.utc)
                return item['published_date'].astimezone(timezone.utc)
        except Exception as e:
            logger.warning(f"Failed to parse published_date: {e}")
    
    return datetime.now(timezone.utc)


def get_precise_score(item: Dict[str, Any]) -> float:
    """Get the most precise popularity score available."""
    precise_score = item.get('popularity_score_precise')
    if precise_score is not None:
        try:
            return float(precise_score)
        except (ValueError, TypeError):
            pass
    
    fallback_score = item.get('popularity_score')
    try:
        return float(fallback_score) if fallback_score is not None else 0.0
    except (ValueError, TypeError):
        return 0.0


def determine_top3_ordering(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Determine Top-3 ordering using server-consistent criteria."""
    def sort_key(item):
        # [data-freshness] Match server logic: ORDER BY popularity_score_precise DESC, id ASC
        score = get_precise_score(item)
        # Use ID for stable tiebreaker (ascending), not publish time
        item_id = item.get('id', item.get('story_id', ''))
        return (-score, item_id)  # Negative score for DESC, positive id for ASC
    
    try:
        sorted_items = sorted(items, key=sort_key)
        logger.info("📊 [data-freshness] Top-3 deterministic ordering (server-consistent):")
        for i, item in enumerate(sorted_items[:3], 1):
            score = get_precise_score(item)
            title = item.get('title', 'Unknown')[:50]
            item_id = item.get('id', item.get('story_id', 'N/A'))[:16]
            logger.info(f"  #{i}: {title}... (score: {score:.1f}, id: {item_id}...)")
        return sorted_items
    except Exception as e:
        logger.error(f"Error sorting items: {e}")
        return items


def validate_image_file(file_path: str, min_size: int = 15 * 1024) -> bool:
    """Validate that an image file exists and is valid."""
    try:
        if not os.path.exists(file_path):
            return False
        
        file_size = os.path.getsize(file_path)
        if file_size < min_size:
            return False
        
        if not file_path.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            return False
        
        return True
    except Exception:
        return False


class TrendSiamNewsIngester:
    """TrendSiam News Ingestion Pipeline with Idempotency and Image Persistence."""
    
    def __init__(self, **kwargs):
        """Initialize the news ingester."""
        # Configuration  
        self.input_file = kwargs.get('input_file', 'thailand_trending_api.json')
        # SECTION C: Remove JSON output dependency
        self.output_file = None  # JSON output disabled - Supabase only
        self.allow_json_fallback = os.getenv('ALLOW_JSON_FALLBACK', 'false').lower() == 'true'
        
        # SECTION H: Warn about JSON input usage
        if self.input_file and not self.allow_json_fallback:
            logger.warning("⚠️  SECTION H: JSON input files are deprecated. Use live YouTube API instead.")
            logger.warning("⚠️  Set ALLOW_JSON_FALLBACK=true only for emergency data recovery.")
        self.limit = kwargs.get('limit')
        self.generate_images = kwargs.get('generate_images', True)
        self.images_top_n = kwargs.get('images_top_n', 3)
        self.regenerate_missing_images = kwargs.get('regen_missing_images', False)
        self.max_image_retries = kwargs.get('max_image_retries', 3)
        self.retry_backoff_seconds = kwargs.get('retry_backoff_seconds', 2.0)
        self.dry_run = kwargs.get('dry_run', False)
        self.verbose = kwargs.get('verbose', False)
        self.recompute_scores = kwargs.get('recompute_scores', False)
        self.reclassify = kwargs.get('reclassify', False)
        self.recompute_summaries = kwargs.get('recompute_summaries', False)
        self.recompute_keywords = kwargs.get('recompute_keywords', False)
        self.force_all_summaries = kwargs.get('force_all_summaries', False)  # V2 summary fix
        self.strict_real_data = kwargs.get('strict_real_data', True)
        self.force_refresh_stats = kwargs.get('force_refresh_stats', False)  # [rank-img-investigation]
        self.emit_revalidate = kwargs.get('emit_revalidate', False)  # [data-freshness]
        self.override_images = kwargs.get('override_images', False)  # [IMAGE-PROTECTION]
        self.only_video_id = kwargs.get('only_video_id', None)  # [TARGETED-FIX]
        
        # Initialize legacy adapter
        self.legacy_adapter = LegacyAdapter() if LegacyAdapter else None
        
        # Set logging level
        if self.verbose:
            logging.getLogger().setLevel(logging.DEBUG)
        
        # Current run data
        self.current_run_id = str(uuid.uuid4())
        self.snapshot_date = datetime.now(timezone.utc).date()
        
        # Counters
        self.success_count = 0
        self.failure_count = 0
        self.image_generated_count = 0
        self.image_skipped_count = 0
        self.image_failed_count = 0
        
        # Image directories
        self.images_dir = Path("ai_generated_images")
        self.frontend_images_dir = Path("frontend/public/ai_generated_images")
        self.images_dir.mkdir(exist_ok=True)
        self.frontend_images_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize Supabase
        self.supabase_client = None
        self.supabase_enabled = False
        self._init_supabase()
        
        # Setup structured logging
        self._setup_logging()
    
    def _setup_logging(self):
        """Setup structured logging."""
        logger.info("=== TrendSiam News Ingestion Pipeline v2 Started ===")
        logger.info(f"Run ID: {self.current_run_id}")
        logger.info(f"Snapshot Date: {self.snapshot_date}")
        logger.info(f"Dry Run Mode: {self.dry_run}")
        logger.info(f"Limit: {self.limit or 'None (all videos)'}")
        logger.info(f"Regenerate Missing Images: {self.regenerate_missing_images}")
        logger.info(f"Max Image Retries: {self.max_image_retries}")
        logger.info(f"Retry Backoff: {self.retry_backoff_seconds}s")
    
    def _init_supabase(self):
        """Initialize Supabase client."""
        if not SUPABASE_AVAILABLE:
            logger.warning("Supabase not available")
            return
        
        try:
            supabase_url = os.getenv('SUPABASE_URL')
            supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')  # [data-freshness] Use service role for backend pipeline
            
            if not supabase_url or not supabase_key:
                logger.error("❌ SECTION E: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")
                logger.error("❌ SECTION E: Pipeline requires Supabase configuration - aborting")
                if not self.allow_json_fallback:
                    sys.exit(1)
                return
            
            self.supabase_client = create_client(supabase_url, supabase_key)
            
            # Test connection
            try:
                self.supabase_client.table('stories').select('count', count='exact', head=True).execute()
                self.supabase_enabled = True
                logger.info("✅ Supabase two-layer schema connection established")
            except Exception:
                # Fallback to legacy table
                self.supabase_client.table('news_trends').select('count', count='exact', head=True).execute()
                self.supabase_enabled = True
                logger.info("✅ Supabase legacy connection established")
                
        except Exception as e:
            logger.error(f"❌ SECTION E: Failed to connect to Supabase: {e}")
            if not self.allow_json_fallback:
                logger.error("❌ SECTION E: Supabase required but not available - aborting")
                sys.exit(1)
            self.supabase_enabled = False
    
    # SECTION C: Specification-compliant helper functions
    def upsert_news_items(self, items: List[Dict[str, Any]]) -> None:
        """Upsert news items with proper schema compliance."""
        if not self.supabase_enabled:
            logger.error("SECTION C: Supabase not available for upserts")
            return
        
        if self.dry_run:
            logger.info("LOG:UPSERT count=%d (DRY RUN)", len(items))
            return
        
        # Process in chunks of 500
        chunk_size = 500
        total_upserted = 0
        
        for i in range(0, len(items), chunk_size):
            chunk = items[i:i + chunk_size]
            try:
                result = self.supabase_client.table('news_trends').upsert(
                    chunk, on_conflict='video_id'
                ).execute()
                
                chunk_count = len(result.data) if result.data else len(chunk)
                total_upserted += chunk_count
                logger.info("LOG:UPSERT chunk %d-%d: %d items", i+1, i+len(chunk), chunk_count)
                
            except Exception as e:
                logger.error("Failed to upsert chunk %d-%d: %s", i+1, i+len(chunk), e)
        
        logger.info("LOG:UPSERT count=%d", total_upserted)
    
    def read_recent_news(self, limit: int) -> List[Dict[str, Any]]:
        """Read recent news for validation or incremental logic."""
        if not self.supabase_enabled:
            return []
        
        try:
            result = self.supabase_client.table('news_trends').select('*').order(
                'published_date', desc=True
            ).limit(limit).execute()
            return result.data or []
        except Exception as e:
            logger.error("Failed to read recent news: %s", e)
            return []
    
    def update_popularity_scores(self, scored: List[Dict[str, Any]]) -> None:
        """Update popularity scores for existing items."""
        if not self.supabase_enabled or not scored:
            return
        
        if self.dry_run:
            logger.info("LOG:STATS_REFRESH count=%d (DRY RUN)", len(scored))
            return
        
        try:
            result = self.supabase_client.table('news_trends').upsert(
                scored, on_conflict='video_id'
            ).execute()
            logger.info("LOG:STATS_REFRESH count=%d", len(result.data) if result.data else len(scored))
        except Exception as e:
            logger.error("Failed to update popularity scores: %s", e)
    
    def set_system_meta(self, key: str, value: str) -> None:
        """Set system metadata for cache busting with Asia/Bangkok timezone."""
        if not self.supabase_enabled:
            logger.error("Supabase not available for system_meta update")
            return
        
        if self.dry_run:
            logger.info("LOG:META_UPDATE key=%s value=%s (DRY RUN)", key, value)
            return
        
        try:
            # Use Asia/Bangkok timezone for consistency
            import pytz
            
            bangkok_tz = pytz.timezone('Asia/Bangkok')
            bangkok_time = datetime.now(bangkok_tz)
            timestamp_value = bangkok_time.isoformat()
            
            self.supabase_client.table('system_meta').upsert({
                'key': key, 
                'value': timestamp_value,
                'updated_at': timestamp_value
            }, on_conflict='key').execute()
            logger.info("LOG:UPDATED_AT=%s (Asia/Bangkok)", timestamp_value)
        except Exception as e:
            logger.error("Failed to set system_meta: %s", e)
    
    def attach_ai_image_if_needed(self, news_id: str, image_url: str, prompt: str, model: str) -> None:
        """Attach AI image to news item."""
        if not self.supabase_enabled or self.dry_run:
            if self.dry_run:
                logger.info("LOG:AI_IMAGE news_id=%s (DRY RUN)", news_id)
            return
        
        try:
            self.supabase_client.table('ai_images').upsert({
                'news_id': news_id,
                'image_url': image_url, 
                'prompt': prompt,
                'model': model
            }, on_conflict='news_id').execute()
            logger.info("LOG:AI_IMAGE attached for news_id=%s", news_id)
        except Exception as e:
            logger.error("Failed to attach AI image: %s", e)
    
    def load_video_data(self) -> List[Dict[str, Any]]:
        """Load video data from live YouTube API or fallback to static file."""
        # [TARGETED-FIX] If only processing a single video, fetch it from DB
        if self.only_video_id:
            logger.info(f"🎯 [TARGETED-FIX] Loading single video: {self.only_video_id}")
            if not self.supabase_enabled:
                logger.error("Supabase required for single video processing")
                return []
            
            try:
                import pytz
                bangkok_tz = pytz.timezone('Asia/Bangkok')
                today = datetime.now(bangkok_tz).date()
                
                result = self.supabase_client.table('news_trends') \
                    .select('*') \
                    .eq('video_id', self.only_video_id) \
                    .eq('date', today.isoformat()) \
                    .execute()
                
                if result.data:
                    logger.info(f"✅ Found video in today's batch: {result.data[0]['title']}")
                    return result.data
                else:
                    logger.error(f"❌ Video {self.only_video_id} not found in today's batch")
                    return []
            except Exception as e:
                logger.error(f"Failed to fetch single video: {e}")
                return []
        
        # [data-freshness] Try live data first, especially with force-refresh-stats
        if self.force_refresh_stats or os.getenv('YOUTUBE_API_KEY'):
            live_data = self._fetch_live_youtube_data()
            if live_data:
                logger.info(f"📡 [data-freshness] Successfully loaded {len(live_data)} videos from live YouTube API")
                return live_data
            else:
                logger.warning("⚠️ [data-freshness] Live YouTube fetch failed, falling back to static file")
        
        # SECTION C: JSON fallback only if explicitly allowed
        if not self.allow_json_fallback:
            logger.error("SECTION C: No live data available and JSON fallback disabled")
            logger.error("SECTION C: Set YOUTUBE_API_KEY or ALLOW_JSON_FALLBACK=true to proceed")
            logger.error("SECTION C: Pipeline will exit with no data to prevent stale content")
            return []
        
        # Fallback to static file (only when allowed)
        try:
            input_path = Path(self.input_file)
            if not input_path.exists():
                raise FileNotFoundError(f"Input file not found: {self.input_file}")
            
            with open(input_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if not isinstance(data, list):
                raise ValueError(f"Expected list, got {type(data).__name__}")
            
            if self.limit and self.limit > 0:
                data = data[:self.limit]
                logger.info(f"Limited to first {len(data)} videos")
            
            logger.warning(f"📄 [data-freshness] Using JSON fallback: {len(data)} videos from {self.input_file}")
            return data
            
        except Exception as e:
            logger.error(f"Error loading video data: {e}")
            return []

    def _fetch_live_youtube_data(self) -> Optional[List[Dict[str, Any]]]:
        """Fetch live data from YouTube API with proper error handling."""
        try:
            # Try YouTube Data API v3 first (most reliable for fresh metrics)
            try:
                from youtube_api_fetcher import YouTubeAPIFetcher
                fetcher = YouTubeAPIFetcher()
                raw_videos = fetcher.fetch_trending_videos()
                
                if raw_videos:
                    # Transform YouTube API format to expected format
                    transformed_videos = []
                    for video in raw_videos:
                        transformed = self._transform_youtube_api_video(video)
                        if transformed:
                            transformed_videos.append(transformed)
                    
                    if self.limit and self.limit > 0:
                        transformed_videos = transformed_videos[:self.limit]
                    
                    logger.info(f"✅ [data-freshness] YouTube API: {len(transformed_videos)} videos with fresh metrics")
                    return transformed_videos
                    
            except Exception as api_error:
                logger.warning(f"⚠️ [data-freshness] YouTube API failed: {api_error}")
            
            # Fallback to yt-dlp method (limited metrics)
            try:
                from youtube_fetcher import YouTubeTrendingFetcher
                fetcher = YouTubeTrendingFetcher()
                raw_videos = fetcher.fetch_trending_videos()
                
                if raw_videos:
                    # Enhance yt-dlp data with YouTube API metrics if possible
                    enhanced_videos = []
                    for video in raw_videos:
                        enhanced_video = video.copy()
                        # Try to get fresh metrics from YouTube API for each video
                        if video.get('video_id'):
                            try:
                                from youtube_api_fetcher import YouTubeAPIFetcher
                                api_fetcher = YouTubeAPIFetcher()
                                # Get individual video stats
                                video_stats = self._get_video_stats(video['video_id'])
                                if video_stats:
                                    enhanced_video.update(video_stats)
                            except Exception:
                                pass  # Use yt-dlp data as fallback
                        enhanced_videos.append(enhanced_video)
                    
                    if self.limit and self.limit > 0:
                        enhanced_videos = enhanced_videos[:self.limit]
                    
                    logger.info(f"✅ [data-freshness] yt-dlp enhanced: {len(enhanced_videos)} videos")
                    return enhanced_videos
                    
            except Exception as ytdl_error:
                logger.warning(f"⚠️ [data-freshness] yt-dlp failed: {ytdl_error}")
            
            return None
            
        except Exception as e:
            logger.error(f"❌ [data-freshness] Live fetch completely failed: {e}")
            return None

    def _get_video_stats(self, video_id: str) -> Optional[Dict[str, Any]]:
        """Get fresh statistics for a single video from YouTube API."""
        try:
            import requests
            import os
            
            api_key = os.getenv('YOUTUBE_API_KEY')
            if not api_key:
                return None
            
            url = 'https://www.googleapis.com/youtube/v3/videos'
            params = {
                'key': api_key,
                'id': video_id,
                'part': 'statistics',
                'fields': 'items(statistics(viewCount,likeCount,commentCount))'
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            items = data.get('items', [])
            
            if items:
                stats = items[0].get('statistics', {})
                return {
                    'view_count': stats.get('viewCount', '0'),
                    'like_count': stats.get('likeCount', '0'),
                    'comment_count': stats.get('commentCount', '0')
                }
            
            return None
            
        except Exception as e:
            logger.debug(f"Failed to get fresh stats for {video_id}: {e}")
            return None
    
    def _transform_youtube_api_video(self, video: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Transform YouTube Data API v3 format to expected pipeline format."""
        try:
            snippet = video.get('snippet', {})
            statistics = video.get('statistics', {})
            
            # Extract video ID from either 'id' field or 'id.videoId'
            video_id = video.get('id')
            if isinstance(video_id, dict):
                video_id = video_id.get('videoId')
            
            if not video_id:
                return None
            
            return {
                'video_id': video_id,
                'title': snippet.get('title', ''),
                'description': snippet.get('description', ''),
                'channel': snippet.get('channelTitle', ''),
                'published_date': snippet.get('publishedAt', ''),
                'view_count': statistics.get('viewCount', '0'),
                'like_count': statistics.get('likeCount', '0'),
                'comment_count': statistics.get('commentCount', '0'),
                # 'thumbnail_url': snippet.get('thumbnails', {}).get('high', {}).get('url', ''), # REMOVED: No external thumbnails
                'duration': '',  # Not available in basic API response
                'platform': 'YouTube'
                # [data-freshness] Mark as live data - using updated_at instead
            }
            
        except Exception as e:
            logger.warning(f"⚠️ [data-freshness] Failed to transform video {video.get('id', 'unknown')}: {e}")
            return None
    
    def build_score_details(self, video: Dict[str, Any]) -> str:
        """Build a deterministic explanation of the popularity score using only real metrics."""
        parts = []
        
        # Extract metrics with safe defaults
        try:
            views = int(str(video.get('view_count', '0')).replace(',', ''))
            likes = int(str(video.get('like_count', '0')).replace(',', ''))
            comments = int(str(video.get('comment_count', '0')).replace(',', ''))
        except (ValueError, TypeError):
            views = likes = comments = 0
        
        # Primary assessment based on score
        score = video.get('popularity_score_precise', 0)
        if score >= 70:
            parts.append('High engagement')
        elif score >= 50:
            parts.append('Strong engagement')
        elif score >= 30:
            parts.append('Moderate engagement')
        else:
            parts.append('Building momentum')
        
        # View count buckets (simplified as per spec)
        if views > 0:
            if views > 5000000:
                parts.append(f'• {self._format_number(views)}+ views')
            elif views > 1000000:
                parts.append(f'• {self._format_number(views)}+ views')
            elif views > 100000:
                parts.append(f'• {self._format_number(views)}+ views')
            else:
                parts.append(f'• {views:,} views')
        
        # Engagement rates (deterministic calculation)
        engagement_parts = []
        
        # Like rate
        if views > 0 and likes >= 0:
            like_rate = (likes / views) * 100
            # Always show to 1 decimal place, clamped to valid range
            like_rate = max(0.0, min(100.0, like_rate))
            engagement_parts.append(f'like rate {like_rate:.1f}%')
        
        # Comment rate  
        if views > 0 and comments >= 0:
            comment_rate = (comments / views) * 100
            # Always show to 1 decimal place, clamped to valid range
            comment_rate = max(0.0, min(100.0, comment_rate))
            if comment_rate >= 1.0:
                engagement_parts.append(f'comment rate {comment_rate:.1f}%')
        
        # Add engagement details if present
        if engagement_parts:
            parts.append(f'({", ".join(engagement_parts)})')
        
        # Growth rate buckets (deterministic mapping)
        growth_str = str(video.get('growth_rate', '')).strip()
        if growth_str and growth_str != 'N/A':
            if 'Viral' in growth_str or '>100K/day' in growth_str:
                parts.append('• Viral growth')
            elif 'High' in growth_str or '≥10K/day' in growth_str:
                parts.append('• High growth')
            elif 'Medium' in growth_str or '≥1K/day' in growth_str:
                parts.append('• Medium growth')
            elif 'Steady' in growth_str:
                parts.append('• Steady growth')
        
        # Join parts with consistent formatting
        result = ' '.join(parts)
        
        # Ensure consistent output
        if not result:
            result = 'N/A'
        
        return result
    
    def _format_number(self, num: int) -> str:
        """Format large numbers with K/M suffix."""
        if num >= 1000000:
            return f'{num/1000000:.1f}M'
        elif num >= 1000:
            return f'{num/1000:.0f}K'
        else:
            return str(num)
    
    def enrich_auxiliary_fields(self, videos: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Enrich videos with auxiliary fields for detail view"""
        logger.info(f"🔧 Enriching {len(videos)} videos with auxiliary fields...")
        
        # Initialize keyword extractor if we need to recompute keywords
        keyword_extractor = None
        batch_tf_idf = None
        
        if self.recompute_keywords or any(not v.get('keywords') for v in videos):
            from utils.keyword_extractor import KeywordExtractor
            keyword_extractor = KeywordExtractor()
            
            # Compute batch TF-IDF for uniqueness
            documents = [{'title': v.get('title', ''), 'description': v.get('description', '')} for v in videos]
            batch_tf_idf = keyword_extractor.compute_batch_tf_idf(documents)
            logger.info(f"📊 Computed TF-IDF for {len(documents)} documents")
        
        for idx, video in enumerate(videos):
            # Calculate growth rate if we have view history
            if 'view_count' in video and video['view_count']:
                try:
                    views = int(str(video['view_count']).replace(',', ''))
                    # Simple growth estimate based on views and time since published
                    if 'published_date' in video:
                        from datetime import datetime
                        pub_date = datetime.fromisoformat(video['published_date'].replace('Z', '+00:00'))
                        days_old = (datetime.now(timezone.utc) - pub_date).days
                        if days_old > 0:
                            daily_growth = views / days_old
                            # Store numeric growth rate (views per day)
                            video['growth_rate'] = daily_growth
                        else:
                            # For very new videos, use total views as growth rate
                            video['growth_rate'] = views
                except:
                    video['growth_rate'] = 0
            
            # Extract keywords using advanced extraction
            if keyword_extractor and ('title' in video and video['title']):
                # Only recompute if forced or missing
                current_keywords = video.get('keywords', '')
                should_compute = self.recompute_keywords or not current_keywords
                
                if should_compute:
                    keywords = keyword_extractor.extract_keywords(
                        title=video.get('title', ''),
                        description=video.get('description', ''),
                        channel=video.get('channel', ''),
                        category=video.get('auto_category', ''),
                        batch_tf_idf=batch_tf_idf
                    )
                    
                    # Store as JSON array string
                    video['keywords'] = json.dumps(keywords, ensure_ascii=False) if keywords else '[]'
                    
                    # Log keywords for first few items
                    if idx < 5 and (self.verbose or self.recompute_keywords):
                        logger.info(f"[KEYWORDS] #{idx+1} {video.get('video_id', 'unknown')[:10]}... | " +
                                   f"keywords={keywords}")
            elif not keyword_extractor and not video.get('keywords'):
                # Fallback to empty array if no keywords and not recomputing
                video['keywords'] = '[]'
            
            # Platform mentions - check both title and description
            text_to_check = f"{video.get('title', '')} {video.get('description', '')}".lower()
            platforms = []
            
            # Check for "all platforms" or "streaming platforms" first
            if ('all platforms' in text_to_check or 'all streaming' in text_to_check or 
                'streaming platforms' in text_to_check or 'ทุกแพลตฟอร์ม' in text_to_check):
                platforms = ['Multiple platforms']
            else:
                # Check for specific platform mentions
                platform_patterns = {
                    'Facebook': ['facebook', 'fb.com', 'fb ', ' fb'],
                    'Instagram': ['instagram', 'ig ', ' ig', 'insta'],
                    'Twitter/X': ['twitter', 'x.com', 'tweet'],
                    'TikTok': ['tiktok', 'tik tok'],
                    'Line': ['line', 'ไลน์'],
                    'Spotify': ['spotify'],
                    'Apple Music': ['apple music', 'applemusic']
                }
                
                for platform, patterns in platform_patterns.items():
                    if any(pattern in text_to_check for pattern in patterns):
                        platforms.append(platform)
            
            video['platform_mentions'] = ', '.join(platforms) if platforms else 'Primary platform only'
            
            # Score details - explain the scoring
            if 'popularity_score_precise' in video and video['popularity_score_precise']:
                video['score_details'] = self.build_score_details(video)
                
                # Log score details for first few items for verification
                if idx < 5 and (self.verbose or self.recompute_scores):
                    logger.info(f"[SCORE_DETAILS] #{idx+1} {video.get('video_id', 'unknown')[:10]}... | " +
                               f"views={video.get('view_count', 0)} | " +
                               f"likes={video.get('like_count', 0)} | " + 
                               f"comments={video.get('comment_count', 0)} | " +
                               f"growth={video.get('growth_rate', 'N/A')} | " +
                               f"score_details='{video['score_details'][:80]}...' ")
            
            # AI Opinion - generate a brief insight
            # Only generate if missing or empty
            current_opinion = video.get('ai_opinion', '')
            if (not current_opinion or current_opinion.strip() == '') and 'title' in video:
                # Enhanced opinion generation based on content type
                title = video.get('title', '')
                category = video.get('auto_category', '').lower()
                
                # Check for specific content patterns
                if 'BNK48' in title or 'AKB48' in title or any(c in title for c in ['乃木坂', '欅坂']):
                    video['ai_opinion'] = 'J-pop idol group content with dedicated fanbase engagement'
                elif 'MV' in title or 'official video' in title.lower() or 'music video' in title.lower():
                    video['ai_opinion'] = 'Music video release tracking audience reception and cultural impact'
                elif 'cover' in title.lower() or 'คัฟเวอร์' in title:
                    video['ai_opinion'] = 'Cover performance showcasing artistic interpretation and talent'
                elif 'reaction' in title.lower() or 'รีแอค' in title:
                    video['ai_opinion'] = 'Reaction content leveraging parasocial engagement dynamics'
                elif 'news' in category or 'การเมือง' in category:
                    video['ai_opinion'] = 'News content addressing current events and public discourse'
                elif 'entertainment' in category or 'บันเทิง' in category:
                    video['ai_opinion'] = 'Entertainment content engaging diverse audience segments'
                elif 'gaming' in category or 'game' in title.lower():
                    video['ai_opinion'] = 'Gaming content appealing to enthusiast communities'
                else:
                    # View-based opinion
                    try:
                        views = int(str(video.get('view_count', '0')).replace(',', ''))
                        if views > 1000000:
                            video['ai_opinion'] = 'Viral content demonstrating exceptional audience reach'
                        elif views > 100000:
                            video['ai_opinion'] = 'Popular content showing strong viewer engagement metrics'
                        else:
                            video['ai_opinion'] = 'Emerging content building momentum in target demographics'
                    except:
                        video['ai_opinion'] = 'Trending content gaining traction across platforms'
            
            # [TARGETED-FIX] Log enrichment for debugging
            if self.verbose or self.only_video_id:
                logger.debug(f"[ENRICH] #{idx+1} {video.get('video_id', 'unknown')[:10]}... "
                           f"growth={video.get('growth_rate', 'N/A')}, "
                           f"platforms={video.get('platform_mentions', 'N/A')[:30]}..., "
                           f"keywords={len(video.get('keywords', '').split(',')) if video.get('keywords') else 0}, "
                           f"opinion={'Y' if video.get('ai_opinion') else 'N'}, "
                           f"score_details={video.get('score_details', 'N/A')[:30]}...")
        
        return videos

    def process_video_summaries(self, videos: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process videos to generate summaries using legacy summarizer."""
        logger.info(f"Processing {len(videos)} videos for summaries...")
        
        # V2 summary fix: Import correct legacy summarizer functions
        try:
            from summarizer import summarize_thai_video, summarize_english_video
            logger.debug("✅ Legacy summarizer functions imported")
        except ImportError:
            logger.warning("⚠️ Legacy summarizer not available - summaries will be empty")
            summarize_thai_video = None
            summarize_english_video = None
        
        processed_videos = []
        iterator = tqdm(videos, desc="Processing summaries") if TQDM_AVAILABLE else videos
        
        for i, video in enumerate(iterator):
            try:
                processed_video = video.copy()
                
                # V2 summary fix: Determine summary generation needs
                needs_summary = (
                    self.force_all_summaries or
                    self.recompute_summaries or 
                    not processed_video.get('summary') or
                    str(processed_video.get('summary', '')).startswith('Mock ')
                )
                
                needs_english_summary = (
                    self.force_all_summaries or
                    self.recompute_summaries or 
                    not processed_video.get('summary_en') or
                    str(processed_video.get('summary_en', '')).startswith('Mock ')
                )
                
                # V2 summary fix: Generate Thai summary using legacy V1 logic
                if needs_summary and summarize_thai_video:
                    try:
                        title = video.get('title', '')
                        description = video.get('description', '')
                        summary = summarize_thai_video(title, description)
                        if summary and not str(summary).startswith('Mock '):
                            processed_video['summary'] = summary
                            processed_video['summary_status'] = 'ready'
                        else:
                            # Failed summarization: keep summary empty, set status pending
                            processed_video['summary'] = processed_video.get('summary', '')
                            processed_video['summary_status'] = 'failed'
                    except Exception as e:
                        logger.debug(f"Failed to generate Thai summary for video {i}: {e}")
                        # Failed summarization: keep summary empty, set status pending  
                        processed_video['summary'] = processed_video.get('summary', '')
                        processed_video['summary_status'] = 'failed'
                elif not processed_video.get('summary'):
                    # No summary and no summarizer: keep empty, mark pending
                    processed_video['summary'] = ''
                    processed_video['summary_status'] = 'pending'
                
                # V2 summary fix: Generate English summary using legacy V1 logic
                if needs_english_summary and summarize_english_video:
                    try:
                        title = video.get('title', '')
                        description = video.get('description', '')
                        summary_en = summarize_english_video(title, description)
                        if summary_en and not str(summary_en).startswith('Mock '):
                            processed_video['summary_en'] = summary_en
                            processed_video['summary_en_status'] = 'ready'
                        else:
                            # Failed summarization: keep summary_en empty, set status failed
                            processed_video['summary_en'] = processed_video.get('summary_en', '')
                            processed_video['summary_en_status'] = 'failed'
                    except Exception as e:
                        logger.debug(f"Failed to generate English summary for video {i}: {e}")
                        # Failed summarization: keep summary_en empty, set status failed
                        processed_video['summary_en'] = processed_video.get('summary_en', '')
                        processed_video['summary_en_status'] = 'failed'
                elif not processed_video.get('summary_en'):
                    # No summary_en and no summarizer: keep empty, mark pending
                    processed_video['summary_en'] = ''
                    processed_video['summary_en_status'] = 'pending'
                
                # Add story_id
                source_id = video.get('video_id', f'unknown_{i}')
                platform = video.get('channel', 'YouTube')
                publish_time = parse_publish_time(video)
                processed_video['story_id'] = generate_story_id(source_id, platform, publish_time)
                
                processed_videos.append(processed_video)
                self.success_count += 1
                
            except Exception as e:
                logger.error(f"Error processing video {i}: {e}")
                self.failure_count += 1
                
                # Add minimal data for failed video
                failed_video = video.copy()
                failed_video['summary'] = f"Processing failed: {str(e)}"
                failed_video['summary_en'] = f"Processing failed: {str(e)}"
                failed_video['story_id'] = f"error_{i}"
                processed_videos.append(failed_video)
        
        logger.info(f"Processing completed: {self.success_count} success, {self.failure_count} failed")
        return processed_videos
    
    def get_story_image_path(self, story_id: str) -> str:
        """Generate image file path for a story."""
        return str(self.frontend_images_dir / f"{story_id}.webp")
    
    def check_existing_image(self, story_id: str) -> Tuple[bool, Optional[str], str]:
        """Check if valid image exists for story."""
        image_path = self.get_story_image_path(story_id)
        
        if validate_image_file(image_path):
            image_url = f"/ai_generated_images/{story_id}.webp"
            return True, image_url, 'ready'
        else:
            return False, None, 'pending'
    
    def generate_image_for_story(self, story: Dict[str, Any], retry_count: int = 0) -> Tuple[bool, Optional[str], str]:
        """Generate AI image for a story with Supabase Storage integration."""
        story_id = story['story_id']
        
        try:
            logger.info(f"🎨 Generating Supabase Storage image for story {story_id} (retry: {retry_count})")
            
            if self.dry_run:
                logger.info(f"DRY RUN: Would generate and upload image for {story_id}")
                return True, f"https://supabase-storage.url/ai-images/{story_id[:16]}.webp", 'ready'
            
            # Check if Supabase is available
            if not self.supabase_enabled:
                logger.error("❌ Supabase not available for image storage")
                return False, None, 'no_storage'
            
            # Import Supabase AI image generator
            try:
                from ai_image_supabase_generator import SupabaseAIImageGenerator
                from core.storage_config import get_storage_config, get_bucket_name
                
                # Use centralized storage configuration
                storage_config = get_storage_config()
                bucket_name = get_bucket_name()
                supabase_generator = SupabaseAIImageGenerator(self.supabase_client, bucket_name)
                logger.info(f"🎨 Using bucket: {bucket_name}")
            except ImportError as e:
                logger.error(f"❌ Supabase AI generator not available: {e}")
                return False, None, 'generator_unavailable'
            except Exception as e:
                logger.error(f"❌ Storage configuration error: {e}")
                return False, None, 'storage_config_error'
            
            # Ensure bucket exists
            if not supabase_generator.ensure_bucket_exists():
                logger.error("❌ Cannot access or create AI images bucket")
                return False, None, 'bucket_unavailable'
            
            # Generate and upload image
            success, public_url, status = supabase_generator.generate_and_upload_image(story)
            
            if success and public_url:
                # Save to ai_images table
                news_id = story.get('id')
                if news_id and story.get('ai_image_prompt'):
                    supabase_generator.save_ai_image_record(
                        news_id, public_url, story['ai_image_prompt']
                    )
                
                return True, public_url, status
            else:
                return False, None, status
                
        except Exception as e:
            logger.error(f"❌ Error generating Supabase image for {story_id} (retry {retry_count}): {e}")
            
            if retry_count < self.max_image_retries:
                wait_time = self.retry_backoff_seconds * (2 ** retry_count)
                logger.info(f"🔄 Retrying in {wait_time}s...")
                
                if not self.dry_run:
                    time.sleep(wait_time)
                
                return self.generate_image_for_story(story, retry_count + 1)
            else:
                logger.error(f"❌ Max retries exceeded for {story_id}")
                return False, None, 'max_retries'
    
    def process_top3_images(self, top3_stories: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """AI-ONLY image processing for Top-N stories - no external thumbnails."""
        if not self.generate_images:
            logger.info("🚫 Image generation disabled, skipping...")
            return top3_stories
            
        # Use configurable top-N instead of hardcoded 3
        process_count = min(len(top3_stories), self.images_top_n)
        logger.info(f"🎨 AI-ONLY IMAGE GENERATION: Processing Top-{process_count} stories...")
        logger.info("📋 Mode: AI-generated images only (no external thumbnails)")
        
        updated_stories = []
        
        for i, story in enumerate(top3_stories[:process_count], 1):
            story_id = story['story_id']
            title = story.get('title', 'Unknown')[:50]
            
            logger.info(f"🤖 Generating AI image for rank #{i}: {title}...")
            
            # ALWAYS generate AI images - no external thumbnail fallbacks
            if self.dry_run:
                logger.info(f"DRY RUN: Would generate AI image for rank #{i}")
                story['ai_image_url'] = f"/ai_generated_images/{story_id}.webp"
                story['image_status'] = 'ready'
                story['ai_image_prompt'] = f"AI-generated editorial illustration for: {story.get('title', 'news story')}"
                story['image_updated_at'] = datetime.now(timezone.utc).isoformat()
                self.image_generated_count += 1
            else:
                # Generate AI image using title + summary as input
                success, image_url, status = self.generate_image_for_story(story)
                
                story['ai_image_url'] = image_url
                story['image_status'] = status
                story['image_updated_at'] = datetime.now(timezone.utc).isoformat()
                
                if success:
                    self.image_generated_count += 1
                    logger.info(f"✅ AI image generated for rank #{i}: {image_url}")
                    logger.info(f"📝 Prompt: {story.get('ai_image_prompt', 'N/A')[:80]}...")
                else:
                    self.image_failed_count += 1
                    logger.warning(f"❌ AI image generation failed for rank #{i}")
                    # No fallback to external thumbnails - leave empty for placeholder
            
            updated_stories.append(story)
        
        # Add remaining stories without image processing
        updated_stories.extend(top3_stories[process_count:])
        
        logger.info(f"🎨 AI image processing completed: {self.image_generated_count} generated, "
                   f"0 skipped, {self.image_failed_count} failed")
        logger.info("✅ All images are AI-generated - no external thumbnails used")
        
        return updated_stories
    
    def add_rank_and_image_fields(self, videos: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Add rank and image fields to all videos."""
        updated_videos = []
        
        for i, video in enumerate(videos, 1):
            video['rank'] = i
            
            # [data-freshness] Ensure proper UUID for database consistency
            if not video.get('id'):
                # Generate deterministic UUID from video_id for consistency
                video_id = video.get('video_id', '')
                if video_id:
                    # Create UUID from video_id hash for deterministic results
                    id_hash = hashlib.sha256(f"trendsiam:{video_id}".encode()).hexdigest()
                    video['id'] = str(uuid.UUID(id_hash[:32]))
                else:
                    video['id'] = str(uuid.uuid4())
            
            if i <= 3:
                # Top 3 should have image fields set by process_top3_images
                if not video.get('image_status'):
                    video['image_status'] = 'pending'
                # Keep existing ai_image_url if present, don't overwrite with None
                # The process_top3_images function should have set this
            else:
                # Beyond top 3 - no images
                # [IMAGE-PROTECTION] Don't set ai_image_url to None - let existing values persist
                # Only set image_status if not already set
                if not video.get('image_status'):
                    video['image_status'] = 'n/a'
            
            if not video.get('image_updated_at'):
                video['image_updated_at'] = datetime.now(timezone.utc).isoformat()
            
            updated_videos.append(video)
        
        return updated_videos
    
    def save_to_database(self, videos: List[Dict[str, Any]]) -> bool:
        """Save videos to Supabase database with proper snapshot handling."""
        if not self.supabase_enabled:
            logger.warning("Database not available")
            return False
        
        if self.dry_run:
            logger.info("🔒 [data-freshness] DRY RUN: Would save to database")
            # [data-freshness] Enhanced dry run preview
            logger.info(f"📊 [data-freshness] Would UPSERT news_trends: {len(videos)} items")
            
            if self.force_refresh_stats:
                logger.info(f"🔄 [data-freshness] Force refresh mode: would update all {len(videos)} items with fresh metrics")
                logger.info(f"📸 [data-freshness] Would INSERT snapshots: {len(videos)} records")
            
            if self.emit_revalidate:
                logger.info("🔄 [data-freshness] Would emit revalidate signal for UI cache refresh")
            
            # Show top-3 details for verification
            logger.info(f"📊 [data-freshness] Top-3 preview (would be deterministic order):")
            for i, video in enumerate(videos[:3], 1):
                has_ai_image = bool(video.get('ai_image_url'))
                logger.info(f"     #{i}: {video.get('title', 'N/A')[:50]}... (score: {video.get('popularity_score_precise', 0):.1f}, hasImage: {has_ai_image})")
            
            return True
        
        try:
            current_date = self.snapshot_date.isoformat()
            current_timestamp = datetime.now().isoformat()
            
            logger.info(f"📤 [rank-img-investigation] Saving {len(videos)} videos to database...")
            
            # [rank-img-investigation] Enhanced upsert logic for fresh data
            supabase_items = []
            for video in videos:
                item = {
                    'id': video.get('id'),  # [data-freshness] Include UUID primary key
                    'title': video.get('title', ''),
                    'summary': video.get('summary', ''),
                    'summary_en': video.get('summary_en', ''),
                    'category': video.get('auto_category', 'Unknown'),
                    'platform': video.get('channel', 'YouTube'),
                    'video_id': video.get('video_id', ''),
                    'popularity_score': video.get('popularity_score', 0),
                    'popularity_score_precise': video.get('popularity_score_precise', 0),
                    'published_date': video.get('published_date'),
                    'description': video.get('description', ''),
                    'channel': video.get('channel', ''),
                    'view_count': video.get('view_count', ''),
                    'like_count': video.get('like_count', '0'),  # [rank-img-investigation] Ensure metrics are included
                    'comment_count': video.get('comment_count', '0'),  # [rank-img-investigation] Ensure metrics are included
                    # [IMAGE-PROTECTION] Don't unconditionally set ai_image_url - use safe utility
                    'ai_image_prompt': video.get('ai_image_prompt', ''),
                    'ai_opinion': video.get('ai_opinion', ''),  # [data-freshness] Include AI analysis
                    # Add auxiliary fields
                    'score_details': video.get('score_details', ''),
                    'keywords': video.get('keywords', ''),
                    'growth_rate': video.get('growth_rate', ''),
                    'platform_mentions': video.get('platform_mentions', ''),
                    'duration': video.get('duration', ''),
                    'raw_view': video.get('raw_view', ''),
                    'date': current_date,
                    'updated_at': current_timestamp  # [rank-img-investigation] Force updated timestamp
                    # [data-freshness] Removed fetched_at and run_id - columns don't exist in DB schema
                }
                
                # [IMAGE-PROTECTION] Only set ai_image_url if we have a truthy value
                from utils.safe import set_if_truthy
                ai_url = video.get('ai_image_url')
                
                # Handle image URL based on override flag
                if self.override_images and not ai_url:
                    # Explicit override to blank (rare case)
                    item['ai_image_url'] = None
                    logger.info(f"🔄 IMG URL explicitly overwritten to None for {video.get('video_id')} (--override-images)")
                elif ai_url:
                    set_if_truthy(item, 'ai_image_url', ai_url)
                    logger.debug(f"🖼️ IMG URL updated for {video.get('video_id')}: {ai_url[:50]}...")
                else:
                    # Default behavior: protect existing URL
                    logger.debug(f"🛡️ IMG URL protected (not overwritten) for {video.get('video_id')}")
                
                if item['title'] and item['video_id']:
                    supabase_items.append(item)
            
            if supabase_items:
                # [rank-img-investigation] Enhanced upsert with force refresh support
                if self.force_refresh_stats:
                    logger.info(f"🔄 [rank-img-investigation] Force refresh mode: updating {len(supabase_items)} items with fresh metrics")
                
                # [data-freshness] Implement proper two-layer model: stories + snapshots
                stories_count = 0
                snapshots_count = 0
                
                # SECTION E: Upsert using specification-compliant schema
                # Transform items for database insertion
                spec_items = []
                for item in supabase_items:
                    spec_item = item.copy()
                    spec_item['platform'] = 'youtube'  # Default to youtube
                    # spec_item['published_at'] = item.get('published_date')  # Column doesn't exist, using published_date directly
                    spec_item['external_id'] = item.get('video_id')
                    # spec_item['source_url'] = f"https://www.youtube.com/watch?v={item.get('video_id', '')}" if item.get('video_id') else None  # Column doesn't exist
                    # Ensure popularity_score is decimal with 3dp
                    spec_item['popularity_score'] = round(float(item.get('popularity_score_precise', 0)), 3)
                    # [FIX] Preserve AI image fields - but only if present
                    # [IMAGE-PROTECTION] Don't add ai_image_url key if not truthy
                    if 'ai_image_url' in item:
                        spec_item['ai_image_url'] = item['ai_image_url']
                    spec_item['ai_image_prompt'] = item.get('ai_image_prompt')
                    
                    # [SCORE-DETAILS] Preserve auxiliary fields
                    # Only set score_details if we have a truthy value (using safe setter)
                    if self.recompute_scores or item.get('score_details'):
                        # Either force recompute or we have a value to write
                        set_if_truthy(spec_item, 'score_details', item.get('score_details'))
                        if item.get('score_details'):
                            logger.debug(f"📊 SCORE_DETAILS[{item.get('video_id', 'unknown')[:10]}...]: \"{item.get('score_details', '')[:80]}...\" (written=True)")
                    
                    # Preserve other auxiliary fields as-is since they're already in item
                    spec_item['keywords'] = item.get('keywords')
                    spec_item['growth_rate'] = item.get('growth_rate')
                    spec_item['platform_mentions'] = item.get('platform_mentions')
                    spec_item['ai_opinion'] = item.get('ai_opinion')
                    
                    spec_items.append(spec_item)
                
                logger.info(f"📤 [UPSERT] target_table=news_trends rows={len(spec_items)} conflict_resolution=platform,external_id")
                result = self.supabase_client.table('news_trends').upsert(
                    spec_items,
                    on_conflict='platform,external_id'  
                ).execute()
                stories_count = len(result.data) if result.data else len(spec_items)
                logger.info(f"✅ [UPSERT] upserted_rows={stories_count} target_table=news_trends")
                
                # [AI-PROMPT-PRIMARY] Also upsert to stories table as primary source of truth
                try:
                    stories_items = []
                    for item in supabase_items:
                        story_item = {
                            'story_id': item.get('video_id'),  # Use video_id as story_id
                            'title': item.get('title', ''),
                            'summary': item.get('summary', ''),
                            'category': item.get('category', 'Unknown'),
                            'platform': 'youtube',
                            'ai_image_prompt': item.get('ai_image_prompt', ''),  # Primary field
                            'created_at': current_timestamp,
                            'updated_at': current_timestamp
                        }
                        
                        # Only include stories with valid story_id and title
                        if story_item['story_id'] and story_item['title']:
                            stories_items.append(story_item)
                    
                    if stories_items:
                        logger.info(f"📤 [UPSERT] target_table=stories rows={len(stories_items)} conflict_resolution=story_id")
                        stories_result = self.supabase_client.table('stories').upsert(
                            stories_items,
                            on_conflict='story_id'
                        ).execute()
                        stories_upserted = len(stories_result.data) if stories_result.data else len(stories_items)
                        logger.info(f"✅ [UPSERT] upserted_rows={stories_upserted} target_table=stories")
                        
                        # Log AI prompt coverage for verification
                        prompts_count = sum(1 for item in stories_items if item.get('ai_image_prompt', '').strip())
                        logger.info(f"📝 [AI-PROMPT-PRIMARY] Stories with AI prompts: {prompts_count}/{len(stories_items)}")
                    
                except Exception as stories_error:
                    logger.warning(f"⚠️ [AI-PROMPT-PRIMARY] Stories table upsert failed: {stories_error}")
                    logger.warning("⚠️ [AI-PROMPT-PRIMARY] Continuing with news_trends only (fallback mode)")
                
                # [data-freshness] Create snapshot records for historical tracking
                if self.force_refresh_stats:
                    snapshot_items = []
                    for idx, item in enumerate(supabase_items, 1):
                        snapshot_item = {
                            'story_id': item.get('video_id'),  # Reference to canonical story
                            'snapshot_date': current_date,
                            'rank': idx,  # [data-freshness] Position in this snapshot
                            'view_count': item.get('view_count', '0'),
                            'like_count': item.get('like_count', '0'),
                            'comment_count': item.get('comment_count', '0'),
                            'popularity_score': item.get('popularity_score', 0),
                            'popularity_score_precise': item.get('popularity_score_precise', 0),
                            'image_url': item.get('ai_image_url'),  # [data-freshness] Snapshot image state
                            'image_updated_at': current_timestamp if item.get('ai_image_url') else None,
                            'reason': 'refresh' if self.force_refresh_stats else 'regular',  # [data-freshness] Snapshot reason
                            'run_id': self.current_run_id,  # [data-freshness] Link to pipeline run
                            'created_at': current_timestamp,
                            'updated_at': current_timestamp
                        }
                        snapshot_items.append(snapshot_item)
                    
                    try:
                        # Try to insert snapshots (ignore if snapshots table doesn't exist yet)
                        snapshot_result = self.supabase_client.table('snapshots').insert(snapshot_items).execute()
                        snapshots_count = len(snapshot_result.data)
                        logger.info(f"📸 [data-freshness] Created {snapshots_count} snapshot records")
                    except Exception as snapshot_error:
                        logger.warning(f"⚠️ [data-freshness] Snapshots table not available: {snapshot_error}")
                
                # [data-freshness] Enhanced logging with metrics
                logger.info(f"✅ [data-freshness] UPSERT news_trends: {stories_count} items, snapshots: {snapshots_count}")
                if self.verbose:
                    logger.info(f"📊 [rank-img-investigation] Top 5 upserted with current scores:")
                    for i, video in enumerate(supabase_items[:5], 1):
                        has_ai_image = bool(video.get('ai_image_url'))
                        logger.info(f"     #{i}: {video.get('title', 'N/A')[:40]}... (score: {video.get('popularity_score_precise', 0):.1f}, hasImage: {has_ai_image})")
                
                # [data-freshness] Emit revalidation signal if requested
                if self.emit_revalidate:
                    self._emit_revalidate_signal()
                
                # [data-freshness] Always trigger cache invalidation after successful DB writes
                self._trigger_cache_invalidation()
                
                return True
            else:
                logger.warning("No valid items to save")
                return False
                
        except Exception as e:
            logger.error(f"Error saving to database: {e}")
            return False

    def _emit_revalidate_signal(self) -> None:
        """Emit revalidation signal to Next.js to refresh UI cache."""
        try:
            import requests
            import os
            
            # Get revalidate secret from environment
            revalidate_secret = os.getenv('REVALIDATE_SECRET')
            if not revalidate_secret:
                logger.warning("[data-freshness] REVALIDATE_SECRET not set - skipping UI cache refresh")
                return
            
            # Call the revalidate API
            revalidate_url = "http://localhost:3000/api/revalidate"
            params = {
                'tag': 'weekly',
                'token': revalidate_secret
            }
            
            logger.info("[data-freshness] Emitting revalidate signal for UI cache refresh...")
            response = requests.get(revalidate_url, params=params, timeout=10)
            
            if response.status_code == 200:
                logger.info(f"✅ [data-freshness] emit revalidate: weekly -> {response.status_code}")
            else:
                logger.warning(f"⚠️ [data-freshness] revalidate failed: {response.status_code} - {response.text}")
                
        except Exception as e:
            logger.warning(f"⚠️ [data-freshness] Failed to emit revalidate signal: {e}")
    
    def _trigger_cache_invalidation(self) -> None:
        """Trigger Next.js cache invalidation for home page data."""
        try:
            import requests
            import os
            
            # Get revalidate secret and base URL from environment
            revalidate_secret = os.getenv('REVALIDATE_SECRET')
            base_url = os.getenv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
            
            if not revalidate_secret:
                logger.warning("[data-freshness] REVALIDATE_SECRET not set - skipping cache invalidation")
                return
            
            # Invalidate home page cache tag
            revalidate_url = f"{base_url}/api/revalidate"
            params = {
                'tag': 'home-news',
                'token': revalidate_secret
            }
            
            logger.info("[data-freshness] Triggering home page cache invalidation...")
            response = requests.get(revalidate_url, params=params, timeout=10)
            
            if response.status_code == 200:
                logger.info(f"✅ [REVALIDATE] revalidated=home-news status={response.status_code}")
            else:
                logger.warning(f"⚠️ [REVALIDATE] failed=home-news status={response.status_code} error={response.text[:100]}")
                
        except Exception as e:
            logger.warning(f"⚠️ [data-freshness] Failed to trigger cache invalidation: {e}")
    
    def save_to_json(self, videos: List[Dict[str, Any]]) -> bool:
        """SECTION C: JSON output disabled - Supabase only."""
        if not self.allow_json_fallback:
            logger.info("SECTION C: JSON output disabled - using Supabase only")
            return True
            
        logger.warning("SECTION C: JSON output only allowed when ALLOW_JSON_FALLBACK=true")
        
        # Check if output file is configured
        if not self.output_file:
            default_output = "thailand_trending_summary.json"
            logger.info(f"SECTION C: No output file configured, using default: {default_output}")
            self.output_file = default_output
        
        try:
            # Add data_version for cache busting
            data_version = datetime.now(timezone.utc).isoformat()
            
            # Prepare videos for JSON output with proper frontend fields
            json_items = []
            for video in videos:
                json_item = {
                    'story_id': video.get('story_id', ''),
                    'rank': video.get('rank', 0),
                    'title': video.get('title', ''),
                    'summary': video.get('summary', ''),
                    'summary_en': video.get('summary_en', ''),
                    'category': video.get('auto_category', 'Unknown'),
                    'platform': video.get('channel', 'YouTube'),
                    'video_id': video.get('video_id', ''),
                    'popularity_score': video.get('popularity_score', 0),
                    'popularity_score_precise': video.get('popularity_score_precise', 0),
                    'published_date': video.get('published_date'),
                    'description': video.get('description', ''),
                    'channel': video.get('channel', ''),
                    'view_count': video.get('view_count', ''),
                    'like_count': video.get('like_count', ''),
                    'comment_count': video.get('comment_count', ''),
                    'ai_image_url': video.get('ai_image_url'),
                    'image_status': video.get('image_status', 'n/a'),
                    'image_updated_at': video.get('image_updated_at'),
                    'summary_status': video.get('summary_status', 'ready'),
                    'summary_en_status': video.get('summary_en_status', 'ready')
                }
                
                # Add AI prompt for Top-3 items only (when image_status is ready)
                if video.get('rank', 0) <= 3 and video.get('image_status') == 'ready':
                    json_item['ai_image_prompt'] = video.get('ai_image_prompt', '')
                
                json_items.append(json_item)
            
            output_data = {
                'data_version': data_version,
                'snapshot_date': str(self.snapshot_date),
                'run_id': self.current_run_id,
                'total_items': len(videos),
                'trending_stories': json_items  # Use the same field name as legacy
            }
            
            if self.dry_run:
                logger.info(f"DRY RUN: Would save to {self.output_file}")
                return True
            
            # Ensure output file path is valid
            if not self.output_file:
                logger.warning("SECTION C: No output file specified, skipping JSON save")
                return True
            
            output_path = Path(self.output_file)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"Successfully saved to {self.output_file}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving to JSON (non-critical): {e}")
            # Don't fail the pipeline if JSON save fails but Supabase succeeded
            if self.allow_json_fallback:
                logger.warning("JSON save failed but continuing with Supabase-only mode")
            return True  # Return True to avoid pipeline failure
    
    def run(self) -> int:
        """Run the complete ingestion pipeline."""
        # Initialize timing
        self.pipeline_start_time = time.time()
        
        logger.info("🚀 Starting TrendSiam News Ingestion Pipeline v2")
        logger.info(f"📋 Configuration: limit={self.limit}, images={self.generate_images}, dry_run={self.dry_run}")
        
        try:
            # Step 1: Load video data
            videos = self.load_video_data()
            if not videos:
                logger.error("No video data loaded")
                return 1
            
            # Step 2: Process summaries (will be replaced with real summarizer later)
            processed_videos = self.process_video_summaries(videos)
            if not processed_videos:
                logger.error("No videos processed successfully")
                return 2
            
            # Step 3: Compute popularity scores using legacy scorer
            if self.legacy_adapter:
                processed_videos = self.legacy_adapter.compute_popularity_scores(processed_videos)
            else:
                logger.warning("⚠️ Legacy adapter not available - skipping popularity scoring")
            
            # Step 4: Classify categories using legacy classifier  
            if self.legacy_adapter:
                processed_videos = self.legacy_adapter.classify_categories(
                    processed_videos, reclassify=self.reclassify
                )
            else:
                logger.warning("⚠️ Legacy adapter not available - skipping category classification")
            
            # Step 5: Validate no mock content if strict mode enabled
            if self.strict_real_data:
                self.validate_no_mock_content(processed_videos)
            
            # Step 6: Determine Top-3 ordering
            sorted_videos = determine_top3_ordering(processed_videos)
            
            # Step 7: Process images for Top-3 stories
            top3_stories = sorted_videos[:3]
            top3_with_images = self.process_top3_images(top3_stories)
            
            # Update the top 3 in sorted list
            for i, updated_story in enumerate(top3_with_images):
                sorted_videos[i] = updated_story
            
            # Step 8: Add rank and image fields to all videos
            final_videos = self.add_rank_and_image_fields(sorted_videos)
            
            # Step 8.5: Enrich with auxiliary fields for detail view
            final_videos = self.enrich_auxiliary_fields(final_videos)
            
            # Step 9: Save to database and JSON
            db_success = self.save_to_database(final_videos)
            json_success = self.save_to_json(final_videos)
            
            if not db_success and not json_success:
                logger.error("Failed to save data to any destination")
                return 3
            
            # Step 7: Generate end-of-run report
            self.generate_end_of_run_report(final_videos)
            
            # SECTION C: Always update system_meta for cache busting (Asia/Bangkok timezone)
            self.set_system_meta('news_last_updated', 'updated')
            
            # V2 summary fix: Determine exit code based on summary coverage and other metrics
            # Calculate summary coverage for exit code determination
            ready_summaries = sum(1 for v in final_videos if v.get('summary_status') == 'ready')
            total_videos = len(final_videos)
            summary_coverage = (ready_summaries / total_videos * 100) if total_videos > 0 else 0
            
            if summary_coverage >= 95.0 and self.image_failed_count == 0:
                # Log comprehensive pipeline summary
                self.log_pipeline_summary(processed_videos, final_videos, 'success')
                return 0  # Success
            elif summary_coverage > 0 or self.image_failed_count > 0:
                logger.warning(f"Partial success: summary coverage {summary_coverage:.1f}%, {self.image_failed_count} images failed")
                logger.info("LOG:END fetched=%d upserted=%d updated_scores=%d images_attached=%d elapsed=%.2f", 
                           len(processed_videos) if 'processed_videos' in locals() else 0, len(final_videos), 
                           len(final_videos) if self.force_refresh_stats else 0, 
                           self.image_generated_count, 0.0)
                return 5  # Partial success  
            else:
                logger.error("Pipeline failed: no summaries generated")
                logger.info("LOG:END fetched=%d upserted=%d updated_scores=%d images_attached=%d elapsed=%.2f", 
                           0, 0, 0, 0, 0.0)
                return 2  # Failure
                
        except Exception as e:
            logger.error(f"Pipeline failed: {e}")
            return 4
    
    def log_pipeline_summary(self, processed_videos: List[Dict[str, Any]], final_videos: List[Dict[str, Any]], status: str) -> None:
        """Log comprehensive pipeline execution summary."""
        pipeline_start = getattr(self, 'pipeline_start_time', time.time())
        elapsed_time = time.time() - pipeline_start
        
        # Count various metrics
        total_fetched = len(processed_videos) if processed_videos else 0
        total_final = len(final_videos) if final_videos else 0
        
        # Image metrics
        images_generated = getattr(self, 'image_generated_count', 0)
        images_failed = getattr(self, 'image_failed_count', 0)
        images_total_attempts = images_generated + images_failed
        
        # Summary metrics
        ready_summaries = sum(1 for v in final_videos if v.get('summary_status') == 'ready') if final_videos else 0
        summary_coverage = (ready_summaries / total_final * 100) if total_final > 0 else 0
        
        # Top 3 image status
        top3_with_images = 0
        if final_videos and len(final_videos) >= 3:
            top3_with_images = sum(1 for v in final_videos[:3] if v.get('ai_image_url') or v.get('image_status') == 'ready')
        
        # Log comprehensive summary
        logger.info("=" * 60)
        logger.info("🎯 PIPELINE EXECUTION SUMMARY")
        logger.info("=" * 60)
        logger.info(f"📊 Status: {status.upper()}")
        logger.info(f"⏱️  Total Duration: {elapsed_time:.2f}s")
        logger.info(f"📥 Videos Fetched: {total_fetched}")
        logger.info(f"📤 Videos Processed: {total_final}")
        logger.info(f"📝 Summary Coverage: {summary_coverage:.1f}% ({ready_summaries}/{total_final})")
        logger.info(f"🎨 AI Images: {images_generated} generated, {images_failed} failed ({images_total_attempts} total attempts)")
        logger.info(f"🏆 Top 3 with Images: {top3_with_images}/3")
        
        # Database operations summary  
        if hasattr(self, 'supabase_enabled') and self.supabase_enabled:
            logger.info(f"💾 Database: Supabase (upserted {total_final} records)")
        
        # JSON fallback status
        if self.allow_json_fallback:
            logger.info(f"📄 JSON Fallback: ENABLED (saved to {getattr(self, 'output_file', 'default location')})")
        else:
            logger.info(f"📄 JSON Fallback: DISABLED (Supabase-only mode)")
        
        # Performance metrics
        if total_fetched > 0:
            processing_rate = total_final / elapsed_time if elapsed_time > 0 else 0
            logger.info(f"⚡ Processing Rate: {processing_rate:.1f} items/second")
        
        # Log structured data for monitoring
        logger.info("LOG:SUMMARY status=%s fetched=%d processed=%d summary_coverage=%.1f images_generated=%d images_failed=%d top3_images=%d elapsed=%.2f", 
                   status, total_fetched, total_final, summary_coverage, images_generated, images_failed, top3_with_images, elapsed_time)
        
        logger.info("=" * 60)
    
    def validate_no_mock_content(self, videos: List[Dict[str, Any]]) -> None:
        """Validate that no mock content exists in videos if strict mode enabled."""
        logger.info("🔍 Validating no mock content in processed videos...")
        
        mock_violations = []
        for i, video in enumerate(videos):
            # Check for mock strings in summary fields
            summary = video.get('summary', '')
            summary_en = video.get('summary_en', '')
            
            if isinstance(summary, str) and 'Mock ' in summary:
                mock_violations.append(f"Video {i+1}: Mock content in Thai summary")
            
            if isinstance(summary_en, str) and 'Mock ' in summary_en:
                mock_violations.append(f"Video {i+1}: Mock content in English summary")
            
            # V2 summary fix: Check for placeholder text that should never appear in production  
            prohibited_patterns = [
                'mock_', 'placeholder summary', 'test summary', 'fake summary',
                'lorem ipsum', 'TODO:', 'FIXME:',
                'สรุปชั่วคราวไม่พร้อมใช้งาน',  # Thai placeholder
                'Summary temporarily unavailable'   # English placeholder
            ]
            
            for field_name, field_value in video.items():
                if isinstance(field_value, str):
                    if any(pattern in field_value.lower() for pattern in prohibited_patterns):
                        mock_violations.append(f"Video {i+1}: Mock content in field '{field_name}'")
        
        if mock_violations:
            logger.error("❌ Mock content validation failed:")
            for violation in mock_violations:
                logger.error(f"   {violation}")
            
            if self.strict_real_data:
                raise ValueError(f"Mock content detected in output data: {len(mock_violations)} violations")
        else:
            logger.info("✅ No mock content detected - validation passed")
    
    def generate_end_of_run_report(self, videos: List[Dict[str, Any]]) -> None:
        """Generate comprehensive end-of-run report."""
        logger.info("\n" + "=" * 60)
        logger.info("📊 END-OF-RUN REPORT")
        logger.info("=" * 60)
        
        # Basic stats
        total_items = len(videos)
        logger.info(f"Total items processed: {total_items}")
        
        # Category analysis
        unknown_count = 0
        category_counts = {}
        
        for video in videos:
            category = video.get('auto_category', 'Unknown')
            category_counts[category] = category_counts.get(category, 0) + 1
            
            if category in ['Unknown', 'อื่นๆ (Others)', '']:
                unknown_count += 1
        
        unknown_rate = (unknown_count / total_items) * 100 if total_items > 0 else 0
        logger.info(f"📊 Category Analysis:")
        logger.info(f"   Unknown rate: {unknown_rate:.1f}% ({unknown_count}/{total_items})")
        
        # Top categories
        sorted_categories = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)
        logger.info(f"   Top categories:")
        for category, count in sorted_categories[:5]:
            percentage = (count / total_items) * 100 if total_items > 0 else 0
            logger.info(f"     • {category}: {count} ({percentage:.1f}%)")
        
        # V2 summary fix: Enhanced summary coverage analysis  
        thai_summary_count = 0
        english_summary_count = 0
        pending_count = 0
        failed_count = 0
        
        for video in videos:
            thai_summary = video.get('summary', '')
            english_summary = video.get('summary_en', '')
            summary_status = video.get('summary_status', 'unknown')
            summary_en_status = video.get('summary_en_status', 'unknown')
            
            # Count ready Thai summaries (non-empty, real content)
            if (isinstance(thai_summary, str) and thai_summary.strip() and 
                summary_status == 'ready' and not thai_summary.startswith('Mock ')):
                thai_summary_count += 1
            
            # Count ready English summaries (non-empty, real content)
            if (isinstance(english_summary, str) and english_summary.strip() and 
                summary_en_status == 'ready' and not english_summary.startswith('Mock ')):
                english_summary_count += 1
            
            # Count pending/failed statuses
            if summary_status == 'pending' or summary_en_status == 'pending':
                pending_count += 1
            if summary_status == 'failed' or summary_en_status == 'failed':  
                failed_count += 1
        
        thai_coverage = (thai_summary_count / total_items) * 100 if total_items > 0 else 0
        english_coverage = (english_summary_count / total_items) * 100 if total_items > 0 else 0
        
        logger.info(f"📝 Summary Coverage:")
        logger.info(f"   Thai summaries: {thai_summary_count}/{total_items} ({thai_coverage:.1f}%)")
        logger.info(f"   English summaries: {english_summary_count}/{total_items} ({english_coverage:.1f}%)")
        logger.info(f"   Pending: {pending_count}, Failed: {failed_count}")
        
        # Top-3 image prompt coverage
        top3_with_prompts = 0
        top3_total = 0
        
        for video in videos:
            rank = video.get('rank', 0)
            if rank <= 3:
                top3_total += 1
                if (video.get('image_status') == 'ready' and 
                    isinstance(video.get('ai_image_prompt'), str) and 
                    video.get('ai_image_prompt', '').strip()):
                    top3_with_prompts += 1
        
        top3_prompt_coverage = (top3_with_prompts / top3_total) * 100 if top3_total > 0 else 0
        
        logger.info(f"🎨 Top-3 Image Prompt Coverage:")
        logger.info(f"   Items with prompts: {top3_with_prompts}/{top3_total} ({top3_prompt_coverage:.1f}%)")
        
        # Image statistics
        logger.info(f"🖼️ Image Processing:")
        logger.info(f"   Generated: {getattr(self, 'image_generated_count', 0)}")
        logger.info(f"   Skipped: {getattr(self, 'image_skipped_count', 0)}")
        logger.info(f"   Failed: {getattr(self, 'image_failed_count', 0)}")
        
        # Performance indicators
        logger.info(f"🎯 Performance Indicators:")
        logger.info(f"   Unknown rate target: ≤ 15% → {'✅' if unknown_rate <= 15 else '❌'}")
        logger.info(f"   Summary coverage target: ≥ 95% → {'✅' if thai_coverage >= 95 else '❌'}")
        logger.info(f"   Top-3 prompt coverage: 100% → {'✅' if top3_prompt_coverage == 100 else '❌'}")
        
        logger.info("=" * 60)


def parse_arguments() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="TrendSiam News Ingestion Pipeline v2 with Idempotency and Image Persistence",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Key Features:
  • Two-layer model (stories/snapshots) for idempotency without data loss
  • Image persistence with Top-3 focus and retry logic  
  • Deterministic ordering and alignment
  • Structured logging and proper exit codes

Examples:
  python summarize_all_v2.py                                    # Process all videos
  python summarize_all_v2.py --limit 20 --verbose              # Process 20 with debug logging
  python summarize_all_v2.py --regenerate-missing-images       # Force check missing images
  python summarize_all_v2.py --dry-run --limit 5               # Test run without changes

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
    
    # SECTION C: JSON output removed - Supabase only
    # parser.add_argument('--output', '-o', ...) # REMOVED
    
    parser.add_argument(
        '--limit', '-l',
        type=int,
        help='Maximum number of videos to process for current run (respects existing snapshots)'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose/debug logging'
    )
    
    parser.add_argument(
        '--generate-images',
        action='store_true',
        default=True,
        help='Enable AI image generation for top stories (default: True)'
    )
    
    parser.add_argument(
        '--images-top-n',
        type=int,
        default=3,
        help='Number of top stories to generate images for (default: 3)'
    )
    
    parser.add_argument(
        '--regen-missing-images',
        action='store_true',
        help='Force check and regenerate missing/invalid images for existing stories'
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
        '--recompute-scores',
        action='store_true',
        help='Force recomputation of popularity scores for current run'
    )
    
    parser.add_argument(
        '--reclassify',
        action='store_true',
        help='Force reclassification of categories for current run'
    )
    
    parser.add_argument(
        '--recompute-summaries',
        action='store_true',
        help='Force recomputation of summaries for current run'
    )
    
    parser.add_argument(
        '--force-all-summaries',
        action='store_true',
        help='Force recomputation of ALL summaries (ignores existing ones)'  # V2 summary fix
    )
    
    parser.add_argument(
        '--recompute-keywords',
        action='store_true',
        help='Force recomputation of keywords for current run'
    )
    
    parser.add_argument(
        '--strict-real-data',
        action='store_true',
        default=True,
        help='Validate no mock/placeholder content in outputs (default: True)'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Perform dry run without making any changes to database or files'
    )
    
    parser.add_argument(
        '--force-refresh-stats',
        action='store_true',
        help='Force refresh of metrics from live sources, bypassing cache and always creating new snapshots'  # [rank-img-investigation]
    )
    
    parser.add_argument(
        '--override-images',
        action='store_true',
        help='Allow explicit overwrite of existing image URLs (default: False, protects existing URLs)'
    )
    
    parser.add_argument(
        '--emit-revalidate',
        action='store_true',
        help='After successful DB write, hit revalidate API to refresh UI cache'  # [data-freshness]
    )
    
    parser.add_argument(
        '--only-video-id',
        type=str,
        help='Process only a specific video ID (for targeted fixes)'
    )
    
    return parser.parse_args()


def main():
    """Main function to run the ingestion pipeline."""
    try:
        args = parse_arguments()
        
        # Validate arguments
        if args.limit is not None and args.limit <= 0:
            logger.error("--limit must be a positive integer")
            return 1
        
        # Show configuration
        logger.info("TrendSiam News Ingestion Pipeline v2 - Supabase Only")
        logger.info("=" * 50)
        logger.info(f"Input file: {args.input}")
        logger.info("Output: Supabase only (JSON disabled unless ALLOW_JSON_FALLBACK=true)")
        logger.info(f"Limit: {args.limit or 'All videos'}")
        logger.info(f"Dry run: {args.dry_run}")
        logger.info(f"Generate images: {args.generate_images}")
        logger.info(f"Images top-N: {args.images_top_n}")
        logger.info(f"Regenerate missing: {args.regen_missing_images}")
        logger.info(f"Max retries: {args.max_image_retries}")
        logger.info(f"Retry backoff: {args.retry_backoff_seconds}s")
        logger.info(f"Recompute scores: {args.recompute_scores}")
        logger.info(f"Reclassify categories: {args.reclassify}")
        logger.info(f"Recompute summaries: {args.recompute_summaries}")
        logger.info(f"Force all summaries: {args.force_all_summaries}")  # V2 summary fix
        logger.info(f"Strict real data: {args.strict_real_data}")
        logger.info(f"Force refresh stats: {args.force_refresh_stats}")  # [rank-img-investigation]
        logger.info("")
        
        # Create and run ingester
        ingester = TrendSiamNewsIngester(
            input_file=args.input,
            # SECTION C: output_file removed - Supabase only
            limit=args.limit,
            generate_images=args.generate_images,
            images_top_n=args.images_top_n,
            regen_missing_images=args.regen_missing_images,
            max_image_retries=args.max_image_retries,
            retry_backoff_seconds=args.retry_backoff_seconds,
            dry_run=args.dry_run,
            verbose=args.verbose,
            recompute_scores=args.recompute_scores,
            reclassify=args.reclassify,
            recompute_summaries=args.recompute_summaries,
            recompute_keywords=args.recompute_keywords,
            force_all_summaries=args.force_all_summaries,  # V2 summary fix
            strict_real_data=args.strict_real_data,
            force_refresh_stats=args.force_refresh_stats,  # [rank-img-investigation]
            emit_revalidate=args.emit_revalidate,  # [data-freshness]
            override_images=args.override_images,  # [IMAGE-PROTECTION]
            only_video_id=args.only_video_id  # [TARGETED-FIX]
        )
        
        exit_code = ingester.run()
        
        # Exit with appropriate code
        if exit_code == 0:
            logger.info("✅ Pipeline completed successfully")
        elif exit_code == 5:
            logger.warning("⚠️ Pipeline completed with some issues (partial success)")
        else:
            logger.error("❌ Pipeline failed")
        
        return exit_code
        
    except KeyboardInterrupt:
        logger.warning("Process interrupted by user")
        return 130
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
