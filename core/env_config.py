#!/usr/bin/env python3
"""
Secure Environment Configuration Module

This module provides centralized, validated environment configuration
with no hardcoded secrets. All sensitive values must come from environment.
"""

import os
from typing import Optional, Dict, Any, List
from pathlib import Path
from dataclasses import dataclass
import json
import sys

# Try to import python-dotenv if available
try:
    from dotenv import load_dotenv
    HAS_DOTENV = True
except ImportError:
    HAS_DOTENV = False


@dataclass
class EnvConfig:
    """Validated environment configuration"""
    # Supabase (Required)
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str
    
    # API Keys (Optional but recommended)
    openai_api_key: Optional[str] = None
    youtube_api_key: Optional[str] = None
    
    # Security
    revalidate_secret: Optional[str] = None
    trendsiam_dev_password: Optional[str] = None
    
    # Feature flags
    allow_json_fallback: bool = True
    environment: str = "development"
    
    # Limits
    openai_max_tokens: int = 150
    rate_limit_requests: int = 60
    rate_limit_window: int = 60  # seconds
    
    def __post_init__(self):
        """Validate configuration after initialization"""
        # Validate Supabase URL
        if not self.supabase_url.startswith('https://') or not self.supabase_url.endswith('.supabase.co'):
            raise ValueError(f"Invalid Supabase URL format: {self.supabase_url}")
            
        # Validate JWT tokens
        for key_name, key_value in [
            ('supabase_service_role_key', self.supabase_service_role_key),
            ('supabase_anon_key', self.supabase_anon_key)
        ]:
            if not key_value.startswith('eyJ'):
                raise ValueError(f"Invalid {key_name} format")
                
        # Validate OpenAI key if provided
        if self.openai_api_key and not self.openai_api_key.startswith('sk-'):
            raise ValueError("Invalid OpenAI API key format")
            
        # Validate YouTube key if provided
        if self.youtube_api_key and not self.youtube_api_key.startswith('AIza'):
            raise ValueError("Invalid YouTube API key format")
            
        # Validate token limits
        if self.openai_max_tokens <= 0 or self.openai_max_tokens > 4000:
            raise ValueError(f"Invalid openai_max_tokens: {self.openai_max_tokens}")
            
        # Validate rate limits
        if self.rate_limit_requests <= 0:
            raise ValueError(f"Invalid rate_limit_requests: {self.rate_limit_requests}")
            
    def to_safe_dict(self) -> Dict[str, Any]:
        """Return config as dict with masked sensitive values"""
        return {
            'supabase_url': self.supabase_url,
            'supabase_service_role_key': self._mask_secret(self.supabase_service_role_key),
            'supabase_anon_key': self._mask_secret(self.supabase_anon_key),
            'openai_api_key': self._mask_secret(self.openai_api_key) if self.openai_api_key else None,
            'youtube_api_key': self._mask_secret(self.youtube_api_key) if self.youtube_api_key else None,
            'revalidate_secret': '***' if self.revalidate_secret else None,
            'environment': self.environment,
            'allow_json_fallback': self.allow_json_fallback,
            'openai_max_tokens': self.openai_max_tokens,
            'rate_limit_requests': self.rate_limit_requests,
            'rate_limit_window': self.rate_limit_window
        }
        
    @staticmethod
    def _mask_secret(secret: str) -> str:
        """Mask a secret for safe display"""
        if len(secret) <= 8:
            return '***'
        return f"{secret[:4]}...{secret[-4:]}"


