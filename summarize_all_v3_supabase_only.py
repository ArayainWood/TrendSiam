#!/usr/bin/env python3
"""
TrendSiam News Ingestion Pipeline v3 - Supabase Only
Specification-compliant pipeline with no JSON dependencies

Features:
- Supabase-only read/write (no JSON as source of truth)
- Proper schema compliance with news_trends table
- CLI flags: --limit, --verbose, --force-refresh-stats, --dry-run
- Structured logging with specific tags
- Cache busting via system_meta updates
"""

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from pathlib import Path

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Configure logging  
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Required imports
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    logger.error("supabase-py not installed. Run: pip install supabase")
    sys.exit(1)

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    logger.warning("requests not installed. External data fetching disabled.")
    REQUESTS_AVAILABLE = False


class TrendSiamPipeline:
    """Specification-compliant TrendSiam pipeline with Supabase-only operation."""
    
    def __init__(self, limit: int = 20, verbose: bool = False, 
                 force_refresh_stats: bool = False, dry_run: bool = False):
        """Initialize pipeline with specification parameters."""
        self.limit = limit
        self.verbose = verbose
        self.force_refresh_stats = force_refresh_stats
        self.dry_run = dry_run
        
        # Feature flags
        self.allow_json_fallback = os.getenv('ALLOW_JSON_FALLBACK', 'false').lower() == 'true'
        
        # Statistics
        self.fetched_count = 0
        self.upserted_count = 0
        self.updated_scores_count = 0
        self.images_attached_count = 0
        
        # Initialize Supabase client
        self._init_supabase()
        
        if verbose:
            logging.getLogger().setLevel(logging.DEBUG)
            
        logger.info("LOG:ARGS limit=%d verbose=%s force_refresh=%s dry_run=%s", 
                   limit, verbose, force_refresh_stats, dry_run)
    
    def _init_supabase(self) -> None:
        """Initialize Supabase client using service role."""
        supabase_url = os.environ.get('SUPABASE_URL')
        service_role_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
        
        if not supabase_url or not service_role_key:
            logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")
            if not self.allow_json_fallback:
                sys.exit(1)
            else:
                logger.warning("Supabase not configured, JSON fallback allowed")
                self.supabase = None
                return
        
        try:
            self.supabase = create_client(supabase_url, service_role_key)
            # Test connection
            result = self.supabase.table('news_trends').select('count', count='exact', head=True).execute()
            logger.info("✅ Supabase connected successfully")
        except Exception as e:
            logger.error("Failed to connect to Supabase: %s", e)
            if not self.allow_json_fallback:
                sys.exit(1)
            else:
                logger.warning("Supabase connection failed, JSON fallback allowed")
                self.supabase = None
    
    def fetch_raw_data(self) -> List[Dict[str, Any]]:
        """Fetch raw news data from external sources."""
        logger.info("Fetching raw data from sources...")
        
        # Try to fetch from YouTube API or other sources
        if self.force_refresh_stats:
            logger.info("Force refresh mode - attempting live data fetch")
            live_data = self._fetch_live_data()
            if live_data:
                self.fetched_count = len(live_data)
                logger.info("LOG:FETCH source=live count=%d", self.fetched_count)
                return live_data
        
        # Fallback to existing static data (only if allowed)
        if self.allow_json_fallback:
            logger.warning("Using JSON fallback data source")
            return self._fetch_json_fallback()
        else:
            logger.error("No live data available and JSON fallback disabled")
            return []
    
    def _fetch_live_data(self) -> Optional[List[Dict[str, Any]]]:
        """Fetch live data from YouTube API and other sources."""
        if not REQUESTS_AVAILABLE:
            logger.warning("requests not available for live data fetching")
            return None
            
        try:
            # Import YouTube fetcher
            from youtube_api_fetcher import YouTubeAPIFetcher
            fetcher = YouTubeAPIFetcher()
            
            raw_videos = fetcher.fetch_trending_videos()
            if raw_videos:
                # Transform to our format
                transformed = []
                for video in raw_videos[:self.limit] if self.limit else raw_videos:
                    item = self._transform_youtube_item(video)
                    if item:
                        transformed.append(item)
                
                logger.info("Fetched %d videos from YouTube API", len(transformed))
                return transformed
                
        except Exception as e:
            logger.error("Live data fetch failed: %s", e)
        
        return None
    
    def _fetch_json_fallback(self) -> List[Dict[str, Any]]:
        """Fallback to JSON file (only when explicitly allowed)."""
        if not self.allow_json_fallback:
            logger.error("JSON fallback disabled - cannot proceed")
            return []
            
        try:
            json_path = Path('thailand_trending_api.json')
            if not json_path.exists():
                logger.error("JSON fallback file not found: %s", json_path)
                return []
            
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if isinstance(data, list):
                items = data[:self.limit] if self.limit else data
            else:
                items = []
                
            self.fetched_count = len(items)
            logger.warning("LOG:FETCH source=json_fallback count=%d", self.fetched_count)
            return items
            
        except Exception as e:
            logger.error("JSON fallback failed: %s", e)
            return []
    
    def _transform_youtube_item(self, video: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Transform YouTube API item to our schema format."""
        try:
            snippet = video.get('snippet', {})
            statistics = video.get('statistics', {})
            video_id = video.get('id')
            
            if isinstance(video_id, dict):
                video_id = video_id.get('videoId')
                
            if not video_id:
                return None
            
            # Parse published date
            published_str = snippet.get('publishedAt', '')
            try:
                published_at = datetime.fromisoformat(published_str.replace('Z', '+00:00'))
            except:
                published_at = datetime.now(timezone.utc)
            
            return {
                'platform': 'youtube',
                'external_id': video_id,
                'title': snippet.get('title', ''),
                'summary': snippet.get('description', '')[:500] + '...' if len(snippet.get('description', '')) > 500 else snippet.get('description', ''),
                'category': self._normalize_category(snippet.get('categoryId', '')),
                'popularity_score': self._calculate_popularity_score(statistics),
                'published_at': published_at,
                'source_url': f"https://www.youtube.com/watch?v={video_id}",
                # 'thumbnail_url': snippet.get('thumbnails', {}).get('high', {}).get('url', ''), # REMOVED: No external thumbnails
                'extra': {
                    'view_count': statistics.get('viewCount', '0'),
                    'like_count': statistics.get('likeCount', '0'), 
                    'comment_count': statistics.get('commentCount', '0'),
                    'channel': snippet.get('channelTitle', ''),
                    'duration': video.get('contentDetails', {}).get('duration', '')
                }
            }
        except Exception as e:
            logger.warning("Failed to transform video item: %s", e)
            return None
    
    def _normalize_category(self, category_id: str) -> str:
        """Normalize category to standard values."""
        category_map = {
            '1': 'Entertainment',
            '2': 'Technology', 
            '10': 'Music',
            '15': 'Pets',
            '17': 'Sports',
            '19': 'Travel',
            '20': 'Gaming',
            '22': 'People',
            '23': 'Comedy',
            '24': 'Entertainment',
            '25': 'News',
            '26': 'How-to',
            '27': 'Education',
            '28': 'Technology'
        }
        return category_map.get(str(category_id), 'Unknown')
    
    def _calculate_popularity_score(self, statistics: Dict[str, Any]) -> float:
        """Calculate popularity score from video statistics."""
        try:
            views = int(statistics.get('viewCount', 0))
            likes = int(statistics.get('likeCount', 0))
            comments = int(statistics.get('commentCount', 0))
            
            # Simple scoring algorithm
            score = (views * 0.001) + (likes * 0.1) + (comments * 0.5)
            return round(min(score, 999.999), 3)  # Cap at 999.999
        except:
            return 0.0
    
    def normalize_items(self, raw_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Normalize raw items to specification schema."""
        normalized = []
        
        for item in raw_items:
            try:
                # Handle different input formats
                if 'video_id' in item:  # Legacy format
                    normalized_item = self._normalize_legacy_item(item)
                else:  # Already normalized format
                    normalized_item = item
                
                # Ensure required fields
                if self._validate_item(normalized_item):
                    normalized.append(normalized_item)
                else:
                    logger.warning("Item validation failed: %s", normalized_item.get('title', 'Unknown'))
                    
            except Exception as e:
                logger.warning("Failed to normalize item: %s", e)
        
        logger.info("Normalized %d items", len(normalized))
        return normalized
    
    def _normalize_legacy_item(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """Convert legacy format to specification format."""
        try:
            published_str = item.get('published_date', '')
            try:
                if published_str:
                    published_at = datetime.fromisoformat(published_str.replace('Z', '+00:00'))
                else:
                    published_at = datetime.now(timezone.utc)
            except:
                published_at = datetime.now(timezone.utc)
            
            return {
                'platform': 'youtube',
                'external_id': item.get('video_id', ''),
                'title': item.get('title', ''),
                'summary': item.get('summary', '') or item.get('description', '')[:500],
                'category': item.get('auto_category') or item.get('category', 'Unknown'),
                'popularity_score': float(item.get('popularity_score_precise', 0)),
                'published_at': published_at,
                'source_url': f"https://www.youtube.com/watch?v={item.get('video_id', '')}",
                # 'thumbnail_url': item.get('thumbnail_url', ''), # REMOVED: No external thumbnails
                'extra': {
                    'view_count': item.get('view_count', '0'),
                    'like_count': item.get('like_count', '0'),
                    'comment_count': item.get('comment_count', '0'),
                    'channel': item.get('channel', ''),
                    'ai_image_url': item.get('ai_image_url', ''),
                    'ai_image_prompt': item.get('ai_image_prompt', '')
                }
            }
        except Exception as e:
            logger.error("Failed to normalize legacy item: %s", e)
            return {}
    
    def _validate_item(self, item: Dict[str, Any]) -> bool:
        """Validate item has required fields."""
        required_fields = ['platform', 'external_id', 'title', 'summary', 'category']
        for field in required_fields:
            if not item.get(field):
                logger.debug("Missing required field: %s", field)
                return False
        return True
    
    def upsert_news_items(self, items: List[Dict[str, Any]]) -> None:
        """Upsert news items to database in batches."""
        if not self.supabase:
            logger.error("Supabase not available for upserts")
            return
        
        if self.dry_run:
            logger.info("LOG:UPSERT count=%d (DRY RUN)", len(items))
            for i, item in enumerate(items[:3]):  # Show top 3
                logger.info("DRY RUN item %d: %s (score=%.3f)", 
                           i+1, item['title'][:50], item['popularity_score'])
            return
        
        # Process in chunks of 500
        chunk_size = 500
        total_upserted = 0
        
        for i in range(0, len(items), chunk_size):
            chunk = items[i:i + chunk_size]
            try:
                result = self.supabase.table('news_trends').upsert(
                    chunk, 
                    on_conflict='platform,external_id'
                ).execute()
                
                chunk_count = len(result.data) if result.data else len(chunk)
                total_upserted += chunk_count
                logger.info("Upserted chunk %d-%d: %d items", i+1, i+len(chunk), chunk_count)
                
            except Exception as e:
                logger.error("Failed to upsert chunk %d-%d: %s", i+1, i+len(chunk), e)
        
        self.upserted_count = total_upserted
        logger.info("LOG:UPSERT count=%d", total_upserted)
    
    def read_recent_news(self, limit: int) -> List[Dict[str, Any]]:
        """Read recent news for validation."""
        if not self.supabase:
            return []
        
        try:
            result = self.supabase.table('news_trends').select('*').order(
                'published_at', desc=True
            ).limit(limit).execute()
            
            return result.data or []
        except Exception as e:
            logger.error("Failed to read recent news: %s", e)
            return []
    
    def update_popularity_scores(self, scored_items: List[Dict[str, Any]]) -> None:
        """Update popularity scores for existing items."""
        if not self.supabase or not scored_items:
            return
        
        if self.dry_run:
            logger.info("LOG:STATS_REFRESH count=%d (DRY RUN)", len(scored_items))
            return
        
        # Update scores in batches
        updates = []
        for item in scored_items:
            updates.append({
                'platform': item['platform'],
                'external_id': item['external_id'], 
                'popularity_score': item['popularity_score']
            })
        
        try:
            result = self.supabase.table('news_trends').upsert(
                updates,
                on_conflict='platform,external_id'
            ).execute()
            
            self.updated_scores_count = len(result.data) if result.data else len(updates)
            logger.info("LOG:STATS_REFRESH count=%d", self.updated_scores_count)
            
        except Exception as e:
            logger.error("Failed to update popularity scores: %s", e)
    
    def attach_ai_image_if_needed(self, news_id: str, image_url: str, 
                                prompt: str, model: str) -> None:
        """Attach AI image to news item."""
        if not self.supabase or self.dry_run:
            if self.dry_run:
                logger.info("DRY RUN: Would attach AI image for news_id=%s", news_id)
            return
        
        try:
            result = self.supabase.table('ai_images').upsert({
                'news_id': news_id,
                'image_url': image_url,
                'prompt': prompt,
                'model': model
            }, on_conflict='news_id').execute()
            
            if result.data:
                self.images_attached_count += 1
                logger.info("Attached AI image for news_id=%s", news_id)
                
        except Exception as e:
            logger.error("Failed to attach AI image: %s", e)
    
    def set_system_meta(self, key: str, value: str) -> None:
        """Set system metadata for cache busting."""
        if not self.supabase:
            logger.error("Supabase not available for system_meta update")
            return
        
        if self.dry_run:
            logger.info("DRY RUN: Would set system_meta %s=%s", key, value)
            return
        
        try:
            result = self.supabase.table('system_meta').upsert({
                'key': key,
                'value': value
            }, on_conflict='key').execute()
            
            logger.info("LOG:UPDATED_AT=%s", value)
            
        except Exception as e:
            logger.error("Failed to set system_meta: %s", e)
    
    def run(self) -> int:
        """Run the complete pipeline."""
        start_time = time.time()
        
        try:
            # Step 1: Fetch raw data
            raw_items = self.fetch_raw_data()
            if not raw_items:
                logger.error("No data fetched - aborting pipeline")
                return 1
            
            # Step 2: Normalize to schema
            normalized_items = self.normalize_items(raw_items)
            if not normalized_items:
                logger.error("No valid items after normalization")
                return 1
            
            # Step 3: Compute/update popularity scores if requested
            if self.force_refresh_stats:
                logger.info("Force refresh mode - recomputing popularity scores")
                for item in normalized_items:
                    # Recompute score based on current metrics
                    extra = item.get('extra', {})
                    stats = {
                        'viewCount': extra.get('view_count', '0'),
                        'likeCount': extra.get('like_count', '0'),
                        'commentCount': extra.get('comment_count', '0')
                    }
                    item['popularity_score'] = self._calculate_popularity_score(stats)
                
                # Update existing items with new scores
                self.update_popularity_scores(normalized_items)
            
            # Step 4: Upsert all items
            self.upsert_news_items(normalized_items)
            
            # Step 5: Optional AI image generation for top 3
            if not self.dry_run and self.force_refresh_stats:
                top_3_items = sorted(normalized_items, 
                                   key=lambda x: x['popularity_score'], reverse=True)[:3]
                
                for item in top_3_items:
                    # This would integrate with AI image generation
                    # For now, just log what we would do
                    logger.info("Would generate AI image for: %s", item['title'][:50])
            
            # Step 6: Update system metadata
            self.set_system_meta('news_last_updated', datetime.now(timezone.utc).isoformat())
            
            # Final statistics
            elapsed = time.time() - start_time
            logger.info("LOG:END fetched=%d upserted=%d updated_scores=%d images_attached=%d elapsed=%.2f",
                       self.fetched_count, self.upserted_count, 
                       self.updated_scores_count, self.images_attached_count, elapsed)
            
            return 0
            
        except Exception as e:
            logger.error("Pipeline failed: %s", e)
            return 1


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='TrendSiam News Pipeline - Supabase Only',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument(
        '--limit', 
        type=int, 
        default=20,
        help='Maximum number of items to process (default: 20)'
    )
    
    parser.add_argument(
        '--verbose', 
        action='store_true',
        help='Enable verbose logging'
    )
    
    parser.add_argument(
        '--force-refresh-stats',
        action='store_true', 
        help='Recompute popularity scores and refresh system_meta'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Do everything except write to database'
    )
    
    return parser.parse_args()


def main() -> int:
    """Main entry point."""
    args = parse_args()
    
    # Validate Supabase is available
    if not SUPABASE_AVAILABLE:
        logger.error("Supabase client not available. Install with: pip install supabase")
        return 1
    
    # Create and run pipeline
    pipeline = TrendSiamPipeline(
        limit=args.limit,
        verbose=args.verbose,
        force_refresh_stats=args.force_refresh_stats,
        dry_run=args.dry_run
    )
    
    return pipeline.run()


if __name__ == '__main__':
    sys.exit(main())
