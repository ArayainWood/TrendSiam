#!/usr/bin/env python3
"""
Environment Setup Script for TrendSiam
Creates .env file with proper configuration
"""

import os
from pathlib import Path

def create_env_file():
    """Create .env file with template configuration."""
    
    env_content = """# TrendSiam Environment Configuration
# Replace placeholder values with your actual credentials

# ===============================================
# SUPABASE CONFIGURATION (Required)
# ===============================================

# Get these from your Supabase project dashboard -> Settings -> API
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...

# ===============================================
# API KEYS (Optional but recommended)
# ===============================================

# YouTube Data API v3 (for live metrics)
YOUTUBE_API_KEY=your_youtube_api_key

# OpenAI API (for AI summaries and image generation)
OPENAI_API_KEY=sk-proj-your_openai_key

# ===============================================
# OPTIONAL CONFIGURATION
# ===============================================

# Next.js revalidation secret
REVALIDATE_SECRET=trendsiam_secret_2025

# Enable JSON fallback for testing (temporary)
ALLOW_JSON_FALLBACK=true

# ===============================================
# INSTRUCTIONS
# ===============================================
# 1. Replace the placeholder values above with your actual credentials
# 2. Get Supabase credentials from: https://supabase.com/dashboard/project/[your-project]/settings/api
# 3. Once configured, set ALLOW_JSON_FALLBACK=false for production use
"""
    
    env_file = Path('.env')
    
    if env_file.exists():
        print("⚠️  .env file already exists")
        choice = input("Do you want to overwrite it? (y/N): ").strip().lower()
        if choice != 'y':
            print("❌ Setup cancelled")
            return False
    
    try:
        with open(env_file, 'w', encoding='utf-8') as f:
            f.write(env_content)
        
        print("✅ Created .env file successfully!")
        print("\n📝 Next steps:")
        print("1. Edit .env file with your actual Supabase credentials")
        print("2. Get credentials from: https://supabase.com/dashboard/project/[your-project]/settings/api")
        print("3. Run: python summarize_all_v2.py --limit 5 --verbose --dry-run")
        
        return True
        
    except Exception as e:
        print(f"❌ Failed to create .env file: {e}")
        return False

def test_with_fallback():
    """Test the pipeline with JSON fallback enabled."""
    print("\n🧪 Testing pipeline with JSON fallback...")
    
    # Set environment variable for this test
    os.environ['ALLOW_JSON_FALLBACK'] = 'true'
    
    try:
        import subprocess
        result = subprocess.run([
            'python', 'summarize_all_v2.py', 
            '--limit', '5', 
            '--verbose', 
            '--dry-run'
        ], capture_output=True, text=True, timeout=60)
        
        print("📊 Pipeline test output:")
        print(result.stdout)
        
        if result.stderr:
            print("⚠️  Warnings/Errors:")
            print(result.stderr)
        
        if result.returncode == 0:
            print("✅ Pipeline test successful with JSON fallback!")
            return True
        else:
            print(f"❌ Pipeline test failed with exit code: {result.returncode}")
            return False
            
    except subprocess.TimeoutExpired:
        print("⏰ Pipeline test timed out (this might be normal for large datasets)")
        return False
    except Exception as e:
        print(f"❌ Pipeline test failed: {e}")
        return False

def check_existing_env():
    """Check if environment variables are already set."""
    supabase_url = os.getenv('SUPABASE_URL')
    service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    print("🔍 Checking current environment...")
    print(f"SUPABASE_URL: {'✅ Set' if supabase_url else '❌ Missing'}")
    print(f"SUPABASE_SERVICE_ROLE_KEY: {'✅ Set' if service_key else '❌ Missing'}")
    
    if supabase_url and service_key:
        print("✅ Supabase credentials found in environment!")
        return True
    else:
        print("❌ Supabase credentials missing")
        return False

def main():
    print("🔧 TrendSiam Environment Setup")
    print("=" * 40)
    
    # Check existing environment
    if check_existing_env():
        print("\n🎉 Environment already configured!")
        choice = input("Test pipeline now? (Y/n): ").strip().lower()
        if choice != 'n':
            test_with_fallback()
        return
    
    # Create .env file
    print("\n📝 Creating .env file...")
    if create_env_file():
        print("\n🧪 Testing with JSON fallback (temporary)...")
        if test_with_fallback():
            print("\n🎯 Setup complete! Next steps:")
            print("1. Edit .env with your actual Supabase credentials")
            print("2. Set ALLOW_JSON_FALLBACK=false for production")
            print("3. Run: python summarize_all_v2.py --limit 20 --verbose --force-refresh-stats")
        else:
            print("\n⚠️  Test failed. Check the error messages above.")

if __name__ == "__main__":
    main()