class EnvConfigLoader:
    """Secure environment configuration loader"""
    
    REQUIRED_VARS = [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'SUPABASE_ANON_KEY'
    ]
    
    OPTIONAL_VARS = [
        'OPENAI_API_KEY',
        'YOUTUBE_API_KEY',
        'REVALIDATE_SECRET',
        'TRENDSIAM_DEV_PASSWORD',
        'ALLOW_JSON_FALLBACK',
        'ENVIRONMENT',
        'OPENAI_MAX_TOKENS',
        'RATE_LIMIT_REQUESTS',
        'RATE_LIMIT_WINDOW'
    ]
    
    def __init__(self, env_file: Optional[str] = None):
        """Initialize loader with optional .env file path"""
        self.env_file = env_file or '.env'
        self.errors: List[str] = []
        self.warnings: List[str] = []
        
    def load(self) -> Optional[EnvConfig]:
        """Load and validate environment configuration"""
        # Load .env file if available
        if HAS_DOTENV and Path(self.env_file).exists():
            load_dotenv(self.env_file)
            
        # Check for required variables
        missing_required = []
        for var in self.REQUIRED_VARS:
            if not os.getenv(var):
                missing_required.append(var)
                
        if missing_required:
            self.errors.append(f"Missing required environment variables: {', '.join(missing_required)}")
            return None
            
        # Check for optional variables
        missing_optional = []
        for var in self.OPTIONAL_VARS:
            if not os.getenv(var):
                missing_optional.append(var)
                
        if missing_optional:
            self.warnings.append(f"Missing optional environment variables: {', '.join(missing_optional)}")
            
        try:
            # Create config object
            config = EnvConfig(
                # Required
                supabase_url=os.getenv('SUPABASE_URL'),
                supabase_service_role_key=os.getenv('SUPABASE_SERVICE_ROLE_KEY'),
                supabase_anon_key=os.getenv('SUPABASE_ANON_KEY'),
                
                # Optional
                openai_api_key=os.getenv('OPENAI_API_KEY'),
                youtube_api_key=os.getenv('YOUTUBE_API_KEY'),
                revalidate_secret=os.getenv('REVALIDATE_SECRET'),
                trendsiam_dev_password=os.getenv('TRENDSIAM_DEV_PASSWORD'),
                
                # Feature flags
                allow_json_fallback=os.getenv('ALLOW_JSON_FALLBACK', 'true').lower() == 'true',
                environment=os.getenv('ENVIRONMENT', 'development'),
                
                # Limits
                openai_max_tokens=int(os.getenv('OPENAI_MAX_TOKENS', '150')),
                rate_limit_requests=int(os.getenv('RATE_LIMIT_REQUESTS', '60')),
                rate_limit_window=int(os.getenv('RATE_LIMIT_WINDOW', '60'))
            )
            
            return config
            
        except (ValueError, TypeError) as e:
            self.errors.append(f"Configuration validation error: {str(e)}")
            return None
            
    def create_env_template(self, output_path: str = '.env.example') -> bool:
        """Create a template .env file with placeholders"""
        template = """# TrendSiam Environment Configuration Template
# Copy this file to .env and fill in your actual values
# NEVER commit the .env file to version control

# ===============================================
# SUPABASE CONFIGURATION (Required)
# ===============================================
# Get these from: https://app.supabase.com/project/YOUR_PROJECT/settings/api
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ... (your service role key)
SUPABASE_ANON_KEY=eyJ... (your anon key)

# ===============================================
# API KEYS (Optional but recommended)
# ===============================================
# OpenAI API key for summaries and image generation
# Get from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-...

# YouTube Data API key for view count updates
# Get from: https://console.cloud.google.com/apis/credentials
YOUTUBE_API_KEY=AIzaSy...

# ===============================================
# SECURITY (Optional)
# ===============================================
# Secret for revalidation endpoints
REVALIDATE_SECRET=your-secret-here

# Developer mode password
TRENDSIAM_DEV_PASSWORD=your-dev-password

# ===============================================
# FEATURE FLAGS & LIMITS
# ===============================================
# Allow fallback to JSON when Supabase is unavailable
ALLOW_JSON_FALLBACK=true

# Environment: development, staging, production
ENVIRONMENT=development

# OpenAI max tokens for summaries
OPENAI_MAX_TOKENS=150

# Rate limiting
RATE_LIMIT_REQUESTS=60
RATE_LIMIT_WINDOW=60
"""
        
        try:
            with open(output_path, 'w') as f:
                f.write(template)
            return True
        except Exception as e:
            self.errors.append(f"Failed to create template: {str(e)}")
            return False
            
    def validate_env_file_security(self) -> bool:
        """Check if .env file has proper security settings"""
        env_path = Path(self.env_file)
        
        if not env_path.exists():
            self.warnings.append(f"{self.env_file} not found")
            return True  # Not an error if it doesn't exist
            
        # Check if .env is in .gitignore
        gitignore_path = Path('.gitignore')
        if gitignore_path.exists():
            with open(gitignore_path, 'r') as f:
                gitignore_content = f.read()
                if '.env' not in gitignore_content and self.env_file not in gitignore_content:
                    self.errors.append(f"{self.env_file} is not in .gitignore!")
                    return False
                    
        # Check file permissions on Unix-like systems
        if os.name != 'nt':
            stat_info = env_path.stat()
            if stat_info.st_mode & 0o077:
                self.warnings.append(f"{self.env_file} has overly permissive permissions")
                
        return True


# Global config instance
_config: Optional[EnvConfig] = None
_loader: Optional[EnvConfigLoader] = None


def load_config(env_file: Optional[str] = None, fail_fast: bool = True) -> Optional[EnvConfig]:
    """Load configuration from environment"""
    global _config, _loader
    
    if _config is not None:
        return _config
        
    _loader = EnvConfigLoader(env_file)
    
    # Validate .env file security
    _loader.validate_env_file_security()
    
    # Load configuration
    _config = _loader.load()
    
    # Print diagnostics
    if _loader.errors:
        print("❌ Configuration Errors:", file=sys.stderr)
        for error in _loader.errors:
            print(f"  - {error}", file=sys.stderr)
            
    if _loader.warnings:
        print("⚠️  Configuration Warnings:", file=sys.stderr)
        for warning in _loader.warnings:
            print(f"  - {warning}", file=sys.stderr)
            
    if _config:
        print("✅ Configuration loaded successfully")
        if os.getenv('DEBUG'):
            print("📋 Configuration (masked):")
            print(json.dumps(_config.to_safe_dict(), indent=2))
    else:
        print("❌ Failed to load configuration", file=sys.stderr)
        if fail_fast:
            sys.exit(1)
            
    return _config


def get_config() -> EnvConfig:
    """Get the current configuration (must be loaded first)"""
    if _config is None:
        raise RuntimeError("Configuration not loaded. Call load_config() first.")
    return _config


def create_template(output_path: str = '.env.example') -> bool:
    """Create a template .env file"""
    loader = EnvConfigLoader()
    success = loader.create_env_template(output_path)
    
    if success:
        print(f"✅ Created template at: {output_path}")
        print("📝 Copy to .env and fill in your values")
    else:
        print(f"❌ Failed to create template: {loader.errors}")
        
    return success


if __name__ == "__main__":
    # If run directly, create template or validate config
    import argparse
    
    parser = argparse.ArgumentParser(description="Environment configuration manager")
    parser.add_argument('--create-template', action='store_true', help='Create .env.example template')
    parser.add_argument('--validate', action='store_true', help='Validate current configuration')
    parser.add_argument('--env-file', default='.env', help='Path to .env file')
    
    args = parser.parse_args()
    
    if args.create_template:
        create_template()
    else:
        config = load_config(args.env_file, fail_fast=False)
        if config and args.validate:
            print("\n✅ Configuration is valid")
            print("\n📋 Loaded configuration (sensitive values masked):")
            print(json.dumps(config.to_safe_dict(), indent=2))
