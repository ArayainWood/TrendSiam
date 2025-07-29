#!/usr/bin/env python3
"""
Enhanced Batch Bilingual Summarizer for YouTube Trending Videos with Real-time Updates

This script loads YouTube video data from thailand_trending_api.json, updates view counts
from YouTube Data API, generates both Thai and English summaries using OpenAI, calculates
popularity scores, and saves the results to thailand_trending_summary.json with progress tracking.

Features:
- Real-time view count updates from YouTube Data API v3
- Loads data from YouTube Data API JSON file
- Generates both Thai and English summaries using OpenAI API
- Calculates popularity scores based on latest engagement metrics
- Progress bar with tqdm for all operations
- Graceful error handling and fallback for API failures
- Rate limit protection with random delays
- CLI support for limiting batch size for testing
- Preserves all original video data plus new fields (summary, summary_en, popularity_score)
- Optimized English summaries with reduced tokens (max_tokens=120, temperature=0.3)
- Secure API key handling via .env file

Security:
- YouTube video ID validation to prevent injection attacks
- Secure API key loading from environment variables
- Comprehensive error handling and fallback mechanisms
- Rate limiting to respect YouTube API quotas
"""

import json
import sys
import logging
import time
import random
import argparse
import os
from typing import List, Dict, Any, Optional
from pathlib import Path

# Configure logging first
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables for API keys
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    logger.warning("python-dotenv not installed. Make sure YOUTUBE_API_KEY is set as environment variable.")

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


