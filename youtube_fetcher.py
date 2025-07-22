#!/usr/bin/env python3
"""
YouTube Trending Videos Fetcher for Thailand

This script fetches trending YouTube videos in Thailand using yt-dlp,
extracts relevant metadata, and saves the data to CSV file.

Features:
- Fetches trending videos from Thailand
- Extracts: title, description, view count, publish date, video URL
- Saves data to CSV file
- Returns data as list of dictionaries
- Includes error handling and logging
"""

import csv
import json
import logging
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import subprocess
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('youtube_fetcher.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class YouTubeTrendingFetcher:
    """
    A class to fetch trending YouTube videos from Thailand using yt-dlp.
    
    This class provides methods to extract video metadata from YouTube's
    trending page for Thailand and save the data in various formats.
    """
    
    def __init__(self):
        """Initialize the fetcher with Thailand-specific settings."""
        # Thailand trending URL
        self.trending_url = "https://www.youtube.com/feed/trending?gl=TH"
        self.max_videos = 50  # Limit to top 50 trending videos
        
    def check_dependencies(self) -> bool:
        """
        Check if yt-dlp is installed and available through multiple methods.
        
        Returns:
            bool: True if yt-dlp is available, False otherwise
        """
        # Method 1: Try direct yt-dlp command (if in PATH)
        try:
            result = subprocess.run(['yt-dlp', '--version'], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                logger.info(f"yt-dlp found in PATH, version: {result.stdout.strip()}")
                return True
        except (subprocess.TimeoutExpired, FileNotFoundError):
            logger.debug("yt-dlp not found in PATH, trying alternative methods...")
        
        # Method 2: Try python -m yt_dlp (module execution)
        try:
            result = subprocess.run([sys.executable, '-m', 'yt_dlp', '--version'], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                logger.info(f"yt-dlp found as Python module, version: {result.stdout.strip()}")
                return True
        except (subprocess.TimeoutExpired, FileNotFoundError):
            logger.debug("yt-dlp not available as Python module...")
        
        # Method 3: Try importing yt_dlp module
        try:
            import yt_dlp
            logger.info("yt-dlp imported successfully as module")
            return True
        except ImportError:
            logger.debug("yt-dlp not available for import...")
        
        # All methods failed
        logger.error("yt-dlp is not installed or not accessible. Please install it using: pip install yt-dlp")
        return False
    
    def fetch_trending_videos(self) -> List[Dict[str, str]]:
        """
        Fetch trending videos from Thailand's YouTube trending page.
        
        Returns:
            List[Dict[str, str]]: List of video data dictionaries
        """
        if not self.check_dependencies():
            return []
        
        logger.info("Fetching trending videos from Thailand...")
        
        try:
            # yt-dlp command to extract video information
            cmd = [
                'yt-dlp',
                '--flat-playlist',  # Don't download, just extract info
                '--no-playlist',    # Avoid playlist structures that may lack upload dates
                '--print-json',     # Output as JSON
                '--playlist-end', str(self.max_videos),  # Limit number of videos
                '--geo-bypass-country', 'TH',  # Set country to Thailand
                '--add-header', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',  # Custom User-Agent to bypass bot detection
                '--extractor-args', 'youtube:player_client=web',  # Use web client to bypass bot detection
                self.trending_url
            ]
            
            logger.debug(f"Executing yt-dlp command: {' '.join(cmd)}")
            
            # Execute yt-dlp command
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            
            if result.returncode != 0:
                logger.error(f"yt-dlp failed with return code {result.returncode}")
                logger.error(f"yt-dlp stderr: {result.stderr}")
                logger.error(f"yt-dlp stdout: {result.stdout}")
                return []
            
            logger.debug(f"yt-dlp completed successfully, parsing output...")
            
            # Parse JSON output
            videos_data = []
            for i, line in enumerate(result.stdout.strip().split('\n'), 1):
                if line.strip():
                    try:
                        video_info = json.loads(line)
                        
                        # Debug: Log what fields are available
                        video_id = video_info.get('id')
                        video_title = video_info.get('title', 'Unknown')
                        
                        if not video_id:
                            logger.warning(f"Video {i} missing 'id' field, available fields: {list(video_info.keys())}")
                            continue
                            
                        videos_data.append(video_info)
                        logger.debug(f"Parsed video {i}: id={video_id}, title={video_title[:50]}...")
                        
                    except json.JSONDecodeError as e:
                        logger.warning(f"Failed to parse JSON line {i}: {str(e)}")
                        continue
            
            logger.info(f"Found {len(videos_data)} trending videos from yt-dlp")
            return self._extract_detailed_info(videos_data)
            
        except subprocess.TimeoutExpired:
            logger.error("Timeout while fetching trending videos")
            return []
        except Exception as e:
            logger.error(f"Error fetching trending videos: {str(e)}")
            return []
    
    def _extract_detailed_info(self, videos_data: List[Dict]) -> List[Dict[str, str]]:
        """
        Extract detailed information for each video.
        
        Args:
            videos_data: Raw video data from yt-dlp
            
        Returns:
            List[Dict[str, str]]: Processed video information
        """
        processed_videos = []
        failed_details = 0
        missing_upload_date = 0
        too_old_videos = 0
        
        logger.info(f"Processing {len(videos_data)} videos for detailed information...")
        
        for i, video in enumerate(videos_data, 1):
            try:
                video_id = video.get('id', 'unknown')
                video_url = f"https://www.youtube.com/watch?v={video_id}"
                
                logger.debug(f"Processing video {i}/{len(videos_data)}: {video_id}")
                
                # Get detailed info for each video
                detailed_info = self._get_video_details(video_url)
                
                if not detailed_info:
                    failed_details += 1
                    logger.debug(f"Failed to get details for video {video_id}")
                    continue
                
                # Check if video is from last 24 hours
                upload_date = detailed_info.get('upload_date')
                
                if not upload_date or upload_date == 'N/A':
                    missing_upload_date += 1
                    logger.debug(f"Video {video_id} missing upload_date: {upload_date}")
                    continue
                
                logger.debug(f"Video {video_id} upload_date: {upload_date}")
                
                if self._is_recent_video(upload_date):
                    processed_videos.append(detailed_info)
                    logger.debug(f"✓ Video {video_id} added - recent enough")
                else:
                    too_old_videos += 1
                    logger.debug(f"✗ Video {video_id} rejected - too old")
                
            except Exception as e:
                logger.warning(f"Error processing video {video.get('id', 'unknown')}: {str(e)}")
                continue
        
        # Summary logging
        logger.info(f"Video processing summary:")
        logger.info(f"  - Total videos processed: {len(videos_data)}")
        logger.info(f"  - Failed to get details: {failed_details}")
        logger.info(f"  - Missing upload_date: {missing_upload_date}")
        logger.info(f"  - Too old (>1 day): {too_old_videos}")
        logger.info(f"  - Final accepted videos: {len(processed_videos)}")
        
        return processed_videos
    
    def _get_video_details(self, video_url: str) -> Optional[Dict[str, str]]:
        """
        Get detailed information for a specific video.
        
        Args:
            video_url: YouTube video URL
            
        Returns:
            Optional[Dict[str, str]]: Video details or None if failed
        """
        try:
            cmd = [
                'yt-dlp',
                '--print-json',
                '--no-download',
                '--no-playlist',    # Avoid playlist structures that may lack upload dates
                '--flat-playlist',  # Extract metadata without downloading
                '--add-header', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',  # Custom User-Agent to bypass bot detection
                '--extractor-args', 'youtube:player_client=web',  # Use web client to bypass bot detection
                video_url
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            
            if result.returncode == 0:
                video_info = json.loads(result.stdout)
                
                # Debug: Log raw upload_date from yt-dlp
                raw_upload_date = video_info.get('upload_date')
                logger.debug(f"Raw upload_date from yt-dlp for {video_url}: {raw_upload_date}")
                
                # Extract required fields
                video_details = {
                    'title': video_info.get('title', 'N/A'),
                    'description': video_info.get('description', 'N/A')[:500] + '...' if len(video_info.get('description', '')) > 500 else video_info.get('description', 'N/A'),
                    'view_count': str(video_info.get('view_count', 0)),
                    'publish_date': raw_upload_date if raw_upload_date else 'N/A',
                    'video_url': video_url,
                    'channel': video_info.get('uploader', 'N/A'),
                    'duration': str(video_info.get('duration', 0)),
                    'thumbnail': video_info.get('thumbnail', 'N/A')
                }
                
                logger.debug(f"Extracted video details for {video_url}: title={video_details['title'][:50]}..., upload_date={video_details['publish_date']}")
                return video_details
            else:
                logger.warning(f"yt-dlp failed for {video_url}, return code: {result.returncode}, stderr: {result.stderr}")
                return None
            
        except subprocess.TimeoutExpired:
            logger.warning(f"Timeout getting details for {video_url}")
            return None
        except json.JSONDecodeError as e:
            logger.warning(f"JSON decode error for {video_url}: {str(e)}")
            return None
        except Exception as e:
            logger.warning(f"Unexpected error getting details for {video_url}: {str(e)}")
            return None
    
    def _is_recent_video(self, upload_date: str) -> bool:
        """
        Check if video was uploaded within the last 24 hours.
        
        Args:
            upload_date: Upload date string in YYYYMMDD format
            
        Returns:
            bool: True if video is from last 24 hours
        """
        if not upload_date or upload_date == 'N/A':
            logger.debug(f"Invalid upload_date: {upload_date}")
            return False
        
        try:
            # Parse upload date (format: YYYYMMDD)
            upload_datetime = datetime.strptime(upload_date, '%Y%m%d')
            current_time = datetime.now()
            time_difference = current_time - upload_datetime
            
            logger.debug(f"Date comparison: upload={upload_datetime.strftime('%Y-%m-%d')}, "
                        f"current={current_time.strftime('%Y-%m-%d')}, "
                        f"difference={time_difference.days} days")
            
            # Check if uploaded within last 24 hours
            is_recent = time_difference <= timedelta(days=1)
            logger.debug(f"Is recent (<=1 day): {is_recent}")
            
            return is_recent
            
        except ValueError as e:
            logger.warning(f"Invalid date format '{upload_date}': {str(e)}")
            return False
    
    def save_to_csv(self, videos_data: List[Dict[str, str]], filename: str = 'thailand_trending_videos.csv') -> bool:
        """
        Save video data to CSV file.
        
        Args:
            videos_data: List of video dictionaries
            filename: Output CSV filename
            
        Returns:
            bool: True if saved successfully, False otherwise
        """
        if not videos_data:
            logger.warning("No video data to save")
            return False
        
        try:
            with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
                fieldnames = ['title', 'description', 'view_count', 'publish_date', 'video_url', 'channel', 'duration', 'thumbnail']
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                
                # Write header
                writer.writeheader()
                
                # Write video data
                for video in videos_data:
                    writer.writerow(video)
            
            logger.info(f"Successfully saved {len(videos_data)} videos to {filename}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving to CSV: {str(e)}")
            return False
    
    def get_trending_videos(self, save_csv: bool = True, debug: bool = False) -> List[Dict[str, str]]:
        """
        Main method to fetch trending videos and optionally save to CSV.
        
        Args:
            save_csv: Whether to save results to CSV file
            debug: Enable debug logging for troubleshooting
            
        Returns:
            List[Dict[str, str]]: List of video data dictionaries
        """
        # Enable debug logging if requested
        if debug:
            logging.getLogger(__name__).setLevel(logging.DEBUG)
            logger.info("Debug logging enabled")
        
        logger.info("Starting YouTube trending videos fetch for Thailand...")
        
        # Fetch videos
        videos = self.fetch_trending_videos()
        
        if not videos:
            logger.warning("No trending videos found - check the debug logs above for details")
            return []
        
        # Save to CSV if requested
        if save_csv:
            self.save_to_csv(videos)
        
        # Log summary
        logger.info(f"Successfully fetched {len(videos)} trending videos from Thailand")
        
        return videos


def main():
    """
    Main function to demonstrate the YouTube fetcher.
    """
    print("YouTube Trending Videos Fetcher for Thailand")
    print("=" * 50)
    print("Debug mode is enabled to help diagnose any filtering issues")
    print()
    
    # Create fetcher instance
    fetcher = YouTubeTrendingFetcher()
    
    try:
        # Fetch trending videos with debug enabled for troubleshooting
        trending_videos = fetcher.get_trending_videos(save_csv=True, debug=True)
        
        if trending_videos:
            print(f"\nFound {len(trending_videos)} trending videos from last 24 hours:")
            print("-" * 50)
            
            # Display first 5 videos as sample
            for i, video in enumerate(trending_videos[:5], 1):
                print(f"{i}. {video['title']}")
                print(f"   Channel: {video['channel']}")
                print(f"   Views: {video['view_count']:,}" if video['view_count'].isdigit() else f"   Views: {video['view_count']}")
                print(f"   URL: {video['video_url']}")
                print()
            
            if len(trending_videos) > 5:
                print(f"... and {len(trending_videos) - 5} more videos")
            
            print(f"\nData saved to 'thailand_trending_videos.csv'")
            
        else:
            print("No trending videos found from the last 24 hours.")
            
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.")
    except Exception as e:
        print(f"Error: {str(e)}")
        logger.error(f"Unexpected error in main: {str(e)}")


if __name__ == "__main__":
    main() 