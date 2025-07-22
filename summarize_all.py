#!/usr/bin/env python3
"""
Batch Bilingual Summarizer for YouTube Trending Videos

This script loads YouTube video data from thailand_trending_api.json,
generates both Thai and English summaries for each video using OpenAI, 
and saves the results to thailand_trending_summary.json with progress tracking.

Features:
- Loads data from YouTube Data API JSON file
- Generates both Thai and English summaries using OpenAI API
- Progress bar with tqdm
- Graceful error handling for API failures
- Rate limit protection with random delays
- CLI support for limiting batch size for testing
- Preserves all original video data plus new summary fields (summary + summary_en)
- Optimized English summaries with reduced tokens (max_tokens=120, temperature=0.3)
"""

import json
import sys
import logging
import time
import random
import argparse
from typing import List, Dict, Any, Optional
from pathlib import Path

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

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


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
        
        # Step 2: Process all videos
        if not self.process_all_videos():
            return False
        
        # Step 3: Add popularity scores
        print("\n🔥 Adding popularity scores...")
        self.processed_videos = add_popularity_scores(self.processed_videos)
        
        # Step 4: Save results
        if not self.save_results():
            return False
        
        # Step 5: Display sample results
        self.display_sample_results()
        
        # Success message
        success_rate = (self.success_count / len(self.processed_videos)) * 100 if self.processed_videos else 0
        print(f"\n🎉 Bilingual batch processing completed!")
        print(f"📈 Success rate: {success_rate:.1f}% (videos with at least one successful summary)")
        print(f"📂 Output file: {self.output_file}")
        print(f"🌐 Each video now includes 'summary' (Thai), 'summary_en' (English), and popularity scores")
        
        return True


def parse_arguments() -> argparse.Namespace:
    """
    Parse command line arguments.
    
    Returns:
        argparse.Namespace: Parsed arguments
    """
    parser = argparse.ArgumentParser(
        description="Batch bilingual summarizer for YouTube trending videos (Thai + English)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python summarize_all.py                    # Process all videos with bilingual summaries
  python summarize_all.py --limit 5          # Process first 5 videos only
  python summarize_all.py --limit 10 --input my_videos.json
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
        print("🌐 Batch Bilingual Video Summarizer (Thai + English)")
        print("=" * 60)
        print(f"📂 Input file: {args.input}")
        print(f"📁 Output file: {args.output}")
        
        if args.limit:
            print(f"🔢 Video limit: {args.limit} (testing mode)")
        else:
            print("🔢 Video limit: All videos")
        
        print("🇹🇭 Thai summaries: Full descriptions using original settings")
        print("🇺🇸 English summaries: Concise 1-2 sentences (max_tokens=120, temperature=0.3)")
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