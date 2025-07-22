#!/usr/bin/env python3
"""
Input Validation and Security Module for TrendSiam

This module provides comprehensive input validation, sanitization,
and security checks for all external data sources.
"""

import re
import json
import logging
from typing import Any, Dict, List, Optional, Union
from pathlib import Path
from urllib.parse import urlparse
from datetime import datetime

logger = logging.getLogger(__name__)

class ValidationError(Exception):
    """Custom exception for validation errors"""
    pass

class SecurityValidator:
    """Comprehensive security validator for input data"""
    
    # Safe filename pattern (alphanumeric, dots, hyphens, underscores)
    SAFE_FILENAME_PATTERN = re.compile(r'^[a-zA-Z0-9._-]+$')
    
    # YouTube video ID pattern
    YOUTUBE_ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{11}$')
    
    # OpenAI API key pattern
    OPENAI_KEY_PATTERN = re.compile(r'^sk-[a-zA-Z0-9]{20,}$')
    
    # Safe text pattern (no control characters)
    SAFE_TEXT_PATTERN = re.compile(r'^[\w\s\u0E00-\u0E7F.,!?@#$%^&*()_+\-=\[\]{};:"\'|\\<>/~`]*$')
    
    @staticmethod
    def validate_api_key(api_key: str, key_type: str = "openai") -> bool:
        """
        Validate API key format and basic security
        
        Args:
            api_key: API key to validate
            key_type: Type of API key (openai, youtube)
            
        Returns:
            True if valid, False otherwise
        """
        if not api_key or not isinstance(api_key, str):
            logger.warning(f"Invalid {key_type} API key: empty or not string")
            return False
            
        # Check length
        if len(api_key) < 10 or len(api_key) > 200:
            logger.warning(f"Invalid {key_type} API key: invalid length")
            return False
            
        if key_type.lower() == "openai":
            if not SecurityValidator.OPENAI_KEY_PATTERN.match(api_key):
                logger.warning("Invalid OpenAI API key format")
                return False
                
        # Check for common test/placeholder values
        placeholder_keys = [
            "your-api-key-here",
            "sk-test",
            "test-key",
            "placeholder",
            "sk-fake",
            "sk-example"
        ]
        
        if any(placeholder in api_key.lower() for placeholder in placeholder_keys):
            logger.warning(f"API key appears to be a placeholder: {key_type}")
            return False
            
        return True
    
    @staticmethod
    def validate_url(url: str, allowed_domains: Optional[List[str]] = None) -> bool:
        """
        Validate URL for security
        
        Args:
            url: URL to validate
            allowed_domains: List of allowed domains (optional)
            
        Returns:
            True if valid, False otherwise
        """
        if not url or not isinstance(url, str):
            return False
            
        try:
            parsed = urlparse(url)
            
            # Check scheme
            if parsed.scheme not in ['http', 'https']:
                logger.warning(f"Invalid URL scheme: {parsed.scheme}")
                return False
                
            # Check domain if restrictions apply
            if allowed_domains:
                if not any(domain in parsed.netloc.lower() for domain in allowed_domains):
                    logger.warning(f"URL domain not allowed: {parsed.netloc}")
                    return False
                    
            return True
            
        except Exception as e:
            logger.warning(f"URL validation error: {e}")
            return False
    
    @staticmethod
    def validate_youtube_video_id(video_id: str) -> bool:
        """
        Validate YouTube video ID format
        
        Args:
            video_id: YouTube video ID to validate
            
        Returns:
            True if valid, False otherwise
        """
        if not video_id or not isinstance(video_id, str):
            return False
            
        return bool(SecurityValidator.YOUTUBE_ID_PATTERN.match(video_id))
    
    @staticmethod
    def validate_filename(filename: str, max_length: int = 255) -> bool:
        """
        Validate filename for security
        
        Args:
            filename: Filename to validate
            max_length: Maximum allowed length
            
        Returns:
            True if valid, False otherwise
        """
        if not filename or not isinstance(filename, str):
            return False
            
        # Check length
        if len(filename) > max_length:
            logger.warning(f"Filename too long: {len(filename)} > {max_length}")
            return False
            
        # Check for path traversal attempts
        if '..' in filename or '/' in filename or '\\' in filename:
            logger.warning(f"Potential path traversal in filename: {filename}")
            return False
            
        # Check against safe pattern
        if not SecurityValidator.SAFE_FILENAME_PATTERN.match(filename):
            logger.warning(f"Unsafe characters in filename: {filename}")
            return False
            
        return True
    
    @staticmethod
    def sanitize_text(text: str, max_length: int = 10000) -> str:
        """
        Sanitize text input for security
        
        Args:
            text: Text to sanitize
            max_length: Maximum allowed length
            
        Returns:
            Sanitized text
        """
        if not text or not isinstance(text, str):
            return ""
            
        # Truncate if too long
        if len(text) > max_length:
            text = text[:max_length]
            logger.warning(f"Text truncated to {max_length} characters")
            
        # Remove control characters except newlines and tabs
        sanitized = ''.join(char for char in text if ord(char) >= 32 or char in '\n\t')
        
        return sanitized.strip()
    
    @staticmethod
    def validate_json_structure(data: Any, required_fields: List[str]) -> bool:
        """
        Validate JSON data structure
        
        Args:
            data: Data to validate
            required_fields: List of required field names
            
        Returns:
            True if valid, False otherwise
        """
        if not isinstance(data, dict):
            logger.warning("Data is not a dictionary")
            return False
            
        for field in required_fields:
            if field not in data:
                logger.warning(f"Required field missing: {field}")
                return False
                
        return True
    
    @staticmethod
    def validate_news_item(news_item: Dict[str, Any]) -> bool:
        """
        Validate news item structure and content
        
        Args:
            news_item: News item dictionary to validate
            
        Returns:
            True if valid, False otherwise
        """
        required_fields = ['title', 'channel', 'view_count', 'published_date']
        
        if not SecurityValidator.validate_json_structure(news_item, required_fields):
            return False
            
        # Validate specific fields
        title = news_item.get('title', '')
        if not title or len(title) > 500:
            logger.warning("Invalid news title")
            return False
            
        channel = news_item.get('channel', '')
        if not channel or len(channel) > 200:
            logger.warning("Invalid news channel")
            return False
            
        # Validate video ID if present
        video_id = news_item.get('video_id')
        if video_id and not SecurityValidator.validate_youtube_video_id(video_id):
            logger.warning(f"Invalid YouTube video ID: {video_id}")
            return False
            
        return True

