#!/usr/bin/env python3
"""
AI Image Generator for TrendSiam News

This module handles AI-powered editorial illustration generation
for trending Thai news using OpenAI DALL-E API.
"""

import json
import os
import shutil
import requests
from pathlib import Path
from typing import List, Dict, Any, Optional, Literal
import openai
from openai import OpenAI
import time
import logging
import re
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TrendSiamImageGenerator:
    """AI Image Generator for TrendSiam Editorial Illustrations"""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the image generator with OpenAI API key.
        
        Args:
            api_key: OpenAI API key. If None, will try to get from environment or .env file.
        """
        # Try to get API key from multiple sources
        self.api_key = api_key or os.getenv('OPENAI_API_KEY')
        
        if not self.api_key:
            raise ValueError(
                "OpenAI API key is required. Please provide it in one of these ways:\n"
                "1. Pass api_key parameter directly\n"
                "2. Set OPENAI_API_KEY environment variable\n"
                "3. Create a .env file with OPENAI_API_KEY=your-key-here\n"
                "4. Use the Streamlit admin panel to enter the key"
            )
        
        # Validate API key format (basic check)
        if not self.api_key.startswith('sk-'):
            logger.warning("API key doesn't start with 'sk-'. Please verify it's a valid OpenAI API key.")
        
        try:
            self.client = OpenAI(api_key=self.api_key)
            logger.info("OpenAI client initialized successfully")
        except Exception as e:
            raise ValueError(f"Failed to initialize OpenAI client: {str(e)}")
        
        self.data_file = "thailand_trending_summary.json"
        
        # Set up images directory for local image storage
        self.images_dir = Path("ai_generated_images")
        self.images_dir.mkdir(exist_ok=True)
        logger.info(f"Images directory ready: {self.images_dir.absolute()}")

    def extract_thai_keywords(self, text: str) -> List[str]:
        """
        Extract meaningful Thai keywords from text for better prompt generation.
        
        Args:
            text: Thai text to extract keywords from
            
        Returns:
            List of relevant Thai keywords
        """
        if not text:
            return []
        
        # Common Thai words to filter out
        stop_words = {
            'ที่', 'และ', 'ใน', 'กับ', 'ของ', 'เป็น', 'มี', 'จาก', 'ไป', 'มา', 
            'แล้ว', 'ได้', 'ถูก', 'ให้', 'นี้', 'นั้น', 'นี่', 'นั่น', 'อะไร', 
            'ไหน', 'ทำไม', 'เมื่อไหร่', 'ยังไง', 'แค่', 'เท่านั้น', 'เพียง'
        }
        
        # Extract Thai words (including emojis and numbers)
        words = re.findall(r'[\u0E00-\u0E7F\w\d🏀🎵🕹️🏛️🎓🌿💰❤️📺🔴🎨⚡]+', text.lower())
        
        # Filter meaningful keywords (length > 2 and not stop words)
        keywords = [word for word in words if len(word) > 2 and word not in stop_words]
        
        return keywords[:5]  # Return top 5 keywords

    def generate_realistic_editorial_prompt(self, news_item: Dict[str, Any]) -> str:
        """
        Generate realistic editorial illustration prompts based on actual news content.
        Creates photojournalistic-style scenes depicting real people, events, and locations.
        
        Args:
            news_item: Dictionary containing news data
            
        Returns:
            Detailed prompt for creating realistic editorial-style illustration
        """
        # Get news details - prioritize English summary for clarity
        title = news_item.get('title', '')
        summary_en = news_item.get('summary_en', '')
        summary_th = news_item.get('summary', '')
        category = news_item.get('auto_category', '')
        channel = news_item.get('channel', '')
        
        # Use English summary if available, fall back to Thai
        summary = summary_en if summary_en and not summary_en.startswith('Summary failed') else summary_th
        
        # Base realistic editorial style template
        base_style = (
            "Realistic editorial illustration in photojournalistic style, 1024x1024 format. "
            "Professional news photography composition adapted as detailed illustration. "
            "Show actual people, real scenes, and specific events described in the news. "
            "Avoid abstract art, symbols, or metaphors. "
        )
        
        # Generate content-specific realistic scenes based on actual news content
        
        # VOLLEYBALL/SPORTS NEWS
        if any(keyword in title.lower() + summary.lower() for keyword in ['volleyball', 'วอลเลย์บอล', 'vnl', 'ไทย พบ', 'thailand']):
            if 'thailand' in summary.lower() and 'canada' in summary.lower():
                return (f"{base_style}Wide shot of an intense volleyball match in progress. "
                       "Thai national team players in red and white uniforms mid-action - one player jumping high to spike the ball over the net, "
                       "while Canadian players in red uniforms attempt to block. Professional indoor volleyball arena with spectators in the background. "
                       "Players show athletic determination and competitive spirit. Capture the exact moment of the spike with the ball in motion. "
                       "Arena lighting highlights the action, with team benches and officials visible.")
            else:
                return (f"{base_style}Dynamic volleyball scene showing players in team uniforms during an intense rally. "
                       "Athletes jumping, diving, and coordinating on a professional volleyball court. "
                       "Spectators in arena stands, coaches on sidelines, scoreboard visible. "
                       "Captures the athletic skill and teamwork of competitive volleyball.")
        
        # FOOTBALL/SOCCER NEWS  
        elif any(keyword in title.lower() + summary.lower() for keyword in ['football', 'ฟุตบอล', 'chelsea', 'psg', 'fifa', 'premier league']):
            if 'chelsea' in summary.lower() and 'psg' in summary.lower():
                return (f"{base_style}Epic soccer match scene from FIFA Club World Cup Final. "
                       "Chelsea players in blue uniforms and PSG players in navy blue competing for the ball on a professional football pitch. "
                       "Mid-action shot with players running, tackling, and positioning. Stadium packed with enthusiastic fans, "
                       "floodlights illuminating the night match. Referee and linesmen visible, FIFA branding on stadium displays.")
            else:
                return (f"{base_style}Professional football match in action. Players in team uniforms competing on a well-maintained pitch. "
                       "Stadium filled with supporters, coaching staff on sidelines, match officials monitoring the game. "
                       "Captures the intensity and skill of competitive football.")
        
        # K-POP/MUSIC NEWS
        elif any(keyword in title.lower() + summary.lower() for keyword in ['blackpink', 'music', 'mv', 'เพลง', 'jump']):
            if 'blackpink' in summary.lower():
                return (f"{base_style}BLACKPINK performing live on a spectacular concert stage. "
                       "Four members in stylish performance outfits singing and dancing under dramatic stage lighting with LED screens. "
                       "Thousands of enthusiastic fans with light sticks (bong) creating a sea of pink lights in the darkened arena. "
                       "Professional concert setup with multiple cameras, backup dancers, and pyrotechnics. "
                       "Captures the energy and scale of a major K-pop concert performance.")
            else:
                return (f"{base_style}Live music performance showing artists on stage with full lighting and sound setup. "
                       "Enthusiastic audience with hands raised, professional concert venue with stage effects. "
                       "Musicians with instruments and microphones, capturing the live music experience.")
        
        # GAMING/STREAMING NEWS
        elif any(keyword in title.lower() + summary.lower() for keyword in ['minecraft', 'gaming', 'เกม', 'brainrot', 'round', 'shorts', 'streamer']):
            if 'brainrot' in summary.lower() or 'round' in summary.lower():
                return (f"{base_style}Professional gaming streamer setup in action. "
                       "Content creator at a high-end gaming desk with multiple monitors displaying gameplay, "
                       "mechanical RGB keyboard, gaming mouse, and professional microphone. "
                       "Chat messages and viewer count visible on secondary screens, LED lighting creating ambient gaming atmosphere. "
                       "Shows the modern world of competitive gaming and live streaming content creation.")
            elif 'minecraft' in summary.lower():
                return (f"{base_style}Gaming content creator recording Minecraft gameplay. "
                       "Person at computer setup with Minecraft world visible on main monitor, "
                       "recording equipment and gaming peripherals on desk. Room setup optimized for content creation "
                       "with good lighting and organized gaming space. Captures the popular gaming content creation scene.")
            else:
                return (f"{base_style}Modern gaming environment with person engaged in video game. "
                       "Gaming setup with monitors, controllers, and gaming accessories. "
                       "Shows the contemporary digital entertainment and gaming culture.")
        
        # ANIME/ENTERTAINMENT NEWS
        elif any(keyword in title.lower() + summary.lower() for keyword in ['anime', 'อนิเมะ', 'gachiakuta', 'ani-one']):
            return (f"{base_style}Anime viewing experience showing people watching Japanese animation. "
                   "Screen displaying colorful anime scenes with subtitles, viewers engaged with the content. "
                   "Modern entertainment setup representing the popularity of anime content. "
                   "Captures the global reach of Japanese animation and its dedicated fanbase.")
        
        # POLITICAL/NEWS
        elif "การเมือง" in category or any(keyword in summary.lower() for keyword in ['government', 'political', 'minister', 'election']):
            return (f"{base_style}Political news scene showing officials at press conference or government meeting. "
                   "Politicians or government representatives at podium with microphones, "
                   "journalists with cameras and recording equipment, official government setting. "
                   "Captures the formal atmosphere of political news and democratic processes.")
        
        # BUSINESS/FINANCE
        elif "ธุรกิจ" in category or any(keyword in summary.lower() for keyword in ['business', 'economic', 'financial', 'market']):
            return (f"{base_style}Business news scene in modern office or financial district. "
                   "Professionals in business attire discussing charts and financial data, "
                   "stock market displays, corporate meeting rooms or trading floor environment. "
                   "Represents the world of business and economic activity.")
        
        # HEALTH/MEDICAL
        elif "สุขภาพ" in category or any(keyword in summary.lower() for keyword in ['health', 'medical', 'doctor', 'hospital']):
            return (f"{base_style}Healthcare scene showing medical professionals in hospital or clinic setting. "
                   "Doctors, nurses, or healthcare workers in medical environment with patients, "
                   "medical equipment and clean healthcare facilities. "
                   "Represents modern healthcare and medical news stories.")
        
        # EDUCATION
        elif "การศึกษา" in category or any(keyword in summary.lower() for keyword in ['education', 'school', 'university', 'student']):
            return (f"{base_style}Educational scene in classroom, lecture hall, or academic setting. "
                   "Students and teachers engaged in learning activities, "
                   "educational materials and modern learning environment. "
                   "Captures the importance of education and academic achievement.")
        
        # GENERIC NEWS (fallback)
        else:
            # Analyze summary content for specific scene details
            summary_lower = summary.lower()
            
            if 'live' in summary_lower or 'streaming' in summary_lower:
                return (f"{base_style}Live streaming or broadcast scene. "
                       "People engaged in live content creation or viewing, "
                       "professional broadcasting equipment, modern media environment. "
                       "Shows the contemporary digital media landscape.")
            
            elif 'competition' in summary_lower or 'contest' in summary_lower:
                return (f"{base_style}Competitive event scene with participants and audience. "
                       "People engaged in competition or contest activity, "
                       "organized event setting with spectators and officials. "
                       "Captures the spirit of competition and achievement.")
            
            else:
                return (f"{base_style}General news scene depicting people engaged in the described activity. "
                       "Realistic portrayal of the events mentioned in the news story, "
                       "showing actual people, locations, and activities. "
                       "Professional news photography style capturing real-world events.")

    # Keep old function name for compatibility
    def generate_editorial_illustration_prompt(self, news_item: Dict[str, Any]) -> str:
        """Wrapper for backward compatibility - calls the new realistic prompt generator"""
        return self.generate_realistic_editorial_prompt(news_item)

    def load_news_data(self) -> List[Dict[str, Any]]:
        """
        Load news data from JSON file.
        
        Returns:
            List of news items or empty list if file not found
        """
        try:
            data_path = Path(self.data_file)
            if not data_path.exists():
                logger.error(f"Data file not found: {self.data_file}")
                return []
            
            with open(data_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if not isinstance(data, list):
                logger.error("Invalid data format: expected list of news items")
                return []
            
            logger.info(f"Loaded {len(data)} news items from {self.data_file}")
            return data
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            return []
        except Exception as e:
            logger.error(f"Error loading news data: {e}")
            return []

    def save_news_data(self, news_data: List[Dict[str, Any]]) -> bool:
        """
        Save updated news data back to JSON file.
        
        Args:
            news_data: List of news items with updated image URLs
            
        Returns:
            True if successful, False otherwise
        """
        try:
            with open(self.data_file, 'w', encoding='utf-8') as f:
                json.dump(news_data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"Successfully saved updated news data to {self.data_file}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving news data: {e}")
            return False

    def get_image_filename(self, index: int) -> str:
        """
        Generate consistent filename for news item image.
        
        Args:
            index: Index of the news item (1-based)
            
        Returns:
            Filename string (e.g., "image_1.png")
        """
        return f"image_{index}.png"

    def delete_existing_image_files(self) -> None:
        """
        Delete all existing AI-generated image files before creating new ones.
        This ensures no stale images remain from previous generations.
        """
        try:
            deleted_count = 0
            
            # Delete numbered image files (image_1.png, image_2.png, etc.)
            for i in range(1, 11):  # Check up to 10 possible images
                image_path = self.images_dir / self.get_image_filename(i)
                if image_path.exists():
                    image_path.unlink()
                    logger.info(f"🗑️ Deleted existing image: {image_path.name}")
                    deleted_count += 1
            
            # Also check for any other .png files in the directory
            for image_file in self.images_dir.glob("*.png"):
                if image_file.name.startswith("image_"):
                    image_file.unlink()
                    logger.info(f"🗑️ Deleted existing image: {image_file.name}")
                    deleted_count += 1
            
            if deleted_count > 0:
                logger.info(f"✅ Deleted {deleted_count} existing image files")
            else:
                logger.info("ℹ️ No existing image files to delete")
                
        except Exception as e:
            logger.error(f"Error deleting existing image files: {e}")

    def download_and_save_image(self, image_url: str, filename: str) -> Optional[str]:
        """
        Download image from URL and save it locally.
        
        Args:
            image_url: URL of the image to download
            filename: Local filename to save as
            
        Returns:
            Local file path if successful, None otherwise
        """
        try:
            # Download the image
            response = requests.get(image_url, timeout=30)
            response.raise_for_status()
            
            # Save to local file
            local_path = self.images_dir / filename
            with open(local_path, 'wb') as f:
                f.write(response.content)
            
            logger.info(f"💾 Downloaded and saved image: {filename}")
            return str(local_path)
            
        except requests.RequestException as e:
            logger.error(f"Failed to download image from {image_url}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error saving image {filename}: {e}")
            return None

    def generate_image_with_dalle(self, prompt: str, size: Literal["1024x1024", "1792x1024", "1024x1792", "1536x1024", "1024x1536", "256x256", "512x512"] = "1024x1024") -> Optional[str]:
        """
        Generate an image using OpenAI DALL-E API.
        
        Args:
            prompt: Text prompt for image generation
            size: Image size (1024x1024, 1792x1024, or 1024x1792)
            
        Returns:
            Image URL if successful, None otherwise
        """
        try:
            # Truncate prompt for logging while preserving full prompt for generation
            log_prompt = prompt[:100] + "..." if len(prompt) > 100 else prompt
            logger.info(f"Generating image with DALL-E 3. Prompt: {log_prompt}")
            logger.info(f"Image size: {size}, Quality: standard")
            
            response = self.client.images.generate(
                model="dall-e-3",
                prompt=prompt,
                size=size,
                quality="standard",
                n=1,
            )
            
            if response.data and len(response.data) > 0:
                image_url = response.data[0].url
                logger.info(f"Successfully generated image: {image_url}")
                return image_url
            else:
                logger.error("No image data returned from DALL-E API")
                return None
                
        except openai.RateLimitError as e:
            logger.error(f"Rate limit exceeded: {e}")
            return None
        except openai.AuthenticationError as e:
            logger.error(f"Authentication failed - check your API key: {e}")
            return None
        except openai.PermissionDeniedError as e:
            logger.error(f"Permission denied - check your API key has DALL-E access: {e}")
            return None
        except openai.APIError as e:
            logger.error(f"OpenAI API error: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error generating image: {e}")
            return None

    def get_top3_news_by_popularity(self, news_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Get top 3 news items sorted by popularity score.
        
        Args:
            news_data: List of all news items
            
        Returns:
            List of top 3 news items by popularity
        """
        # Filter news items that have popularity scores
        scored_news = [
            item for item in news_data 
            if item.get('popularity_score') is not None
        ]
        
        if not scored_news:
            # Fallback to first 3 items if no popularity scores
            logger.warning("No popularity scores found, using first 3 news items")
            return news_data[:3]
        
        # Sort by popularity score (descending)
        sorted_news = sorted(
            scored_news, 
            key=lambda x: int(x.get('popularity_score', 0)), 
            reverse=True
        )
        
        top3 = sorted_news[:3]
        logger.info(f"Selected top 3 news items with popularity scores: {[item.get('popularity_score') for item in top3]}")
        
        return top3

    def generate_ai_images_for_top3_news(self) -> Dict[str, Any]:
        """
        Generate AI images for the top 3 most popular news items.
        Automatically deletes existing image files before generating new ones.
        
        Returns:
            Dictionary containing success status, message, and processed items count
        """
        logger.info("Starting AI image generation for top 3 news items...")
        
        # Delete existing image files first to ensure fresh generation
        logger.info("🗑️ Cleaning up existing image files...")
        self.delete_existing_image_files()
        
        # Load news data
        news_data = self.load_news_data()
        if not news_data:
            return {
                "success": False,
                "message": "Failed to load news data",
                "processed": 0
            }
        
        # Get top 3 news items
        top3_news = self.get_top3_news_by_popularity(news_data)
        if not top3_news:
            return {
                "success": False,
                "message": "No news items found for processing",
                "processed": 0
            }
        
        processed_count = 0
        successful_generations = 0
        
        # Generate images for each top news item
        for i, news_item in enumerate(top3_news):
            try:
                news_title = news_item.get('title', 'Untitled')
                news_category = news_item.get('auto_category', 'Unknown')
                news_popularity = news_item.get('popularity_score', 'No score')
                
                logger.info(f"\n--- Processing Item {i+1}/3 ---")
                logger.info(f"Title: {news_title[:60]}...")
                logger.info(f"Category: {news_category}")
                logger.info(f"Popularity: {news_popularity}")
                
                # Generate content-specific illustration prompt
                prompt = self.generate_editorial_illustration_prompt(news_item)
                logger.info(f"Generated prompt length: {len(prompt)} characters")
                
                # Generate image with DALL-E (using 1024x1024 for better web display)
                image_url = self.generate_image_with_dalle(prompt, size="1024x1024")
                
                if image_url:
                    # Generate consistent filename for this news item
                    filename = self.get_image_filename(i + 1)
                    
                    # Download and save image locally
                    local_path = self.download_and_save_image(image_url, filename)
                    
                    # Find the original item in news_data and update it
                    for original_item in news_data:
                        if original_item.get('title') == news_title:
                            original_item['ai_image_url'] = image_url  # Keep original URL
                            original_item['ai_image_local'] = local_path  # Add local path
                            original_item['ai_image_prompt'] = prompt
                            logger.info(f"✓ Updated news item with AI image URL and local path")
                            break
                    
                    successful_generations += 1
                    logger.info(f"✅ Successfully generated and saved image {i+1}/3 as {filename}")
                else:
                    logger.error(f"❌ Failed to generate image {i+1}/3")
                
                processed_count += 1
                
                # Add delay between API calls to respect rate limits (2-3 seconds)
                if i < len(top3_news) - 1:  # Don't delay after the last item
                    logger.info("⏳ Waiting 3 seconds before next generation...")
                    time.sleep(3)
                    
            except Exception as e:
                logger.error(f"❌ Error processing news item {i+1}: {str(e)}")
                processed_count += 1
        
        # Save updated news data
        if successful_generations > 0:
            save_success = self.save_news_data(news_data)
            if not save_success:
                return {
                    "success": False,
                    "message": f"Generated {successful_generations} images but failed to save data",
                    "processed": processed_count
                }
        
        return {
            "success": successful_generations > 0,
            "message": f"Successfully generated {successful_generations}/{processed_count} AI images for top news items",
            "processed": processed_count,
            "successful": successful_generations
        }


def generate_ai_images_for_top3_news(api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Convenience function to generate AI images for top 3 news items.
    
    Args:
        api_key: OpenAI API key. If None, will try to get from environment.
        
    Returns:
        Dictionary containing success status and details
    """
    try:
        generator = TrendSiamImageGenerator(api_key)
        return generator.generate_ai_images_for_top3_news()
    except Exception as e:
        logger.error(f"Error in generate_ai_images_for_top3_news: {e}")
        return {
            "success": False,
            "message": f"Error: {str(e)}",
            "processed": 0
        }


if __name__ == "__main__":
    # Example usage
    import sys
    
    # Check if API key is provided as command line argument
    api_key = sys.argv[1] if len(sys.argv) > 1 else None
    
    print("🎨 TrendSiam AI Image Generator")
    print("=" * 50)
    
    # Generate images
    result = generate_ai_images_for_top3_news(api_key)
    
    print(f"Success: {result['success']}")
    print(f"Message: {result['message']}")
    print(f"Processed: {result.get('processed', 0)} items")
    
    if result['success']:
        print("✅ AI images generated successfully!")
        print("Images will now appear in the TrendSiam app.")
    else:
        print("❌ Failed to generate AI images.")
        print("Check your OpenAI API key and internet connection.") 