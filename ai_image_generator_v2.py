#!/usr/bin/env python3
"""
AI Image Generator v2 for TrendSiam News with Persistence Guarantees

This module implements the strict image persistence policy:
- Never delete or overwrite valid existing images
- Generate new images only when missing/invalid or explicitly forced
- Stable story_id-based image mapping
- Top-3 image validation with retry logic
"""

import json
import os
import shutil
import requests
from pathlib import Path
from typing import List, Dict, Any, Optional, Literal, Tuple
import openai
from openai import OpenAI
import time
import logging
import re
import html
import unicodedata
from dotenv import load_dotenv
import hashlib
from datetime import datetime, timezone

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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


def get_precise_score(item):
    """Get the most precise popularity score available for an item."""
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


def sanitize_prompt_text(text: str) -> str:
    """Sanitize text for use in AI prompts."""
    if not text or not isinstance(text, str):
        return ""
    
    try:
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', '', text)
        
        # Decode HTML entities
        text = html.unescape(text)
        
        # Normalize unicode characters
        text = unicodedata.normalize('NFKC', text)
        
        # Remove dangerous characters and symbols that might confuse AI
        text = re.sub(r'[^\u0E00-\u0E7F\w\s\.,!?\-\(\):;\'\"]+', ' ', text)
        
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        
        # Truncate to reasonable length
        max_length = 800
        if len(text) > max_length:
            text = text[:max_length].rsplit(' ', 1)[0] + '...'
        
        return text
        
    except Exception as e:
        logger.warning(f"Error sanitizing text: {e}")
        return "news content"


