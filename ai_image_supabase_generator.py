#!/usr/bin/env python3
"""
Supabase Storage AI Image Generator for TrendSiam
Integrates legacy ai_image_generator.py with Supabase Storage
"""

import os
import logging
import requests
import hashlib
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from dotenv import load_dotenv
import tempfile

# Load environment
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

class SupabaseAIImageGenerator:
    """AI Image Generator with Supabase Storage integration"""
    
    def __init__(self, supabase_client, bucket_name: str = "ai-images"):
        self.supabase_client = supabase_client
        self.bucket_name = bucket_name
        
        # Import the enhanced v2 generator
        try:
            from ai_image_generator_v2 import TrendSiamImageGeneratorV2
            from core.storage_config import get_storage_config
            
            openai_api_key = os.getenv('OPENAI_API_KEY')
            if not openai_api_key:
                raise ValueError("OPENAI_API_KEY not found")
            
            self.legacy_generator = TrendSiamImageGeneratorV2(openai_api_key)
            self.storage_config = get_storage_config()
            logger.info("✅ Enhanced v2 AI image generator initialized")
            logger.info(f"✅ Storage config initialized with bucket: {bucket_name}")
        except Exception as e:
            logger.error(f"❌ Failed to initialize enhanced generator: {e}")
            raise
    
    def generate_story_filename(self, story_id: str) -> str:
        """Generate consistent filename for a story"""
        # Use story_id hash to create deterministic filename
        return f"{story_id[:16]}.webp"
    
    def upload_to_storage(self, image_bytes: bytes, filename: str) -> Optional[str]:
        """Upload image to Supabase Storage and return public URL, handling 409 Duplicate as success"""
        try:
            # Upload to storage
            result = self.supabase_client.storage.from_(self.bucket_name).upload(
                filename, image_bytes, {"content-type": "image/webp"}
            )
            
            if result:
                # Get public URL
                public_url_result = self.supabase_client.storage.from_(self.bucket_name).get_public_url(filename)
                if public_url_result:
                    logger.info(f"✅ Uploaded image to storage: {filename}")
                    return public_url_result
            
            logger.error(f"❌ Failed to upload {filename} to storage")
            return None
            
        except Exception as e:
            # Handle 409 Duplicate as success - file already exists
            if "409" in str(e) or "duplicate" in str(e).lower() or "already exists" in str(e).lower():
                logger.info(f"✅ File {filename} already exists in storage (409 Duplicate) - treating as success")
                try:
                    # Get public URL for existing file
                    public_url_result = self.supabase_client.storage.from_(self.bucket_name).get_public_url(filename)
                    if public_url_result:
                        logger.info(f"✅ Retrieved existing image URL: {filename}")
                        return public_url_result
                except Exception as url_error:
                    logger.error(f"❌ Failed to get URL for existing file {filename}: {url_error}")
                    return None
            
            logger.error(f"❌ Storage upload error for {filename}: {e}")
            return None
    
    def download_and_convert_image(self, dalle_url: str) -> Optional[bytes]:
        """Download DALL-E image and convert to WebP bytes"""
        try:
            response = requests.get(dalle_url, timeout=30)
            response.raise_for_status()
            
            # Convert to WebP format using PIL if available
            try:
                from PIL import Image
                import io
                
                # Open and convert to WebP
                img = Image.open(io.BytesIO(response.content))
                webp_buffer = io.BytesIO()
                img.save(webp_buffer, format="WebP", quality=85)
                return webp_buffer.getvalue()
                
            except ImportError:
                # Fallback: return original bytes (assuming it's already web-compatible)
                logger.warning("PIL not available, saving original format")
                return response.content
                
        except Exception as e:
            logger.error(f"❌ Failed to download image from {dalle_url}: {e}")
            return None
    
    def generate_and_upload_image(self, story: Dict[str, Any]) -> Tuple[bool, Optional[str], str]:
        """Generate AI image and upload to Supabase Storage"""
        story_id = story.get('story_id')
        if not story_id:
            return False, None, 'missing_story_id'
        
        try:
            # Generate prompt using legacy generator
            prompt = self.legacy_generator.generate_enhanced_editorial_prompt(story)
            logger.info(f"📝 Generated prompt for {story_id}: {prompt[:100]}...")
            
            # Generate image with DALL-E
            dalle_url = self.legacy_generator.generate_image_with_dalle(prompt, size="1024x1024")
            if not dalle_url:
                logger.error(f"❌ DALL-E generation failed for {story_id}")
                return False, None, 'dalle_failed'
            
            # Download and convert image
            image_bytes = self.download_and_convert_image(dalle_url)
            if not image_bytes:
                return False, None, 'download_failed'
            
            # Generate filename and upload
            filename = self.generate_story_filename(story_id)
            public_url = self.upload_to_storage(image_bytes, filename)
            
            if public_url:
                # Store image data in story for database save
                story['ai_image_prompt'] = prompt
                story['ai_image_url'] = public_url
                story['image_status'] = 'ready'
                
                logger.info(f"✅ Successfully generated and uploaded image for {story_id}")
                logger.info(f"   📍 Storage URL: {public_url}")
                return True, public_url, 'uploaded'
            else:
                return False, None, 'upload_failed'
                
        except Exception as e:
            logger.error(f"❌ Image generation failed for {story_id}: {e}")
            return False, None, 'error'
    
    def ensure_bucket_exists(self) -> bool:
        """Ensure the AI images bucket exists and is properly configured"""
        try:
            # Try to list bucket - this will fail if bucket doesn't exist
            self.supabase_client.storage.from_(self.bucket_name).list()
            logger.info(f"✅ Bucket '{self.bucket_name}' exists and accessible")
            return True
            
        except Exception as e:
            logger.warning(f"⚠️ Bucket '{self.bucket_name}' may not exist or not accessible: {e}")
            try:
                # Try to create bucket (this may fail due to permissions)
                self.supabase_client.storage.create_bucket(self.bucket_name, {"public": True})
                logger.info(f"✅ Created bucket '{self.bucket_name}'")
                return True
            except Exception as create_error:
                logger.error(f"❌ Failed to create bucket '{self.bucket_name}': {create_error}")
                return False
    
    def save_ai_image_record(self, news_id: str, image_url: str, prompt: str, model: str = "dall-e-3") -> bool:
        """Save AI image record to ai_images table"""
        try:
            self.supabase_client.table('ai_images').upsert({
                'news_id': news_id,
                'image_url': image_url,
                'prompt': prompt,
                'model': model
            }, on_conflict='news_id').execute()
            
            logger.info(f"✅ Saved AI image record for news_id: {news_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to save AI image record for {news_id}: {e}")
            return False
