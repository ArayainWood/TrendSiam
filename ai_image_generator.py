#!/usr/bin/env python3
"""
AI Image Generator for TrendSiam News

This module handles AI-powered editorial illustration generation
for trending Thai news using OpenAI DALL-E API.

Enhanced version with:
- Always generates new images (overwrites existing)
- Improved prompt sanitization and generation
- Robust error handling
- Better logging and traceability
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
import html
import unicodedata
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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


def sanitize_prompt_text(text: str) -> str:
    """
    Sanitize text for use in AI prompts by removing dangerous characters,
    HTML tags, excessive whitespace, and normalizing unicode.
    
    Args:
        text: Raw text to sanitize
        
    Returns:
        Sanitized text safe for AI prompt use
    """
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
        # Keep Thai characters, English letters, numbers, basic punctuation
        text = re.sub(r'[^\u0E00-\u0E7F\w\s\.,!?\-\(\):;\'\"]+', ' ', text)
        
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove leading/trailing whitespace
        text = text.strip()
        
        # Truncate to reasonable length (DALL-E has prompt limits)
        max_length = 800  # Conservative limit for DALL-E
        if len(text) > max_length:
            text = text[:max_length].rsplit(' ', 1)[0] + '...'
        
        return text
        
    except Exception as e:
        logger.warning(f"Error sanitizing text: {e}")
        return "news content"


def generate_safe_fallback_prompt() -> str:
    """Generate a safe fallback prompt when no content is available."""
    return "A professional editorial illustration of a trending news event in Thailand, modern newspaper style, realistic composition with people and locations, photojournalistic quality"


class TrendSiamImageGenerator:
    """Enhanced AI Image Generator for TrendSiam Editorial Illustrations"""
    
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

    def safe_generate_prompt_content(self, news_item: Dict[str, Any]) -> str:
        """
        Helper function to extract and sanitize content for prompt generation.
        Uses summary_en first, then summary, then title as fallback.
        
        Args:
            news_item: Dictionary containing news data
            
        Returns:
            String containing the most relevant sanitized content for prompt generation
        """
        if not news_item or not isinstance(news_item, dict):
            logger.warning("Invalid news item provided")
            return generate_safe_fallback_prompt()
        
        # Priority order: summary_en -> summary -> title
        summary_en = news_item.get('summary_en', '').strip()
        summary_th = news_item.get('summary', '').strip()
        title = news_item.get('title', '').strip()
        
        logger.info(f"🔍 Content analysis for prompt generation:")
        logger.info(f"   Summary_en: {'✅ Available' if summary_en and not summary_en.startswith('Summary failed') else '❌ Not available'}")
        logger.info(f"   Summary: {'✅ Available' if summary_th and not summary_th.startswith('สรุปไม่สำเร็จ') else '❌ Not available'}")
        logger.info(f"   Title: {'✅ Available' if title else '❌ Not available'}")
        
        # Use English summary if available and valid
        if summary_en and not summary_en.startswith('Summary failed'):
            logger.info("📝 Using English summary for prompt generation")
            content = sanitize_prompt_text(summary_en)
            if content:
                return content
        
        # Fall back to Thai summary if available and valid
        if summary_th and not summary_th.startswith('สรุปไม่สำเร็จ'):
            logger.info("📝 Using Thai summary for prompt generation")
            content = sanitize_prompt_text(summary_th)
            if content:
                return content
        
        # Final fallback to title
        if title:
            logger.info("📝 Using title for prompt generation (fallback)")
            content = sanitize_prompt_text(title)
            if content:
                return content
        
        # Last resort
        logger.warning("⚠️ No valid content found, using safe fallback")
        return "trending news story in Thailand"

    def generate_enhanced_editorial_prompt(self, news_item: Dict[str, Any]) -> str:
        """
        Generate intelligent, context-aware editorial illustration prompts.
        Uses auto_category and content analysis to create category-specific prompts
        that accurately reflect the type of content (games, sports, music, etc.).
        
        Args:
            news_item: Dictionary containing news data with title, summary, auto_category, etc.
            
        Returns:
            Context-specific sanitized prompt for creating realistic editorial-style illustration
        """
        try:
            # Get the most relevant content using safe helper
            content = self.safe_generate_prompt_content(news_item)
            
            # Get additional metadata for context
            title = sanitize_prompt_text(news_item.get('title', ''))
            category = news_item.get('auto_category', '')
            channel = sanitize_prompt_text(news_item.get('channel', ''))
            
            logger.info(f"🎨 Generating prompt for: {title[:50]}...")
            logger.info(f"📋 Category: {category}")
            logger.info(f"📺 Channel: {channel}")
            logger.info(f"📝 Content source: {content[:100]}...")
            
            # Base realistic editorial style template
            base_style = (
                "An artistic illustration of the trending news: "
            )
            
            # Get additional metadata for intelligent context detection
            summary = sanitize_prompt_text(news_item.get('summary', ''))
            summary_en = sanitize_prompt_text(news_item.get('summary_en', ''))
            
            # Analyze combined content for specific context within categories
            combined_content = f"{title} {summary} {summary_en} {channel}".lower()
            
            # PRIMARY: Use auto_category as main context indicator
            if "เกม/อนิเมะ (Games/Anime)" in category:
                prompt = self._generate_gaming_prompt(base_style, content, combined_content, title)
            
            elif "กีฬา (Sports)" in category:
                prompt = self._generate_sports_prompt(base_style, content, combined_content, title)
            
            elif "บันเทิง (Entertainment)" in category:
                prompt = self._generate_entertainment_prompt(base_style, content, combined_content, title)
            
            elif "การเมือง/ข่าวทั่วไป (Politics/General News)" in category:
                prompt = self._generate_news_politics_prompt(base_style, content, combined_content)
            
            elif "การศึกษา (Education)" in category:
                prompt = self._generate_education_prompt(base_style, content, combined_content)
            
            elif "ไลฟ์สไตล์ (Lifestyle)" in category:
                prompt = self._generate_lifestyle_prompt(base_style, content, combined_content)
            
            elif "ธุรกิจ/การเงิน (Business/Finance)" in category:
                prompt = self._generate_business_prompt(base_style, content, combined_content)
            
            elif "สุขภาพ (Health)" in category:
                prompt = self._generate_health_prompt(base_style, content, combined_content)
            
            # FALLBACK: If no category match, use content-based detection
            else:
                prompt = self._generate_fallback_prompt(base_style, content, combined_content)
            
            # Final sanitization and validation
            final_prompt = sanitize_prompt_text(prompt)
            
            # Ensure we have a valid prompt
            if len(final_prompt) < 20:
                logger.warning("Generated prompt too short, using fallback")
                final_prompt = generate_safe_fallback_prompt()
            
            # Log the final prompt for traceability
            logger.info(f"📝 Final prompt ({len(final_prompt)} chars): {final_prompt[:150]}...")
            
            return final_prompt
            
        except Exception as e:
            logger.error(f"Error generating prompt: {e}")
            return generate_safe_fallback_prompt()

    def _generate_gaming_prompt(self, base_style: str, content: str, combined_content: str, title: str) -> str:
        """Generate gaming-specific prompts based on game type and content"""
        
        # Specific game detection
        if any(game in combined_content for game in ['honkai star rail', 'honkai: star rail', 'hsr']):
            return (f"{base_style}{content}. "
                   f"Futuristic space fantasy illustration featuring characters in cosmic adventure setting. "
                   f"Sci-fi train traveling through starry galaxies, futuristic space stations and planets. "
                   f"Anime-style character designs with space exploration theme. "
                   f"Editorial illustration style, realistic game art composition.")
        
        elif any(game in combined_content for game in ['genshin impact', 'genshin', 'teyvat']):
            return (f"{base_style}{content}. "
                   f"Fantasy adventure illustration with magical elemental themes. "
                   f"Enchanted landscapes with floating islands, magical crystals, and ancient ruins. "
                   f"Anime-style characters wielding elemental powers in mystical environments. "
                   f"Editorial illustration style, fantasy game world composition.")
        
        elif any(game in combined_content for game in ['rov', 'realm of valor', 'mobile legends']):
            return (f"{base_style}{content}. "
                   f"MOBA battle arena illustration with strategic team combat scene. "
                   f"Fantasy heroes with unique abilities in competitive multiplayer environment. "
                   f"Game interface elements, skill effects, and tactical gameplay visualization. "
                   f"Editorial esports illustration style, dynamic action composition.")
        
        elif any(game in combined_content for game in ['minecraft', 'roblox']):
            return (f"{base_style}{content}. "
                   f"Block-building creative world illustration with pixelated landscapes. "
                   f"Creative construction elements, geometric structures and colorful environments. "
                   f"Family-friendly gaming atmosphere with building and exploration themes. "
                   f"Editorial gaming illustration style, creative sandbox composition.")
        
        elif any(game in combined_content for game in ['pubg', 'battle royale', 'fortnite']):
            return (f"{base_style}{content}. "
                   f"Battle royale competitive gaming illustration with strategic survival elements. "
                   f"Large-scale multiplayer battlefield with tactical equipment and vehicles. "
                   f"Competitive esports environment with high-stakes gaming action. "
                   f"Editorial esports illustration style, intense competition composition.")
        
        # Gaming content types
        elif any(term in combined_content for term in ['trailer', 'character trailer', 'gameplay trailer']):
            return (f"{base_style}{content}. "
                   f"Game promotional illustration showcasing character abilities and game world. "
                   f"Cinematic gaming scenes with dynamic character action and special effects. "
                   f"Professional game marketing aesthetic with polished visual presentation. "
                   f"Editorial gaming media style, promotional composition.")
        
        elif any(term in combined_content for term in ['stream', 'streamer', 'gaming stream', 'live']):
            return (f"{base_style}{content}. "
                   f"Gaming content creation illustration with streaming setup and audience interaction. "
                   f"Modern gaming equipment, multiple monitors, and live streaming environment. "
                   f"Content creator engaging with gaming community and viewers. "
                   f"Editorial media illustration style, modern streaming composition.")
        
        # General gaming fallback
        else:
            return (f"{base_style}{content}. "
                   f"Gaming culture illustration with modern digital entertainment elements. "
                   f"Gaming controllers, monitors, and interactive digital experiences. "
                   f"Contemporary gaming lifestyle and digital entertainment scene. "
                   f"Editorial gaming illustration style, modern tech composition.")

    def _generate_sports_prompt(self, base_style: str, content: str, combined_content: str, title: str) -> str:
        """Generate sports-specific prompts based on sport type"""
        
        if any(sport in combined_content for sport in ['volleyball', 'วอลเลย์บอล', 'vnl']):
            return (f"{base_style}{content}. "
                   f"Volleyball competition illustration with players in dynamic action poses. "
                   f"Professional indoor volleyball court with net, team coordination and athletic movement. "
                   f"International tournament atmosphere with competitive sporting spirit. "
                   f"Editorial sports illustration style, action-focused composition.")
        
        elif any(sport in combined_content for sport in ['football', 'ฟุตบอล', 'soccer']):
            return (f"{base_style}{content}. "
                   f"Football/soccer match illustration with players in competitive action. "
                   f"Stadium environment with goal posts, ball movement and team strategy. "
                   f"Athletic performance and sportsmanship in professional football setting. "
                   f"Editorial sports illustration style, dynamic match composition.")
        
        elif any(sport in combined_content for sport in ['basketball', 'บาสเกตบอล']):
            return (f"{base_style}{content}. "
                   f"Basketball game illustration with players shooting and defending. "
                   f"Indoor court with hoops, fast-paced action and athletic skill display. "
                   f"Team basketball strategy and individual player excellence. "
                   f"Editorial sports illustration style, energetic game composition.")
        
        else:
            return (f"{base_style}{content}. "
                   f"Athletic competition illustration with sporting excellence and teamwork. "
                   f"Professional sports venue with athletes demonstrating skill and dedication. "
                   f"Competitive sporting spirit with fair play and achievement focus. "
                   f"Editorial sports illustration style, inspirational composition.")

    def _generate_entertainment_prompt(self, base_style: str, content: str, combined_content: str, title: str) -> str:
        """Generate entertainment-specific prompts based on content type"""
        
        # Music content
        if any(term in combined_content for term in ['official mv', 'music video', 'mv', 'เพลง', 'song', 'artist', 'singer']):
            return (f"{base_style}{content}. "
                   f"Music performance illustration with artists on stage under professional lighting. "
                   f"Concert venue atmosphere with musical instruments and sound equipment. "
                   f"Live music energy with performers engaging audience through musical expression. "
                   f"Editorial entertainment illustration style, musical performance composition.")
        
        # Movie/Film content
        elif any(term in combined_content for term in ['movie', 'film', 'cinema', 'trailer', 'premiere']):
            return (f"{base_style}{content}. "
                   f"Film industry illustration with movie production and cinematic elements. "
                   f"Professional film set with cameras, lighting, and production crew. "
                   f"Hollywood-style movie making atmosphere with artistic direction. "
                   f"Editorial entertainment illustration style, cinematic composition.")
        
        # TV/Series content
        elif any(term in combined_content for term in ['series', 'ซีรีส์', 'drama', 'ละคร', 'episode', 'netflix']):
            return (f"{base_style}{content}. "
                   f"Television production illustration with dramatic storytelling elements. "
                   f"Professional TV studio with filming equipment and dramatic lighting. "
                   f"Actors in character delivering compelling dramatic performances. "
                   f"Editorial entertainment illustration style, dramatic composition.")
        
        # General entertainment fallback
        else:
            return (f"{base_style}{content}. "
                   f"Entertainment industry illustration with creative performance and artistic expression. "
                   f"Professional entertainment venue with stage lighting and performance elements. "
                   f"Artists and performers engaging audiences through creative storytelling. "
                   f"Editorial entertainment illustration style, artistic composition.")

    def _generate_news_politics_prompt(self, base_style: str, content: str, combined_content: str) -> str:
        """Generate news/politics-specific prompts"""
        return (f"{base_style}{content}. "
               f"News reporting illustration with journalists and press conference setting. "
               f"Professional media environment with microphones, cameras and news gathering. "
               f"Democratic discourse and information sharing in civic engagement context. "
               f"Editorial news illustration style, informative composition.")

    def _generate_education_prompt(self, base_style: str, content: str, combined_content: str) -> str:
        """Generate education-specific prompts"""
        return (f"{base_style}{content}. "
               f"Educational environment illustration with learning and knowledge sharing. "
               f"Modern classroom or academic setting with students and teaching materials. "
               f"Educational excellence and academic achievement in learning environment. "
               f"Editorial education illustration style, inspiring composition.")

    def _generate_lifestyle_prompt(self, base_style: str, content: str, combined_content: str) -> str:
        """Generate lifestyle-specific prompts"""
        return (f"{base_style}{content}. "
               f"Lifestyle and daily living illustration with modern life activities. "
               f"Contemporary lifestyle choices and personal wellness themes. "
               f"Quality of life improvements and lifestyle trends. "
               f"Editorial lifestyle illustration style, aspirational composition.")

    def _generate_business_prompt(self, base_style: str, content: str, combined_content: str) -> str:
        """Generate business/finance-specific prompts"""
        return (f"{base_style}{content}. "
               f"Business and finance illustration with professional corporate environment. "
               f"Modern office setting with business meetings and financial planning. "
               f"Economic growth and business success in contemporary workplace. "
               f"Editorial business illustration style, professional composition.")

    def _generate_health_prompt(self, base_style: str, content: str, combined_content: str) -> str:
        """Generate health-specific prompts"""
        return (f"{base_style}{content}. "
               f"Healthcare illustration with medical professionals and modern healthcare. "
               f"Clean medical facility with healthcare workers and medical equipment. "
               f"Health and wellness focus with professional medical care. "
               f"Editorial healthcare illustration style, caring composition.")

    def _generate_fallback_prompt(self, base_style: str, content: str, combined_content: str) -> str:
        """Generate fallback prompt when category is unknown"""
        return (f"{base_style}{content}. "
               f"Editorial news illustration depicting the described activity or event. "
               f"Realistic portrayal of current events with relevant people and locations. "
               f"Professional newspaper illustration style with informative composition.")

    # Keep old function name for compatibility
    def generate_editorial_illustration_prompt(self, news_item: Dict[str, Any]) -> str:
        """Wrapper for backward compatibility - calls the new enhanced prompt generator"""
        return self.generate_enhanced_editorial_prompt(news_item)

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
            news_data: List of news items to save
            
        Returns:
            True if saved successfully, False otherwise
        """
        try:
            # Create backup of existing file
            data_path = Path(self.data_file)
            if data_path.exists():
                backup_path = data_path.with_suffix(f'.backup_{int(time.time())}.json')
                shutil.copy2(data_path, backup_path)
                logger.info(f"Created backup: {backup_path.name}")
            
            # Save updated data
            with open(data_path, 'w', encoding='utf-8') as f:
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

    def force_delete_existing_images(self) -> None:
        """
        FORCE delete all existing AI-generated image files to ensure fresh generation.
        This is more aggressive than the previous version to guarantee new images.
        """
        try:
            deleted_count = 0
            
            # Delete numbered image files (image_1.png, image_2.png, etc.)
            for i in range(1, 11):  # Check up to 10 possible images
                image_path = self.images_dir / self.get_image_filename(i)
                if image_path.exists():
                    try:
                        image_path.unlink()
                        logger.info(f"🗑️ Force deleted: {image_path.name}")
                        deleted_count += 1
                    except PermissionError:
                        # Try alternative deletion methods on Windows
                        try:
                            os.remove(str(image_path))
                            logger.info(f"🗑️ Force deleted (alt method): {image_path.name}")
                            deleted_count += 1
                        except Exception as e:
                            logger.warning(f"Could not delete {image_path.name}: {e}")
            
            # Also check for any other .png files in the directory
            if self.images_dir.exists():
                for image_file in self.images_dir.glob("*.png"):
                    if image_file.name.startswith("image_"):
                        try:
                            image_file.unlink()
                            logger.info(f"🗑️ Force deleted: {image_file.name}")
                            deleted_count += 1
                        except Exception as e:
                            logger.warning(f"Could not delete {image_file.name}: {e}")
            
            if deleted_count > 0:
                logger.info(f"✅ Force deleted {deleted_count} existing image files")
            else:
                logger.info("ℹ️ No existing image files to delete")
                
            # Small delay to ensure filesystem is ready
            time.sleep(0.5)
                
        except Exception as e:
            logger.error(f"Error force deleting existing image files: {e}")

    def download_and_save_image(self, image_url: str, filename: str) -> Optional[str]:
        """
        Download image from URL and save it locally with improved error handling.
        
        Args:
            image_url: URL of the image to download
            filename: Local filename to save as
            
        Returns:
            Local file path if successful, None otherwise
        """
        try:
            logger.info(f"📥 Downloading image: {filename}")
            
            # Download the image with timeout and retries
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
            if len(response.content) < 1024:  # At least 1KB
                logger.error(f"Downloaded image too small: {len(response.content)} bytes")
                return None
            
            # Save to local file with error handling
            local_path = self.images_dir / filename
            
            # Ensure directory exists
            local_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Write file
            with open(local_path, 'wb') as f:
                f.write(response.content)
            
            # Verify file was written correctly
            if local_path.exists() and local_path.stat().st_size > 1024:
                logger.info(f"💾 Successfully saved image: {filename} ({local_path.stat().st_size} bytes)")
                return str(local_path)
            else:
                logger.error(f"Failed to save image properly: {filename}")
                return None
            
        except requests.RequestException as e:
            logger.error(f"Failed to download image from {image_url}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error saving image {filename}: {e}")
            return None

    def generate_image_with_dalle(self, prompt: str, size: Literal["1024x1024", "1792x1024", "1024x1792", "1536x1024", "1024x1536", "256x256", "512x512"] = "1024x1024") -> Optional[str]:
        """
        Generate an image using OpenAI DALL-E API with enhanced error handling.
        
        Args:
            prompt: Text prompt for image generation
            size: Image size (1024x1024, 1792x1024, or 1024x1792)
            
        Returns:
            Image URL if successful, None otherwise
        """
        try:
            # Validate and sanitize prompt
            if not prompt or not prompt.strip():
                logger.error("Empty prompt provided")
                return None
            
            clean_prompt = sanitize_prompt_text(prompt)
            if len(clean_prompt) < 10:
                logger.error("Prompt too short after sanitization")
                return None
            
            # Truncate prompt for logging while preserving full prompt for generation
            log_prompt = clean_prompt[:100] + "..." if len(clean_prompt) > 100 else clean_prompt
            logger.info(f"🎨 Generating image with DALL-E 3. Prompt: {log_prompt}")
            logger.info(f"📐 Image size: {size}, Quality: standard")
            
            # Make API call with proper error handling
            response = self.client.images.generate(
                model="dall-e-3",
                prompt=clean_prompt,
                size=size,
                quality="standard",
                n=1,
            )
            
            if response.data and len(response.data) > 0:
                image_url = response.data[0].url
                logger.info(f"✅ Successfully generated image: {image_url[:60]}...")
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
        try:
            # Filter news items that have popularity scores
            scored_news = [
                item for item in news_data 
                if get_precise_score(item) > 0
            ]
            
            if not scored_news:
                # Fallback to first 3 items if no popularity scores
                logger.warning("No popularity scores found, using first 3 news items")
                return news_data[:3] if len(news_data) >= 3 else news_data
            
            # Sort by precise popularity score (descending)
            sorted_news = sorted(
                scored_news, 
                key=lambda x: get_precise_score(x), 
                reverse=True
            )
            
            top3 = sorted_news[:3]
            scores = [get_precise_score(item) for item in top3]
            logger.info(f"Selected top 3 news items with popularity scores: {scores}")
            
            return top3
            
        except Exception as e:
            logger.error(f"Error getting top 3 news: {e}")
            return news_data[:3] if len(news_data) >= 3 else news_data

    def generate_ai_images_for_top3_news(self) -> Dict[str, Any]:
        """
        ENHANCED: Generate AI images for the top 3 most popular news items.
        ALWAYS generates new images by force deleting existing ones first.
        Improved error handling and logging.
        
        Returns:
            Dictionary containing success status, message, and processed items count
        """
        logger.info("🚀 Starting ENHANCED AI image generation for top 3 news items...")
        
        try:
            # FORCE delete existing image files first to ensure fresh generation
            logger.info("🗑️ Force cleaning up existing image files...")
            self.force_delete_existing_images()
            
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
            
            logger.info(f"📊 Processing {len(top3_news)} top news items for image generation")
            
            processed_count = 0
            successful_generations = 0
            errors = []
            
            # Generate images for each top news item
            for i, news_item in enumerate(top3_news):
                try:
                    item_number = i + 1
                    news_title = news_item.get('title', 'Untitled')
                    news_category = news_item.get('auto_category', 'Unknown')
                    news_popularity = get_precise_score(news_item)
                    
                    logger.info(f"\n=== Processing Item {item_number}/3 ===")
                    logger.info(f"📰 Title: {news_title[:60]}...")
                    logger.info(f"🏷️ Category: {news_category}")
                    logger.info(f"⭐ Popularity: {news_popularity:.1f}")
                    
                    # Generate enhanced content-specific illustration prompt
                    prompt = self.generate_enhanced_editorial_prompt(news_item)
                    logger.info(f"📝 Generated prompt length: {len(prompt)} characters")
                    
                    # ALWAYS generate new image (no existence check)
                    logger.info(f"🎨 Generating NEW image {item_number}/3...")
                    image_url = self.generate_image_with_dalle(prompt, size="1024x1024")
                    
                    if image_url:
                        # Generate consistent filename for this news item
                        filename = self.get_image_filename(item_number)
                        
                        # Download and save image locally
                        local_path = self.download_and_save_image(image_url, filename)
                        
                        if local_path:
                            # Find the original item in news_data and update it
                            updated = False
                            for original_item in news_data:
                                if original_item.get('title') == news_title:
                                    original_item['ai_image_url'] = image_url  # Keep original URL
                                    original_item['ai_image_local'] = local_path  # Add local path
                                    original_item['ai_image_prompt'] = prompt
                                    logger.info(f"✅ Updated news item with NEW AI image data")
                                    updated = True
                                    break
                            
                            if updated:
                                successful_generations += 1
                                logger.info(f"🎉 Successfully generated and saved NEW image {item_number}/3 as {filename}")
                            else:
                                logger.warning(f"Could not find original news item to update")
                        else:
                            logger.error(f"❌ Failed to save image {item_number}/3 locally")
                            errors.append(f"Image {item_number}: Download failed")
                    else:
                        logger.error(f"❌ Failed to generate image {item_number}/3")
                        errors.append(f"Image {item_number}: Generation failed")
                    
                    processed_count += 1
                    
                    # Add delay between API calls to respect rate limits
                    if i < len(top3_news) - 1:  # Don't delay after the last item
                        logger.info("⏳ Waiting 3 seconds before next generation...")
                        time.sleep(3)
                        
                except Exception as e:
                    logger.error(f"❌ Error processing news item {item_number}: {str(e)}")
                    errors.append(f"Item {item_number}: {str(e)[:50]}")
                    processed_count += 1
            
            # Save updated news data
            if successful_generations > 0:
                logger.info("💾 Saving updated news data...")
                save_success = self.save_news_data(news_data)
                if not save_success:
                    return {
                        "success": False,
                        "message": f"Generated {successful_generations} images but failed to save data",
                        "processed": processed_count,
                        "errors": errors
                    }
            
            # Prepare result
            result = {
                "success": successful_generations > 0,
                "message": f"Successfully generated {successful_generations}/{processed_count} NEW AI images for top news items",
                "processed": processed_count,
                "successful": successful_generations,
                "errors": errors
            }
            
            if successful_generations > 0:
                logger.info(f"🎉 ENHANCED generation completed: {successful_generations}/{processed_count} successful")
            else:
                logger.error(f"😞 No images were generated successfully")
            
            return result
            
        except Exception as e:
            logger.error(f"💥 Critical error in enhanced image generation: {e}")
            return {
                "success": False,
                "message": f"Critical error: {str(e)}",
                "processed": 0,
                "errors": [str(e)]
            }


def generate_ai_images_for_top3_news(api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    ENHANCED convenience function to generate AI images for top 3 news items.
    Always generates new images with improved error handling.
    
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
            "message": f"Initialization error: {str(e)}",
            "processed": 0,
            "errors": [str(e)]
        }


if __name__ == "__main__":
    # Example usage
    import sys
    
    # Check if API key is provided as command line argument
    api_key = sys.argv[1] if len(sys.argv) > 1 else None
    
    print("🎨 TrendSiam ENHANCED AI Image Generator")
    print("=" * 50)
    
    # Generate images
    result = generate_ai_images_for_top3_news(api_key)
    
    print(f"Success: {result['success']}")
    print(f"Message: {result['message']}")
    print(f"Processed: {result.get('processed', 0)} items")
    print(f"Successful: {result.get('successful', 0)} items")
    
    if result.get('errors'):
        print(f"Errors: {len(result['errors'])}")
        for error in result['errors']:
            print(f"  - {error}")
    
    if result['success']:
        print("✅ Enhanced AI images generated successfully!")
        print("🖼️ NEW images will now appear in the TrendSiam app.")
    else:
        print("❌ Failed to generate AI images.")
        print("🔧 Check your OpenAI API key and internet connection.") 