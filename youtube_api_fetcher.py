#!/usr/bin/env python3
"""
YouTube Data API v3 Trending Videos Fetcher for Thailand

This script fetches the top 50 trending videos in Thailand using the official
YouTube Data API v3. It loads the API key from a .env file and handles errors gracefully.

Requirements:
- YouTube Data API v3 key (get from Google Cloud Console)
- python-dotenv library
- requests library
"""

import os
import sys
import requests
from datetime import datetime
from typing import Dict, List, Optional
import json

try:
    from dotenv import load_dotenv
except ImportError:
    print("Error: python-dotenv not installed. Please install it using: pip install python-dotenv")
    sys.exit(1)


class YouTubeAPIFetcher:
    """
    A class to fetch trending videos from Thailand using YouTube Data API v3.
    """
    
    def __init__(self):
        """Initialize the fetcher with API configuration."""
        # Load environment variables
        load_dotenv()
        
        # YouTube Data API v3 configuration
        self.api_key = os.getenv('YOUTUBE_API_KEY')
        self.base_url = 'https://www.googleapis.com/youtube/v3/videos'
        self.max_results = 50
        
        # Validate API key
        if not self.api_key:
            raise ValueError("YouTube API key not found. Please set YOUTUBE_API_KEY in your .env file")
    
    def fetch_trending_videos(self) -> Optional[List[Dict]]:
        """
        Fetch trending videos from Thailand using YouTube Data API v3.
        
        Returns:
            Optional[List[Dict]]: List of video data or None if failed
        """
        print("Fetching trending videos from Thailand using YouTube Data API v3...")
        
        # API request parameters
        params = {
            'key': self.api_key,
            'chart': 'mostPopular',
            'regionCode': 'TH',
            'part': 'snippet,statistics',
            'maxResults': self.max_results
        }
        
        try:
            # Make API request
            print(f"Requesting {self.max_results} trending videos from Thailand...")
            response = requests.get(self.base_url, params=params, timeout=30)
            
            # Check for HTTP errors
            response.raise_for_status()
            
            # Parse JSON response
            data = response.json()
            
            # Check for API errors
            if 'error' in data:
                error_info = data['error']
                print(f"YouTube API Error: {error_info.get('message', 'Unknown error')}")
                print(f"Error Code: {error_info.get('code', 'N/A')}")
                return None
            
            # Extract video items
            videos = data.get('items', [])
            
            if not videos:
                print("No trending videos found in the API response")
                return None
            
            print(f"Successfully fetched {len(videos)} trending videos")
            return videos
            
        except requests.exceptions.Timeout:
            print("Error: Request timed out. Please check your internet connection.")
            return None
        except requests.exceptions.ConnectionError:
            print("Error: Failed to connect to YouTube API. Please check your internet connection.")
            return None
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 403:
                print("Error: Access forbidden. Please check your API key and quota limits.")
                print("Make sure your YouTube Data API v3 is enabled in Google Cloud Console.")
            elif e.response.status_code == 400:
                print("Error: Bad request. Please check the API parameters.")
            else:
                print(f"HTTP Error {e.response.status_code}: {e.response.reason}")
            return None
        except requests.exceptions.RequestException as e:
            print(f"Request error: {str(e)}")
            return None
        except json.JSONDecodeError:
            print("Error: Failed to parse API response as JSON")
            return None
        except Exception as e:
            print(f"Unexpected error: {str(e)}")
            return None
    
    def parse_video_data(self, videos: List[Dict]) -> List[Dict[str, str]]:
        """
        Parse video data from API response into a clean format.
        
        Args:
            videos: Raw video data from YouTube API
            
        Returns:
            List[Dict[str, str]]: Parsed video information
        """
        parsed_videos = []
        
        for i, video in enumerate(videos, 1):
            try:
                # Extract snippet and statistics
                snippet = video.get('snippet', {})
                statistics = video.get('statistics', {})
                
                # Parse published date
                published_at = snippet.get('publishedAt', '')
                try:
                    if published_at:
                        # Convert from ISO format to readable format
                        published_date = datetime.fromisoformat(published_at.replace('Z', '+00:00'))
                        formatted_date = published_date.strftime('%Y-%m-%d %H:%M:%S UTC')
                    else:
                        formatted_date = 'Unknown'
                except Exception:
                    formatted_date = published_at or 'Unknown'
                
                # Format view count
                view_count = statistics.get('viewCount', '0')
                try:
                    view_count_int = int(view_count)
                    formatted_views = f"{view_count_int:,}"
                except (ValueError, TypeError):
                    formatted_views = view_count
                
                # Extract video information
                video_info = {
                    'rank': str(i),
                    'title': snippet.get('title', 'Unknown Title'),
                    'channel': snippet.get('channelTitle', 'Unknown Channel'),
                    'view_count': formatted_views,
                    'published_date': formatted_date,
                    'video_id': video.get('id', 'Unknown'),
                    'description': snippet.get('description', '')[:200] + '...' if len(snippet.get('description', '')) > 200 else snippet.get('description', ''),
                    'duration': self._format_duration(video.get('contentDetails', {}).get('duration', '')),
                    'like_count': statistics.get('likeCount', 'N/A'),
                    'comment_count': statistics.get('commentCount', 'N/A')
                }
                
                parsed_videos.append(video_info)
                
            except Exception as e:
                print(f"Warning: Failed to parse video {i}: {str(e)}")
                continue
        
        return parsed_videos
    
    def _format_duration(self, duration: str) -> str:
        """
        Format ISO 8601 duration (PT1M30S) to readable format (1:30).
        
        Args:
            duration: ISO 8601 duration string
            
        Returns:
            str: Formatted duration
        """
        if not duration or not duration.startswith('PT'):
            return 'Unknown'
        
        try:
            # Remove PT prefix
            duration = duration[2:]
            
            hours = 0
            minutes = 0
            seconds = 0
            
            # Parse hours
            if 'H' in duration:
                hours_str, duration = duration.split('H')
                hours = int(hours_str)
            
            # Parse minutes
            if 'M' in duration:
                minutes_str, duration = duration.split('M')
                minutes = int(minutes_str)
            
            # Parse seconds
            if 'S' in duration:
                seconds_str = duration.replace('S', '')
                seconds = int(seconds_str)
            
            # Format duration
            if hours > 0:
                return f"{hours}:{minutes:02d}:{seconds:02d}"
            else:
                return f"{minutes}:{seconds:02d}"
                
        except Exception:
            return duration
    
    def display_videos(self, videos: List[Dict[str, str]], detailed: bool = False):
        """
        Display video information in a formatted way.
        
        Args:
            videos: List of parsed video dictionaries
            detailed: Whether to show detailed information
        """
        print("\n" + "=" * 100)
        print("🇹🇭 TOP TRENDING VIDEOS IN THAILAND")
        print("=" * 100)
        
        for video in videos:
            print(f"\n📺 #{video['rank']} - {video['title']}")
            print(f"📺 Channel: {video['channel']}")
            print(f"👀 Views: {video['view_count']}")
            print(f"📅 Published: {video['published_date']}")
            
            if detailed:
                print(f"⏱️  Duration: {video['duration']}")
                print(f"👍 Likes: {video['like_count']}")
                print(f"💬 Comments: {video['comment_count']}")
                print(f"🔗 Video ID: {video['video_id']}")
                if video['description']:
                    print(f"📝 Description: {video['description']}")
            
            print("-" * 80)
    
    def save_to_file(self, videos: List[Dict[str, str]], filename: str = 'thailand_trending_api.json'):
        """
        Save video data to JSON file.
        
        Args:
            videos: List of video dictionaries
            filename: Output filename
        """
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(videos, f, ensure_ascii=False, indent=2)
            print(f"\n💾 Data saved to {filename}")
        except Exception as e:
            print(f"Error saving to file: {str(e)}")


