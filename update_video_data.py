#!/usr/bin/env python3
"""
TrendSiam Video Data Updater
============================

Safely updates video view counts and categories from YouTube Data API while maintaining
full compatibility with existing TrendSiam system and security policies.

Features:
- Fetches latest view counts, likes, comments from YouTube API
- Re-classifies categories using existing TrendSiam logic
- Defensive programming to prevent data loss
- Backup and rollback functionality
- Rate limiting and API quota management
- Full validation and error handling

Requirements:
- YOUTUBE_API_KEY in .env file
- Existing thailand_trending_summary.json file
- All TrendSiam dependencies installed

Usage:
    python update_video_data.py [--dry-run] [--backup-only] [--restore]

Security:
- Validates all API responses
- Creates automatic backups before changes
- Maintains data integrity with extensive validation
- Respects YouTube API terms of service
- Implements rate limiting and error recovery
"""

import json
import os
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import requests
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/update_video_data.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class TrendSiamVideoUpdater:
    """
    Secure video data updater for TrendSiam system.
    
    Safely updates view counts and categories while maintaining data integrity
    and system compatibility.
    """
    
    def __init__(self, data_file: str = "thailand_trending_summary.json"):
        """
        Initialize the video updater.
        
        Args:
            data_file: Path to the TrendSiam data file
        """
        self.data_file = Path(data_file)
        self.backup_dir = Path("backups")
        self.api_key = os.getenv('YOUTUBE_API_KEY')
        self.base_url = 'https://www.googleapis.com/youtube/v3/videos'
        
        # Rate limiting (YouTube API allows 10,000 requests per day)
        self.rate_limit_delay = 0.1  # 100ms between requests
        self.last_request_time = 0
        
        # Validation thresholds
        self.min_view_count = 1
        self.max_view_count = 10_000_000_000  # 10 billion max reasonable views
        self.valid_categories = {
            '🏀 กีฬา', '🎵 บันเทิง', '🕹️ เกม/อนิเมะ', '🏛️ การเมือง/ข่าวทั่วไป',
            '🎓 การศึกษา', '🌿 ไลฟ์สไตล์', '💰 ธุรกิจ/การเงิน', '❤️ สุขภาพ',
            '📦 อื่นๆ', '❓ ไม่ระบุ'
        }
        
        # Initialize directories
        self._setup_directories()
        self._validate_environment()
    
    def _setup_directories(self) -> None:
        """Create necessary directories."""
        self.backup_dir.mkdir(exist_ok=True)
        Path("logs").mkdir(exist_ok=True)
    
    def _validate_environment(self) -> None:
        """Validate environment and dependencies."""
        if not self.api_key:
            raise ValueError(
                "YouTube API key not found. Please set YOUTUBE_API_KEY in your .env file.\n"
                "Get your API key from: https://console.cloud.google.com/apis/credentials"
            )
        
        if not self.data_file.exists():
            raise FileNotFoundError(
                f"Data file not found: {self.data_file}\n"
                "Please run 'python summarize_all.py' first to generate the data file."
            )
        
        logger.info("✅ Environment validation passed")
    
    def create_backup(self, suffix: str = "") -> Path:
        """
        Create a backup of the current data file.
        
        Args:
            suffix: Additional suffix for backup filename
            
        Returns:
            Path to the created backup file
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"thailand_trending_summary_backup_{timestamp}{suffix}.json"
        backup_path = self.backup_dir / backup_name
        
        try:
            shutil.copy2(self.data_file, backup_path)
            logger.info(f"✅ Backup created: {backup_path}")
            return backup_path
        except Exception as e:
            logger.error(f"❌ Failed to create backup: {e}")
            raise
    
    def load_data(self) -> List[Dict[str, Any]]:
        """
        Safely load data from the JSON file.
        
        Returns:
            List of news items
        """
        try:
            with open(self.data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if not isinstance(data, list):
                raise ValueError("Data file must contain a list of news items")
            
            logger.info(f"✅ Loaded {len(data)} news items from {self.data_file}")
            return data
        except Exception as e:
            logger.error(f"❌ Failed to load data: {e}")
            raise
    
    def save_data(self, data: List[Dict[str, Any]], validate: bool = True) -> None:
        """
        Safely save data to the JSON file with validation.
        
        Args:
            data: List of news items to save
            validate: Whether to validate data before saving
        """
        if validate:
            self._validate_data_integrity(data)
        
        try:
            # Write to temporary file first
            temp_file = self.data_file.with_suffix('.tmp')
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            # Atomic move to final location
            temp_file.replace(self.data_file)
            logger.info(f"✅ Data saved successfully to {self.data_file}")
            
        except Exception as e:
            logger.error(f"❌ Failed to save data: {e}")
            if temp_file.exists():
                temp_file.unlink()
            raise
    
    def _validate_data_integrity(self, data: List[Dict[str, Any]]) -> None:
        """
        Validate data integrity before saving.
        
        Args:
            data: Data to validate
        """
        if not isinstance(data, list):
            raise ValueError("Data must be a list")
        
        required_fields = {'video_id', 'title', 'view_count'}
        
        for i, item in enumerate(data):
            if not isinstance(item, dict):
                raise ValueError(f"Item {i} must be a dictionary")
            
            # Check required fields
            missing_fields = required_fields - set(item.keys())
            if missing_fields:
                raise ValueError(f"Item {i} missing required fields: {missing_fields}")
            
            # Validate video ID format
            video_id = item.get('video_id', '')
            if not self._validate_youtube_video_id(video_id):
                raise ValueError(f"Item {i} has invalid video_id: {video_id}")
            
            # Validate view count
            view_count_str = item.get('view_count', '0')
            view_count = self._parse_view_count(view_count_str)
            if view_count < 0:
                raise ValueError(f"Item {i} has invalid view_count: {view_count_str}")
        
        logger.info("✅ Data integrity validation passed")
    
    def _validate_youtube_video_id(self, video_id: str) -> bool:
        """Validate YouTube video ID format."""
        import re
        if not video_id or not isinstance(video_id, str):
            return False
        pattern = r'^[a-zA-Z0-9_-]{11}$'
        return bool(re.match(pattern, video_id))
    
    def _rate_limit(self) -> None:
        """Implement rate limiting for API requests."""
        current_time = time.time()
        elapsed = current_time - self.last_request_time
        if elapsed < self.rate_limit_delay:
            time.sleep(self.rate_limit_delay - elapsed)
        self.last_request_time = time.time()
    
    def fetch_video_statistics(self, video_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        Fetch latest statistics for multiple videos from YouTube API.
        
        Args:
            video_ids: List of YouTube video IDs
            
        Returns:
            Dictionary mapping video_id to statistics
        """
        if not video_ids:
            return {}
        
        # YouTube API allows up to 50 video IDs per request
        batch_size = 50
        all_stats = {}
        
        for i in range(0, len(video_ids), batch_size):
            batch = video_ids[i:i + batch_size]
            batch_stats = self._fetch_video_batch(batch)
            all_stats.update(batch_stats)
            
            # Rate limiting between batches
            if i + batch_size < len(video_ids):
                self._rate_limit()
        
        return all_stats
    
    def _fetch_video_batch(self, video_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        Fetch statistics for a batch of videos.
        
        Args:
            video_ids: List of video IDs (max 50)
            
        Returns:
            Dictionary mapping video_id to statistics
        """
        params = {
            'key': self.api_key,
            'part': 'statistics,snippet',
            'id': ','.join(video_ids)
        }
        
        try:
            self._rate_limit()
            response = requests.get(self.base_url, params=params, timeout=30)
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
                    snippet = item.get('snippet', {})
                    
                    stats[video_id] = {
                        'view_count': statistics.get('viewCount', '0'),
                        'like_count': statistics.get('likeCount', '0'),
                        'comment_count': statistics.get('commentCount', '0'),
                        'title': snippet.get('title', ''),
                        'description': snippet.get('description', ''),
                        'published_at': snippet.get('publishedAt', ''),
                        'channel_title': snippet.get('channelTitle', '')
                    }
            
            logger.info(f"✅ Fetched statistics for {len(stats)} videos")
            return stats
            
        except requests.RequestException as e:
            logger.error(f"❌ Network error fetching video statistics: {e}")
            return {}
        except Exception as e:
            logger.error(f"❌ Error fetching video statistics: {e}")
            return {}
    
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
    
    def classify_news_item(self, news_item: Dict[str, Any]) -> str:
        """
        Re-classify news item category using TrendSiam's classification logic.
        
        This function imports and uses the existing classification logic from app.py
        to ensure consistency with the main application.
        
        Args:
            news_item: News item to classify
            
        Returns:
            Category string
        """
        try:
            # Import the classification function from the main app
            import sys
            import importlib.util
            
            # Load classification logic from app.py
            spec = importlib.util.spec_from_file_location("app", "app.py")
            app_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(app_module)
            
            # Use the existing classification function
            if hasattr(app_module, 'classify_news_item'):
                return app_module.classify_news_item(news_item)
            else:
                logger.warning("⚠️ classify_news_item function not found in app.py")
                return news_item.get('auto_category', '📦 อื่นๆ')
                
        except Exception as e:
            logger.warning(f"⚠️ Failed to re-classify item: {e}")
            # Return existing category as fallback
            return news_item.get('auto_category', '📦 อื่นๆ')
    
    def update_single_item(self, item: Dict[str, Any], stats: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        Update a single news item with new statistics and category.
        
        Args:
            item: News item to update
            stats: New statistics from YouTube API
            
        Returns:
            Tuple of (was_updated, list_of_changes)
        """
        changes = []
        was_updated = False
        
        try:
            # Update view count if valid and different
            new_view_count_int = int(stats.get('view_count', 0))
            current_view_count_int = self._parse_view_count(item.get('view_count', '0'))
            
            if (self.min_view_count <= new_view_count_int <= self.max_view_count and
                new_view_count_int != current_view_count_int):
                
                old_formatted = item.get('view_count', '0')
                new_formatted = self._format_view_count(new_view_count_int)
                
                item['view_count'] = new_formatted
                changes.append(f"view_count: {old_formatted} → {new_formatted}")
                was_updated = True
            
            # Update like count if available
            new_like_count = stats.get('like_count', '')
            if new_like_count and new_like_count != item.get('like_count', ''):
                old_likes = item.get('like_count', 'N/A')
                item['like_count'] = new_like_count
                changes.append(f"like_count: {old_likes} → {new_like_count}")
                was_updated = True
            
            # Update comment count if available
            new_comment_count = stats.get('comment_count', '')
            if new_comment_count and new_comment_count != item.get('comment_count', ''):
                old_comments = item.get('comment_count', 'N/A')
                item['comment_count'] = new_comment_count
                changes.append(f"comment_count: {old_comments} → {new_comment_count}")
                was_updated = True
            
            # Re-classify category
            new_category = self.classify_news_item(item)
            current_category = item.get('auto_category', '')
            
            if new_category and new_category != current_category:
                item['auto_category'] = new_category
                changes.append(f"category: {current_category} → {new_category}")
                was_updated = True
            
            # Update last_updated timestamp
            if was_updated:
                item['last_updated'] = datetime.now(timezone.utc).isoformat()
                changes.append("added last_updated timestamp")
            
        except Exception as e:
            logger.error(f"❌ Error updating item {item.get('video_id', 'unknown')}: {e}")
            return False, [f"Error: {str(e)}"]
        
        return was_updated, changes
    
    def update_all_videos(self, dry_run: bool = False) -> Dict[str, Any]:
        """
        Update all videos in the dataset.
        
        Args:
            dry_run: If True, only simulate updates without saving
            
        Returns:
            Update results summary
        """
        logger.info("🚀 Starting video data update process...")
        
        # Create backup unless this is a dry run
        if not dry_run:
            backup_path = self.create_backup("_pre_update")
        
        # Load current data
        data = self.load_data()
        
        # Extract video IDs
        video_ids = []
        video_id_to_index = {}
        
        for i, item in enumerate(data):
            video_id = item.get('video_id', '').strip()
            if self._validate_youtube_video_id(video_id):
                video_ids.append(video_id)
                video_id_to_index[video_id] = i
            else:
                logger.warning(f"⚠️ Skipping item {i} with invalid video_id: {video_id}")
        
        if not video_ids:
            logger.error("❌ No valid video IDs found to update")
            return {'success': False, 'error': 'No valid video IDs found'}
        
        logger.info(f"📹 Found {len(video_ids)} valid video IDs to update")
        
        # Fetch latest statistics from YouTube API
        logger.info("🔄 Fetching latest statistics from YouTube API...")
        all_stats = self.fetch_video_statistics(video_ids)
        
        if not all_stats:
            logger.error("❌ Failed to fetch any video statistics")
            return {'success': False, 'error': 'Failed to fetch video statistics'}
        
        # Update items
        update_summary = {
            'total_items': len(data),
            'valid_video_ids': len(video_ids),
            'stats_fetched': len(all_stats),
            'items_updated': 0,
            'items_unchanged': 0,
            'errors': 0,
            'changes': []
        }
        
        for video_id, stats in all_stats.items():
            if video_id in video_id_to_index:
                index = video_id_to_index[video_id]
                item = data[index]
                
                was_updated, changes = self.update_single_item(item, stats)
                
                if was_updated:
                    update_summary['items_updated'] += 1
                    update_summary['changes'].append({
                        'video_id': video_id,
                        'title': item.get('title', 'Unknown')[:50] + '...',
                        'changes': changes
                    })
                    logger.info(f"✅ Updated {video_id}: {', '.join(changes)}")
                else:
                    update_summary['items_unchanged'] += 1
        
        # Save updated data (unless dry run)
        if not dry_run and update_summary['items_updated'] > 0:
            try:
                self.save_data(data)
                logger.info(f"✅ Successfully updated {update_summary['items_updated']} items")
            except Exception as e:
                logger.error(f"❌ Failed to save updated data: {e}")
                update_summary['save_error'] = str(e)
                return {'success': False, **update_summary}
        
        elif dry_run:
            logger.info("🔍 Dry run completed - no changes saved")
        
        update_summary['success'] = True
        return update_summary
    
    def restore_from_backup(self, backup_path: str) -> bool:
        """
        Restore data from a backup file.
        
        Args:
            backup_path: Path to backup file
            
        Returns:
            True if successful, False otherwise
        """
        backup_file = Path(backup_path)
        
        if not backup_file.exists():
            logger.error(f"❌ Backup file not found: {backup_path}")
            return False
        
        try:
            # Validate backup file
            with open(backup_file, 'r', encoding='utf-8') as f:
                backup_data = json.load(f)
            
            self._validate_data_integrity(backup_data)
            
            # Create backup of current file before restore
            current_backup = self.create_backup("_pre_restore")
            
            # Restore from backup
            shutil.copy2(backup_file, self.data_file)
            
            logger.info(f"✅ Successfully restored from backup: {backup_path}")
            logger.info(f"📁 Current data backed up to: {current_backup}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to restore from backup: {e}")
            return False


def main():
    """Main function with command-line interface."""
    import argparse
    
    parser = argparse.ArgumentParser(description="TrendSiam Video Data Updater")
    parser.add_argument('--dry-run', action='store_true', help='Simulate updates without saving')
    parser.add_argument('--backup-only', action='store_true', help='Create backup only')
    parser.add_argument('--restore', type=str, help='Restore from backup file')
    parser.add_argument('--data-file', default='thailand_trending_summary.json', help='Data file path')
    
    args = parser.parse_args()
    
    try:
        updater = TrendSiamVideoUpdater(args.data_file)
        
        if args.restore:
            success = updater.restore_from_backup(args.restore)
            if success:
                print("✅ Restore completed successfully")
            else:
                print("❌ Restore failed")
                return 1
        
        elif args.backup_only:
            backup_path = updater.create_backup("_manual")
            print(f"✅ Backup created: {backup_path}")
        
        else:
            results = updater.update_all_videos(dry_run=args.dry_run)
            
            if results['success']:
                print(f"\n📊 Update Summary:")
                print(f"   Total items: {results['total_items']}")
                print(f"   Valid video IDs: {results['valid_video_ids']}")
                print(f"   Statistics fetched: {results['stats_fetched']}")
                print(f"   Items updated: {results['items_updated']}")
                print(f"   Items unchanged: {results['items_unchanged']}")
                
                if results['items_updated'] > 0:
                    print(f"\n🔄 Recent Changes:")
                    for change in results['changes'][-5:]:  # Show last 5 changes
                        print(f"   📹 {change['title']}")
                        for detail in change['changes'][:3]:  # Show first 3 changes per item
                            print(f"      • {detail}")
                
                if args.dry_run:
                    print("\n🔍 This was a dry run - no changes were saved")
                else:
                    print("\n✅ Update completed successfully")
            else:
                print(f"❌ Update failed: {results.get('error', 'Unknown error')}")
                return 1
    
    except KeyboardInterrupt:
        print("\n⚠️ Update cancelled by user")
        return 1
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        print(f"❌ Fatal error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main()) 