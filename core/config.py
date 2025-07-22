#!/usr/bin/env python3
"""
Secure Configuration Management for TrendSiam

This module provides centralized, secure configuration management
with proper validation, type checking, and error handling.
"""

import os
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from dataclasses import dataclass
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class APIConfig:
    """API configuration settings with validation"""
    openai_api_key: Optional[str] = None
    youtube_api_key: Optional[str] = None
    openai_model: str = "gpt-3.5-turbo"
    openai_max_tokens: int = 150
    openai_temperature: float = 0.3
    openai_timeout: int = 30
    openai_max_retries: int = 2
    request_timeout: int = 30
    
    def validate(self) -> bool:
        """Validate API configuration"""
        if self.openai_api_key and not self.openai_api_key.startswith('sk-'):
            logger.warning("OpenAI API key format appears invalid")
            return False
        
        if self.openai_max_tokens <= 0 or self.openai_max_tokens > 4000:
            logger.error("Invalid max_tokens value")
            return False
            
        if not 0.0 <= self.openai_temperature <= 2.0:
            logger.error("Invalid temperature value")
            return False
            
        return True

@dataclass
class AppConfig:
    """Application configuration settings"""
    data_file: str = "thailand_trending_summary.json"
    backup_file: str = "thailand_trending_api.json"
    images_dir: str = "ai_generated_images"
    log_level: str = "INFO"
    debug_mode: bool = False
    max_news_items: int = 50
    
    def validate(self) -> bool:
        """Validate application configuration"""
        if not self.data_file.endswith('.json'):
            logger.error("Data file must be a JSON file")
            return False
            
        if self.max_news_items <= 0 or self.max_news_items > 100:
            logger.error("Invalid max_news_items value")
            return False
            
        return True

class ConfigManager:
    """Secure configuration manager with validation and error handling"""
    
    def __init__(self, env_file: str = ".env"):
        """
        Initialize configuration manager
        
        Args:
            env_file: Path to environment file
        """
        self.env_file = Path(env_file)
        self.api_config: Optional[APIConfig] = None
        self.app_config: Optional[AppConfig] = None
        
        # Load configuration
        self._load_environment()
        self._load_configuration()
        
    def _load_environment(self) -> None:
        """Load environment variables securely"""
        try:
            if self.env_file.exists():
                load_dotenv(self.env_file)
                logger.info(f"Loaded environment from {self.env_file}")
            else:
                logger.info("No .env file found, using system environment variables")
        except Exception as e:
            logger.error(f"Error loading environment: {e}")
            
    def _load_configuration(self) -> None:
        """Load and validate all configuration"""
        try:
            # Load API configuration
            self.api_config = APIConfig(
                openai_api_key=os.getenv('OPENAI_API_KEY'),
                youtube_api_key=os.getenv('YOUTUBE_API_KEY'),
                openai_model=os.getenv('OPENAI_MODEL', 'gpt-3.5-turbo'),
                openai_max_tokens=int(os.getenv('OPENAI_MAX_TOKENS', '150')),
                openai_temperature=float(os.getenv('OPENAI_TEMPERATURE', '0.3')),
                openai_timeout=int(os.getenv('OPENAI_TIMEOUT', '30')),
                openai_max_retries=int(os.getenv('OPENAI_MAX_RETRIES', '2')),
                request_timeout=int(os.getenv('REQUEST_TIMEOUT', '30'))
            )
            
            # Load application configuration
            self.app_config = AppConfig(
                data_file=os.getenv('NEWS_DATA_FILE', 'thailand_trending_summary.json'),
                backup_file=os.getenv('BACKUP_DATA_FILE', 'thailand_trending_api.json'),
                images_dir=os.getenv('IMAGES_DIR', 'ai_generated_images'),
                log_level=os.getenv('LOG_LEVEL', 'INFO'),
                debug_mode=os.getenv('DEBUG_MODE', 'false').lower() == 'true',
                max_news_items=int(os.getenv('MAX_NEWS_ITEMS', '50'))
            )
            
            # Validate configurations
            if not self.api_config.validate():
                logger.warning("API configuration validation failed")
            
            if not self.app_config.validate():
                logger.warning("App configuration validation failed")
                
        except (ValueError, TypeError) as e:
            logger.error(f"Configuration error: {e}")
            raise
            
    def get_api_config(self) -> APIConfig:
        """Get API configuration with validation"""
        if not self.api_config:
            raise RuntimeError("API configuration not loaded")
        return self.api_config
        
    def get_app_config(self) -> AppConfig:
        """Get application configuration with validation"""
        if not self.app_config:
            raise RuntimeError("App configuration not loaded")
        return self.app_config
        
    def get_openai_client_config(self) -> Dict[str, Any]:
        """Get OpenAI client configuration safely"""
        api_config = self.get_api_config()
        
        if not api_config.openai_api_key:
            raise ValueError(
                "OpenAI API key not found. Please set OPENAI_API_KEY in your .env file"
            )
            
        return {
            'api_key': api_config.openai_api_key,
            'timeout': api_config.openai_timeout,
            'max_retries': api_config.openai_max_retries
        }
        
    def is_development(self) -> bool:
        """Check if running in development mode"""
        return self.app_config.debug_mode if self.app_config else False

# Global configuration instance
_config_manager: Optional[ConfigManager] = None

def get_config() -> ConfigManager:
    """Get global configuration manager instance"""
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigManager()
    return _config_manager

def reload_config() -> ConfigManager:
    """Reload configuration (useful for testing)"""
    global _config_manager
    _config_manager = ConfigManager()
    return _config_manager

# Convenience functions for backward compatibility
def get_openai_config() -> Dict[str, Any]:
    """Get OpenAI configuration for backward compatibility"""
    config = get_config()
    api_config = config.get_api_config()
    
    return {
        'OPENAI_API_KEY': api_config.openai_api_key,
        'OPENAI_MODEL': api_config.openai_model,
        'OPENAI_MAX_TOKENS': api_config.openai_max_tokens,
        'OPENAI_TEMPERATURE': api_config.openai_temperature,
        'OPENAI_TIMEOUT': api_config.openai_timeout,
        'OPENAI_MAX_RETRIES': api_config.openai_max_retries
    } 