def main():
    """
    Main function to demonstrate the YouTube API fetcher.
    """
    print("🎬 YouTube Data API v3 - Thailand Trending Videos Fetcher")
    print("=" * 80)
    
    try:
        # Initialize fetcher
        fetcher = YouTubeAPIFetcher()
        
        # Fetch trending videos
        raw_videos = fetcher.fetch_trending_videos()
        
        if not raw_videos:
            print("❌ Failed to fetch trending videos. Please check the error messages above.")
            return
        
        # Parse video data
        videos = fetcher.parse_video_data(raw_videos)
        
        if not videos:
            print("❌ No videos could be parsed from the API response.")
            return
        
        # Display results
        fetcher.display_videos(videos, detailed=False)
        
        # Save to file
        fetcher.save_to_file(videos)
        
        print(f"\n✅ Successfully fetched and processed {len(videos)} trending videos!")
        print("💡 Tip: Check the saved JSON file for complete data including video IDs and descriptions.")
        
    except ValueError as e:
        print(f"❌ Configuration Error: {str(e)}")
        print("\n💡 Setup Instructions:")
        print("1. Get a YouTube Data API v3 key from Google Cloud Console")
        print("2. Enable YouTube Data API v3 for your project")
        print("3. Create a .env file with: YOUTUBE_API_KEY=your_api_key_here")
    except KeyboardInterrupt:
        print("\n⚠️  Operation cancelled by user.")
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")


if __name__ == "__main__":
    main() 