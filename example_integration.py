#!/usr/bin/env python3
"""
Integration Example: YouTube Fetcher + Video Summarizer

This example demonstrates how to use the YouTube fetcher and video summarizer
together to fetch trending videos from Thailand and generate Thai-language summaries.
"""

import logging
from typing import List, Dict
import csv

# Import our custom modules
from youtube_fetcher import YouTubeTrendingFetcher
from summarizer import summarize_video_info

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def fetch_and_summarize_trending_videos(save_summaries: bool = True) -> List[Dict[str, str]]:
    """
    Fetch trending videos from Thailand and generate Thai summaries.
    
    Args:
        save_summaries: Whether to save summaries to CSV file
        
    Returns:
        List[Dict[str, str]]: Videos with summaries added
    """
    logger.info("Starting integrated fetch and summarize process...")
    
    # Step 1: Fetch trending videos
    fetcher = YouTubeTrendingFetcher()
    videos = fetcher.get_trending_videos(save_csv=False)  # Don't save yet
    
    if not videos:
        logger.warning("No trending videos found")
        return []
    
    logger.info(f"Found {len(videos)} trending videos, generating summaries...")
    
    # Step 2: Generate summaries for each video
    videos_with_summaries = []
    
    for i, video in enumerate(videos, 1):
        logger.info(f"Processing video {i}/{len(videos)}: {video['title'][:50]}...")
        
        try:
            # Generate Thai summary
            summary = summarize_video_info(video)
            
            # Add summary to video data
            video_with_summary = video.copy()
            video_with_summary['thai_summary'] = summary
            videos_with_summaries.append(video_with_summary)
            
            logger.info(f"✓ Generated summary for video {i}")
            
        except Exception as e:
            logger.error(f"Failed to generate summary for video {i}: {str(e)}")
            # Add video without summary
            video_with_summary = video.copy()
            video_with_summary['thai_summary'] = "สรุปไม่สำเร็จ - เกิดข้อผิดพลาด"
            videos_with_summaries.append(video_with_summary)
    
    # Step 3: Save results if requested
    if save_summaries and videos_with_summaries:
        save_videos_with_summaries(videos_with_summaries)
    
    logger.info(f"Integration complete. Processed {len(videos_with_summaries)} videos")
    return videos_with_summaries


def save_videos_with_summaries(videos: List[Dict[str, str]], filename: str = 'thailand_trending_with_summaries.csv') -> bool:
    """
    Save videos with Thai summaries to CSV file.
    
    Args:
        videos: List of video dictionaries with summaries
        filename: Output CSV filename
        
    Returns:
        bool: True if saved successfully
    """
    try:
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            # Include thai_summary in fieldnames
            fieldnames = ['title', 'description', 'view_count', 'publish_date', 'video_url', 
                         'channel', 'duration', 'thumbnail', 'thai_summary']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            # Write header
            writer.writeheader()
            
            # Write video data with summaries
            for video in videos:
                writer.writerow(video)
        
        logger.info(f"Successfully saved {len(videos)} videos with summaries to {filename}")
        return True
        
    except Exception as e:
        logger.error(f"Error saving videos with summaries: {str(e)}")
        return False


def display_sample_results(videos: List[Dict[str, str]], num_samples: int = 3):
    """
    Display sample results for demonstration.
    
    Args:
        videos: List of video dictionaries with summaries
        num_samples: Number of videos to display
    """
    print("\n" + "=" * 80)
    print("SAMPLE TRENDING VIDEOS WITH THAI SUMMARIES")
    print("=" * 80)
    
    for i, video in enumerate(videos[:num_samples], 1):
        print(f"\n📺 Video #{i}")
        print("-" * 50)
        print(f"Title: {video['title']}")
        print(f"Channel: {video['channel']}")
        print(f"Views: {video['view_count']:,}" if video['view_count'].isdigit() else f"Views: {video['view_count']}")
        print(f"Upload Date: {video['publish_date']}")
        print(f"URL: {video['video_url']}")
        print(f"\n🇹🇭 Thai Summary:")
        print(f"{video['thai_summary']}")
        print()
    
    if len(videos) > num_samples:
        print(f"... and {len(videos) - num_samples} more videos with summaries")


def main():
    """
    Main function demonstrating the integration.
    """
    print("🇹🇭 Thailand YouTube Trending Videos with AI Summaries")
    print("=" * 60)
    print("This script fetches trending YouTube videos from Thailand")
    print("and generates Thai-language summaries using OpenAI GPT.")
    print()
    
    try:
        # Fetch and summarize trending videos
        videos_with_summaries = fetch_and_summarize_trending_videos(save_summaries=True)
        
        if videos_with_summaries:
            # Display sample results
            display_sample_results(videos_with_summaries, num_samples=3)
            
            print(f"\n✅ Complete! Found and summarized {len(videos_with_summaries)} videos")
            print("📁 Results saved to 'thailand_trending_with_summaries.csv'")
            
        else:
            print("❌ No trending videos found or all processing failed")
            
    except KeyboardInterrupt:
        print("\n⚠️  Operation cancelled by user")
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        logger.error(f"Unexpected error in main: {str(e)}")


if __name__ == "__main__":
    main() 