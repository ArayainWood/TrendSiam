#!/usr/bin/env python3
"""
Supabase Storage Configuration for TrendSiam

Centralized configuration for AI image storage with bucket management
and URL construction utilities.
"""

import os
import logging
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class StorageConfig:
    """Centralized Supabase Storage configuration"""
    
    def __init__(self):
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.service_role_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        self.bucket_name = os.getenv('SUPABASE_AI_IMAGES_BUCKET', 'ai-images')
        
        if not self.supabase_url or not self.service_role_key:
            raise ValueError(
                "Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
            )
    
    def get_public_url(self, file_path: str) -> str:
        """
        Construct public URL for a file in the AI images bucket.
        
        Args:
            file_path: Path to file within bucket (e.g., "story_id.webp")
            
        Returns:
            Full public URL for the image
        """
        # Remove leading slash if present
        file_path = file_path.lstrip('/')
        
        return f"{self.supabase_url}/storage/v1/object/public/{self.bucket_name}/{file_path}"
    
    def get_file_path(self, story_id: str, extension: str = 'webp') -> str:
        """
        Generate consistent file path for a story image.
        
        Args:
            story_id: Story identifier
            extension: File extension (default: webp)
            
        Returns:
            File path within bucket
        """
        return f"{story_id}.{extension}"
    
    def validate_configuration(self) -> bool:
        """
        Validate storage configuration.
        
        Returns:
            True if configuration is valid, False otherwise
        """
        try:
            from supabase import create_client
            
            client = create_client(self.supabase_url, self.service_role_key)
            
            # Test bucket access
            buckets = client.storage.list_buckets()
            bucket_exists = any(b.name == self.bucket_name for b in buckets)
            
            if not bucket_exists:
                logger.error(f"Bucket '{self.bucket_name}' does not exist")
                return False
            
            logger.info(f"✅ Storage configuration valid - bucket '{self.bucket_name}' exists")
            return True
            
        except Exception as e:
            logger.error(f"Storage configuration validation failed: {e}")
            return False

# Global storage configuration instance
_storage_config: Optional[StorageConfig] = None

def get_storage_config() -> StorageConfig:
    """Get global storage configuration instance"""
    global _storage_config
    if _storage_config is None:
        _storage_config = StorageConfig()
    return _storage_config

def get_bucket_name() -> str:
    """Get configured bucket name"""
    return get_storage_config().bucket_name

def get_image_public_url(story_id: str, extension: str = 'webp') -> str:
    """
    Get public URL for a story image.
    
    Args:
        story_id: Story identifier
        extension: File extension (default: webp)
        
    Returns:
        Full public URL for the image
    """
    config = get_storage_config()
    file_path = config.get_file_path(story_id, extension)
    return config.get_public_url(file_path)

def validate_storage() -> bool:
    """Validate storage configuration and connectivity"""
    try:
        config = get_storage_config()
        return config.validate_configuration()
    except Exception as e:
        logger.error(f"Storage validation failed: {e}")
        return False

if __name__ == "__main__":
    # Test storage configuration
    print("🔍 Testing Supabase Storage configuration...")
    
    try:
        config = get_storage_config()
        print(f"   Bucket name: {config.bucket_name}")
        print(f"   Supabase URL: {config.supabase_url}")
        
        # Test validation
        if config.validate_configuration():
            print("✅ Storage configuration is valid!")
            
            # Test URL generation
            test_story_id = "test_story_123"
            test_url = get_image_public_url(test_story_id)
            print(f"   Example URL: {test_url}")
        else:
            print("❌ Storage configuration failed validation")
            
    except Exception as e:
        print(f"❌ Storage configuration error: {e}")