class BatchVideoSummarizer:
    """
    A class to process YouTube video data and generate Thai summaries in batches.
    """
    
    def __init__(self, input_file: str = 'thailand_trending_api.json', 
                 output_file: str = 'thailand_trending_summary.json',
                 limit: Optional[int] = None):
        """
        Initialize the batch summarizer.
        
        Args:
            input_file: Path to input JSON file with video data
            output_file: Path to output JSON file for results
            limit: Maximum number of videos to process (None for all)
        """
        self.input_file = input_file
        self.output_file = output_file
        self.limit = limit
        self.videos_data = []
        self.processed_videos = []
        self.success_count = 0
        self.failure_count = 0
        
        # Rate limiting configuration
        self.min_delay = 1.5  # Minimum delay between API calls
        self.max_delay = 3.0  # Maximum delay between API calls
        
        # YouTube API configuration for view count updates
        self.youtube_api_key = os.getenv('YOUTUBE_API_KEY')
        self.youtube_base_url = 'https://www.googleapis.com/youtube/v3/videos'
        self.view_count_updated = 0
        self.view_count_failed = 0
    
    def load_video_data(self) -> bool:
        """
        Load video data from the input JSON file.
        
        Returns:
            bool: True if loaded successfully, False otherwise
        """
        input_path = Path(self.input_file)
        
        if not input_path.exists():
            print(f"❌ Error: Input file '{self.input_file}' not found.")
            print("💡 Make sure you've run youtube_api_fetcher.py first to generate the data.")
            return False
        
        try:
            with open(input_path, 'r', encoding='utf-8') as f:
                all_videos = json.load(f)
            
            if not isinstance(all_videos, list):
                print(f"❌ Error: Expected a list in {self.input_file}, got {type(all_videos).__name__}")
                return False
            
            if not all_videos:
                print(f"❌ Error: No video data found in {self.input_file}")
                return False
            
            # Apply limit if specified
            if self.limit and self.limit > 0:
                self.videos_data = all_videos[:self.limit]
                print(f"✅ Loaded {len(self.videos_data)} videos from {self.input_file} (limited to first {self.limit})")
            else:
                self.videos_data = all_videos
                print(f"✅ Loaded {len(self.videos_data)} videos from {self.input_file}")
            
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
    
    def save_results(self) -> bool:
        """
        Save processed videos with summaries to output JSON file.
        
        Returns:
            bool: True if saved successfully, False otherwise
        """
        if not self.processed_videos:
            print("❌ No processed videos to save")
            return False
        
        try:
            if self._save_to_file(self.output_file):
                output_path = Path(self.output_file)
                print(f"💾 Results saved to {self.output_file}")
                print(f"📁 File size: {output_path.stat().st_size / 1024:.1f} KB")
                return True
            else:
                print(f"❌ Error saving results to {self.output_file}")
                return False
            
        except Exception as e:
            print(f"❌ Error saving results: {str(e)}")
            return False
    
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
                print("🤖 Generating AI images for top 3 stories...")
                print(f"🔑 OpenAI API key found: {openai_api_key[:12]}...{openai_api_key[-4:]}")
                
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
                        
                        # Generate contextual prompt using the improved method
                        print(f"🧠 Generating prompt for Rank #{i+1}...")
                        prompt = generator.generate_realistic_editorial_prompt(story)
                        print(f"✅ Generated prompt ({len(prompt)} chars)")
                        print(f"📄 Prompt preview: {prompt[:150]}...")
                        
                        # Check if image file already exists
                        image_filename = f"ai_generated_images/image_{i+1}.png"
                        print(f"🔍 Checking for existing image: {image_filename}")
                        
                        if os.path.exists(image_filename):
                            print(f"✅ Using existing image: {image_filename}")
                            # Add fields to the story
                            story['ai_image_local'] = image_filename
                            story['ai_image_url'] = f"./ai_generated_images/image_{i+1}.png"
                            story['ai_image_prompt'] = prompt
                            generated_count += 1
                        else:
                            print(f"🎨 Generating new image for Rank #{i+1}...")
                            # Generate image with DALL-E
                            image_url = generator.generate_image_with_dalle(prompt, size="1024x1024")
                            
                            if image_url:
                                print(f"✅ DALL-E generated image URL: {image_url[:60]}...")
                                # Download and save image locally
                                local_path = generator.download_and_save_image(image_url, f"image_{i+1}.png")
                                
                                if local_path:
                                    # Add fields to the story
                                    story['ai_image_local'] = local_path
                                    story['ai_image_url'] = f"./ai_generated_images/image_{i+1}.png"
                                    story['ai_image_prompt'] = prompt
                                    print(f"✅ Successfully generated and saved Rank #{i+1} image: {local_path}")
                                    generated_count += 1
                                else:
                                    print(f"❌ Failed to save Rank #{i+1} image locally")
                            else:
                                print(f"❌ DALL-E failed to generate Rank #{i+1} image")
                        
                        # Add delay between API calls
                        if i < len(top3_stories) - 1:
                            import time
                            print("⏳ Waiting 3 seconds before next generation...")
                            time.sleep(3)
                            
                    except Exception as e:
                        print(f"❌ ERROR processing Rank #{i+1} story: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        # Continue with next story
                
                print(f"\n📊 AI Image Generation Summary:")
                print(f"   Successfully processed: {generated_count}/{len(top3_stories)} images")
                print(f"   Target files: image_1.png, image_2.png, image_3.png")
                        
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
                
                # For top 3, fields should already be set above
                if position <= 3 and video.get('ai_image_prompt'):
                    # Top 3 story with AI generation completed
                    print(f"   ✅ Rank #{position}: AI fields already set")
                else:
                    # Check if corresponding image file exists for manual mapping
                    image_filename = f"ai_generated_images/image_{position}.png"
                    if os.path.exists(image_filename):
                        if not video.get('ai_image_local'):
                            video['ai_image_local'] = image_filename
                        if not video.get('ai_image_url'):
                            video['ai_image_url'] = f"./ai_generated_images/image_{position}.png"
                        print(f"   ✅ Rank #{position}: Mapped to existing image")
                    else:
                        # No image available - set to None for consistency
                        if not video.get('ai_image_local'):
                            video['ai_image_local'] = None
                        if not video.get('ai_image_url'):
                            video['ai_image_url'] = None
                        if position <= 3:
                            print(f"   ⚠️ Rank #{position}: Expected image missing")
                
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
        print("🇹🇭 Batch Thai Video Summarizer")
        print("=" * 60)
        
        # Step 1: Load video data
        if not self.load_video_data():
            return False
        
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
        print(f"📂 Output file: {self.output_file}")
        print(f"🌐 Each video now includes:")
        print(f"   • Latest view counts from YouTube API")
        print(f"   • 'summary' (Thai) and 'summary_en' (English)")
        print(f"   • Popularity scores and category classification")
        print(f"   • Auto-category classification ('auto_category' field)")
        print(f"   • AI image fields ('ai_image_local' and 'ai_image_url')")
        
        return True


def parse_arguments() -> argparse.Namespace:
    """
    Parse command line arguments.
    
    Returns:
        argparse.Namespace: Parsed arguments
    """
    parser = argparse.ArgumentParser(
        description="Batch bilingual summarizer for YouTube trending videos (Thai + English) with real-time view count updates",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Features:
  • Updates view counts from YouTube Data API before processing
  • Generates Thai and English summaries using OpenAI API
  • Calculates popularity scores and category classification
  • Secure API key handling via .env file

Examples:
  python summarize_all.py                    # Process all videos with view count updates and bilingual summaries
  python summarize_all.py --limit 5          # Process first 5 videos only
  python summarize_all.py --limit 10 --input my_videos.json

Prerequisites:
  • YOUTUBE_API_KEY in .env file (for view count updates)
  • OPENAI_API_KEY in .env file (for summaries)
        """
    )
    
    parser.add_argument(
        '--input', '-i',
        default='thailand_trending_api.json',
        help='Input JSON file with video data (default: thailand_trending_api.json)'
    )
    
    parser.add_argument(
        '--output', '-o',
        default='thailand_trending_summary.json',
        help='Output JSON file for results (default: thailand_trending_summary.json)'
    )
    
    parser.add_argument(
        '--limit', '-l',
        type=int,
        help='Maximum number of videos to process (for testing). If not specified, all videos will be processed.'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging'
    )
    
    return parser.parse_args()


def main():
    """
    Main function to run the batch summarizer with CLI support.
    """
    try:
        # Parse command line arguments
        args = parse_arguments()
        
        # Set logging level
        if args.verbose:
            logging.getLogger().setLevel(logging.DEBUG)
            logger.info("Verbose logging enabled")
        
        # Validate limit argument
        if args.limit is not None and args.limit <= 0:
            print("❌ Error: --limit must be a positive integer")
            sys.exit(1)
        
        # Show configuration
        print("🌐 Batch Bilingual Video Summarizer with Real-time Updates")
        print("=" * 65)
        print(f"📂 Input file: {args.input}")
        print(f"📁 Output file: {args.output}")
        
        if args.limit:
            print(f"🔢 Video limit: {args.limit} (testing mode)")
        else:
            print("🔢 Video limit: All videos")
        
        print("📊 View counts: Updated from YouTube Data API")
        print("🇹🇭 Thai summaries: Full descriptions using original settings")
        print("🇺🇸 English summaries: Concise 1-2 sentences (max_tokens=120, temperature=0.3)")
        print("🔥 Popularity scores: Calculated based on latest engagement metrics")
        print()
        
        # Create and run the batch summarizer
        summarizer = BatchVideoSummarizer(
            input_file=args.input,
            output_file=args.output,
            limit=args.limit
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