class FileValidator:
    """File operation security validator"""
    
    # Allowed file extensions
    ALLOWED_JSON_EXTENSIONS = ['.json']
    ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    ALLOWED_LOG_EXTENSIONS = ['.log', '.txt']
    
    @staticmethod
    def validate_file_path(file_path: Union[str, Path], 
                          allowed_extensions: Optional[List[str]] = None,
                          must_exist: bool = False) -> bool:
        """
        Validate file path for security
        
        Args:
            file_path: File path to validate
            allowed_extensions: List of allowed file extensions
            must_exist: Whether file must exist
            
        Returns:
            True if valid, False otherwise
        """
        try:
            path = Path(file_path)
            
            # Check for path traversal
            if '..' in str(path):
                logger.warning(f"Potential path traversal: {path}")
                return False
                
            # Check extension if specified
            if allowed_extensions:
                if path.suffix.lower() not in allowed_extensions:
                    logger.warning(f"File extension not allowed: {path.suffix}")
                    return False
                    
            # Check existence if required
            if must_exist and not path.exists():
                logger.warning(f"Required file does not exist: {path}")
                return False
                
            return True
            
        except Exception as e:
            logger.warning(f"File path validation error: {e}")
            return False
    
    @staticmethod
    def safe_read_json(file_path: Union[str, Path], max_size: int = 50 * 1024 * 1024) -> Optional[Any]:
        """
        Safely read JSON file with size and security checks
        
        Args:
            file_path: Path to JSON file
            max_size: Maximum file size in bytes (default 50MB)
            
        Returns:
            Parsed JSON data or None if invalid
        """
        try:
            path = Path(file_path)
            
            # Validate path
            if not FileValidator.validate_file_path(
                path, 
                FileValidator.ALLOWED_JSON_EXTENSIONS, 
                must_exist=True
            ):
                return None
                
            # Check file size
            if path.stat().st_size > max_size:
                logger.warning(f"File too large: {path.stat().st_size} > {max_size}")
                return None
                
            # Read and parse JSON
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            logger.info(f"Successfully read JSON file: {path}")
            return data
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error in {file_path}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error reading file {file_path}: {e}")
            return None
    
    @staticmethod
    def safe_write_json(data: Any, file_path: Union[str, Path], 
                       backup: bool = True) -> bool:
        """
        Safely write JSON file with backup and validation
        
        Args:
            data: Data to write
            file_path: Path to write to
            backup: Whether to create backup of existing file
            
        Returns:
            True if successful, False otherwise
        """
        try:
            path = Path(file_path)
            
            # Validate path
            if not FileValidator.validate_file_path(
                path, 
                FileValidator.ALLOWED_JSON_EXTENSIONS
            ):
                return False
                
            # Create backup if requested and file exists
            if backup and path.exists():
                backup_path = path.with_suffix(f'.backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
                path.rename(backup_path)
                logger.info(f"Created backup: {backup_path}")
                
            # Write JSON data
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
            logger.info(f"Successfully wrote JSON file: {path}")
            return True
            
        except Exception as e:
            logger.error(f"Error writing file {file_path}: {e}")
            return False

# Convenience functions for common validations
def validate_news_data(news_data: List[Dict[str, Any]]) -> bool:
    """Validate entire news data list"""
    if not isinstance(news_data, list):
        logger.error("News data must be a list")
        return False
        
    for i, item in enumerate(news_data):
        if not SecurityValidator.validate_news_item(item):
            logger.error(f"Invalid news item at index {i}")
            return False
            
    return True

def safe_get_env_var(var_name: str, default: Optional[str] = None, 
                    required: bool = False) -> Optional[str]:
    """Safely get environment variable with validation"""
    import os
    
    value = os.getenv(var_name, default)
    
    if required and not value:
        logger.error(f"Required environment variable not set: {var_name}")
        raise ValidationError(f"Required environment variable not set: {var_name}")
        
    return value 