class TrendSiamImageGeneratorV2:
    """
    Enhanced AI Image Generator with Persistence Guarantees.
    
    Implements strict image persistence policy:
    - Never deletes or overwrites valid existing images
    - Stable story_id-based image mapping
    - Only generates when missing/invalid or explicitly forced
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize the image generator with OpenAI API key."""
        self.api_key = api_key or os.getenv('OPENAI_API_KEY')
        
        if not self.api_key:
            raise ValueError("OpenAI API key is required")
        
        if not self.api_key.startswith('sk-'):
            logger.warning("API key doesn't start with 'sk-'. Please verify it's valid.")
        
        try:
            self.client = OpenAI(api_key=self.api_key)
            logger.info("OpenAI client initialized successfully")
        except Exception as e:
            raise ValueError(f"Failed to initialize OpenAI client: {str(e)}")
        
        # Set up image directories with story_id-based naming
        self.backend_images_dir = Path("ai_generated_images")
        self.frontend_images_dir = Path("frontend/public/ai_generated_images")
        self.backend_images_dir.mkdir(exist_ok=True)
        self.frontend_images_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Image directories ready:")
        logger.info(f"  Backend: {self.backend_images_dir.absolute()}")
        logger.info(f"  Frontend: {self.frontend_images_dir.absolute()}")
    
    def get_story_image_path(self, story_id: str) -> str:
        """
        Generate consistent image file path for a story.
        
        Args:
            story_id: Story identifier
            
        Returns:
            Path to image file in frontend directory
        """
        return str(self.frontend_images_dir / f"{story_id}.webp")
    
    def check_existing_image(self, story_id: str) -> Tuple[bool, Optional[str], str]:
        """
        Check if a valid image exists for a story.
        
        Args:
            story_id: Story identifier
            
        Returns:
            Tuple of (is_valid, image_url, image_status)
        """
        image_path = self.get_story_image_path(story_id)
        
        if validate_image_file(image_path):
            # Convert to frontend URL
            image_url = f"/ai_generated_images/{story_id}.webp"
            return True, image_url, 'ready'
        else:
            return False, None, 'pending'
    
    def safe_generate_prompt_content(self, news_item: Dict[str, Any]) -> str:
        """Extract and sanitize content for prompt generation."""
        if not news_item or not isinstance(news_item, dict):
            logger.warning("Invalid news item provided")
            return "trending news story in Thailand"
        
        # Priority order: summary_en -> summary -> title
        summary_en = news_item.get('summary_en', '').strip()
        summary_th = news_item.get('summary', '').strip()
        title = news_item.get('title', '').strip()
        
        # Use English summary if available and valid
        if summary_en and not summary_en.startswith('Summary failed'):
            content = sanitize_prompt_text(summary_en)
            if content:
                return content
        
        # Fall back to Thai summary if available and valid
        if summary_th and not summary_th.startswith('สรุปไม่สำเร็จ'):
            content = sanitize_prompt_text(summary_th)
            if content:
                return content
        
        # Final fallback to title
        if title:
            content = sanitize_prompt_text(title)
            if content:
                return content
        
        return "trending news story in Thailand"
    
    def generate_enhanced_editorial_prompt(self, news_item: Dict[str, Any]) -> str:
        """
        Generate intelligent, context-aware editorial illustration prompts.
        """
        try:
            # Get the most relevant content
            content = self.safe_generate_prompt_content(news_item)
            
            # Get additional metadata for context
            title = sanitize_prompt_text(news_item.get('title', ''))
            category = news_item.get('auto_category', '')
            
            # Base realistic editorial style template
            base_style = "An artistic illustration of the trending news: "
            
            # Category-specific prompt generation
            if "เกม/อนิเมะ (Games/Anime)" in category:
                prompt = (f"{base_style}{content}. "
                         f"Gaming culture illustration with modern digital entertainment elements. "
                         f"Gaming controllers, monitors, and interactive digital experiences. "
                         f"Editorial gaming illustration style, modern tech composition.")
            
            elif "กีฬา (Sports)" in category:
                prompt = (f"{base_style}{content}. "
                         f"Athletic competition illustration with sporting excellence and teamwork. "
                         f"Professional sports venue with athletes demonstrating skill. "
                         f"Editorial sports illustration style, inspirational composition.")
            
            elif "บันเทิง (Entertainment)" in category:
                prompt = (f"{base_style}{content}. "
                         f"Entertainment industry illustration with creative performance. "
                         f"Professional venue with stage lighting and performance elements. "
                         f"Editorial entertainment illustration style, artistic composition.")
            
            elif "การเมือง/ข่าวทั่วไป (Politics/General News)" in category:
                prompt = (f"{base_style}{content}. "
                         f"News reporting illustration with press conference setting. "
                         f"Professional media environment with democratic discourse. "
                         f"Editorial news illustration style, informative composition.")
            
            else:
                prompt = (f"{base_style}{content}. "
                         f"Editorial news illustration depicting the described activity. "
                         f"Realistic portrayal with relevant people and locations. "
                         f"Professional illustration style with informative composition.")
            
            # Final sanitization
            final_prompt = sanitize_prompt_text(prompt)
            
            if len(final_prompt) < 20:
                final_prompt = "Professional editorial illustration of trending Thai news story"
            
            return final_prompt
            
        except Exception as e:
            logger.error(f"Error generating prompt: {e}")
            return "Professional editorial illustration of trending Thai news story"
    
    def generate_image_with_dalle(self, prompt: str, size: Literal["1024x1024", "1792x1024", "1024x1792"] = "1024x1024") -> Optional[str]:
        """Generate an image using OpenAI DALL-E API."""
        try:
            if not prompt or not prompt.strip():
                logger.error("Empty prompt provided")
                return None
            
            clean_prompt = sanitize_prompt_text(prompt)
            if len(clean_prompt) < 10:
                logger.error("Prompt too short after sanitization")
                return None
            
            logger.info(f"🎨 Generating image with DALL-E 3...")
            logger.debug(f"Prompt: {clean_prompt[:100]}...")
            
            response = self.client.images.generate(
                model="dall-e-3",
                prompt=clean_prompt,
                size=size,
                quality="standard",
                n=1,
            )
            
            if response.data and len(response.data) > 0:
                image_url = response.data[0].url
                logger.info(f"✅ Successfully generated image")
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
        except Exception as e:
            logger.error(f"Error generating image: {e}")
            return None
    
    def download_and_save_image(self, image_url: str, story_id: str) -> Optional[str]:
        """Download image from URL and save it with story_id filename."""
        try:
            filename = f"{story_id}.webp"
            logger.info(f"📥 Downloading image for story {story_id[:16]}...")
            
            # Download with retries
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    response = requests.get(image_url, timeout=30)
                    response.raise_for_status()
                    break
                except requests.RequestException as e:
                    if attempt < max_retries - 1:
                        logger.warning(f"Download attempt {attempt + 1} failed, retrying: {e}")
                        time.sleep(2)
                        continue
                    else:
                        raise
            
            # Validate image content
            if len(response.content) < 15 * 1024:  # 15KB minimum
                logger.error(f"Downloaded image too small: {len(response.content)} bytes")
                return None
            
            # Save to frontend directory
            image_path = self.get_story_image_path(story_id)
            
            with open(image_path, 'wb') as f:
                f.write(response.content)
            
            # Verify file was written correctly
            if validate_image_file(image_path):
                file_size = os.path.getsize(image_path)
                logger.info(f"💾 Successfully saved: {filename} ({file_size} bytes)")
                return image_path
            else:
                logger.error(f"Failed to save image properly: {filename}")
                return None
            
        except Exception as e:
            logger.error(f"Error downloading/saving image for {story_id}: {e}")
            return None
    
    def generate_image_for_story(self, story: Dict[str, Any], 
                                max_retries: int = 3, 
                                retry_backoff: float = 2.0,
                                force_regenerate: bool = False) -> Tuple[bool, Optional[str], str]:
        """
        Generate AI image for a story with persistence guarantees.
        
        Args:
            story: Story data dictionary with story_id
            max_retries: Maximum retry attempts
            retry_backoff: Backoff time between retries
            force_regenerate: Force regeneration even if valid image exists
            
        Returns:
            Tuple of (success, image_url, status)
        """
        # Get story_id (generate if not present)
        story_id = story.get('story_id')
        if not story_id:
            source_id = story.get('video_id', 'unknown')
            platform = story.get('channel', 'YouTube')
            publish_time = parse_publish_time(story)
            story_id = generate_story_id(source_id, platform, publish_time)
            story['story_id'] = story_id
        
        # Check for existing valid image (unless forced)
        if not force_regenerate:
            has_valid_image, existing_url, existing_status = self.check_existing_image(story_id)
            if has_valid_image:
                logger.info(f"✅ Using existing valid image for story {story_id[:16]}...")
                return True, existing_url, existing_status
        
        # Generate new image with retry logic
        for retry_count in range(max_retries + 1):
            try:
                logger.info(f"🎨 Generating image for story {story_id[:16]}... (attempt {retry_count + 1})")
                
                # Generate prompt
                prompt = self.generate_enhanced_editorial_prompt(story)
                
                # Generate image with DALL-E
                dalle_url = self.generate_image_with_dalle(prompt, size="1024x1024")
                
                if dalle_url:
                    # Download and save image
                    local_path = self.download_and_save_image(dalle_url, story_id)
                    
                    if local_path:
                        # Success - return frontend URL
                        image_url = f"/ai_generated_images/{story_id}.webp"
                        logger.info(f"🎉 Successfully generated image for story {story_id[:16]}...")
                        return True, image_url, 'ready'
                    else:
                        raise ValueError("Failed to download/save image")
                else:
                    raise ValueError("DALL-E API returned no image URL")
                    
            except Exception as e:
                logger.error(f"Error generating image (attempt {retry_count + 1}): {e}")
                
                if retry_count < max_retries:
                    wait_time = retry_backoff * (2 ** retry_count)
                    logger.info(f"⏳ Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"❌ Max retries exceeded for story {story_id[:16]}...")
                    return False, None, 'pending'
    
    def process_top3_stories_with_persistence(self, stories: List[Dict[str, Any]], 
                                             force_regenerate: bool = False,
                                             max_retries: int = 3,
                                             retry_backoff: float = 2.0) -> List[Dict[str, Any]]:
        """
        Process Top-3 stories for images with persistence guarantees.
        
        Args:
            stories: List of top 3 stories sorted by popularity
            force_regenerate: Force regeneration of all images
            max_retries: Maximum retry attempts per image
            retry_backoff: Backoff time between retries
            
        Returns:
            Updated stories with image fields
        """
        logger.info("🎯 Processing Top-3 stories with persistence guarantees...")
        
        if len(stories) > 3:
            logger.warning(f"Expected 3 stories, got {len(stories)}. Using first 3.")
            stories = stories[:3]
        
        updated_stories = []
        generated_count = 0
        skipped_count = 0
        failed_count = 0
        
        for i, story in enumerate(stories, 1):
            story_id = story.get('story_id', 'unknown')
            title = story.get('title', 'Unknown')[:50]
            
            logger.info(f"\n📰 Processing Rank #{i}: {title}...")
            logger.info(f"   Story ID: {story_id[:16]}...")
            
            success, image_url, status = self.generate_image_for_story(
                story, 
                max_retries=max_retries,
                retry_backoff=retry_backoff,
                force_regenerate=force_regenerate
            )
            
            # Update story with image fields
            story['ai_image_url'] = image_url
            story['image_status'] = status
            story['image_updated_at'] = datetime.now(timezone.utc).isoformat()
            story['rank'] = i
            
            if success:
                if force_regenerate or not image_url:
                    generated_count += 1
                    logger.info(f"   ✅ Rank #{i}: NEW image generated")
                else:
                    skipped_count += 1
                    logger.info(f"   ✅ Rank #{i}: EXISTING image used")
            else:
                failed_count += 1
                logger.warning(f"   ⚠️ Rank #{i}: Image generation FAILED - using placeholder")
            
            updated_stories.append(story)
            
            # Small delay between generations
            if i < len(stories):
                time.sleep(1)
        
        # Summary
        logger.info(f"\n📊 Top-3 Image Processing Summary:")
        logger.info(f"   Generated: {generated_count}")
        logger.info(f"   Existing: {skipped_count}")
        logger.info(f"   Failed: {failed_count}")
        
        return updated_stories


def generate_images_for_top3_with_persistence(news_data: List[Dict[str, Any]], 
                                            api_key: Optional[str] = None,
                                            force_regenerate: bool = False,
                                            max_retries: int = 3,
                                            retry_backoff: float = 2.0) -> Dict[str, Any]:
    """
    Convenience function to generate images for top 3 news items with persistence.
    
    Args:
        news_data: List of news items (will be sorted by popularity)
        api_key: OpenAI API key
        force_regenerate: Force regeneration even if valid images exist
        max_retries: Maximum retry attempts per image
        retry_backoff: Backoff time between retries
        
    Returns:
        Dictionary with results and updated news data
    """
    try:
        # Sort by popularity to get top 3
        def get_score(item):
            return get_precise_score(item)
        
        sorted_news = sorted(news_data, key=get_score, reverse=True)
        top3_news = sorted_news[:3]
        
        if not top3_news:
            return {
                "success": False,
                "message": "No news items to process",
                "updated_data": news_data
            }
        
        # Create generator
        generator = TrendSiamImageGeneratorV2(api_key)
        
        # Process top 3 with persistence
        updated_top3 = generator.process_top3_stories_with_persistence(
            top3_news,
            force_regenerate=force_regenerate,
            max_retries=max_retries,
            retry_backoff=retry_backoff
        )
        
        # Update original data
        updated_news_data = news_data.copy()
        for i, updated_story in enumerate(updated_top3):
            # Find and update the original item
            story_id = updated_story.get('story_id')
            for j, original_item in enumerate(updated_news_data):
                if original_item.get('story_id') == story_id or original_item == sorted_news[i]:
                    updated_news_data[j] = updated_story
                    break
        
        # Count results
        generated = sum(1 for story in updated_top3 if story.get('image_status') == 'ready' and story.get('ai_image_url'))
        failed = sum(1 for story in updated_top3 if story.get('image_status') == 'pending')
        
        return {
            "success": generated > 0,
            "message": f"Processed {len(updated_top3)} top stories: {generated} with images, {failed} failed",
            "updated_data": updated_news_data,
            "generated_count": generated,
            "failed_count": failed
        }
        
    except Exception as e:
        logger.error(f"Error in generate_images_for_top3_with_persistence: {e}")
        return {
            "success": False,
            "message": f"Error: {str(e)}",
            "updated_data": news_data
        }


if __name__ == "__main__":
    # Example usage
    import sys
    
    api_key = sys.argv[1] if len(sys.argv) > 1 else None
    
    print("🎨 TrendSiam Image Generator v2 with Persistence")
    print("=" * 50)
    
    # Example: load news data and process
    try:
        with open('thailand_trending_summary.json', 'r', encoding='utf-8') as f:
            news_data = json.load(f)
        
        if isinstance(news_data, dict) and 'items' in news_data:
            news_data = news_data['items']
        
        result = generate_images_for_top3_with_persistence(
            news_data, 
            api_key=api_key,
            force_regenerate=False  # Respect existing images
        )
        
        print(f"Success: {result['success']}")
        print(f"Message: {result['message']}")
        
        if result['success']:
            print("✅ Images processed with persistence guarantees!")
        else:
            print("❌ Failed to process images.")
            
    except FileNotFoundError:
        print("❌ News data file not found. Run summarize_all.py first.")
    except Exception as e:
        print(f"❌ Error: {e}")
