#!/usr/bin/env python3
"""
Verify AI image setup for TrendSiam
Checks bucket configuration, sample URLs, and database state
"""

import os
import sys
import logging
from datetime import datetime, timezone
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def verify_storage_setup():
    """Verify Supabase storage configuration"""
    logger.info("🔍 Verifying AI Image Storage Setup...\n")
    
    try:
        from supabase import create_client
        from core.storage_config import get_storage_config, get_bucket_name
        
        # Get configuration
        config = get_storage_config()
        bucket_name = get_bucket_name()
        
        logger.info(f"📦 Bucket name: {bucket_name}")
        logger.info(f"🌐 Supabase URL: {config.supabase_url}")
        
        # Create Supabase client
        supabase = create_client(config.supabase_url, config.service_role_key)
        
        # Check bucket exists
        logger.info("\n🔍 Checking bucket existence...")
        try:
            buckets = supabase.storage.list_buckets()
            bucket_exists = any(b.name == bucket_name for b in buckets)
            
            if bucket_exists:
                logger.info(f"✅ Bucket '{bucket_name}' exists")
                
                # Check if bucket is public
                bucket_info = next((b for b in buckets if b.name == bucket_name), None)
                if bucket_info and hasattr(bucket_info, 'public'):
                    if bucket_info.public:
                        logger.info(f"✅ Bucket is PUBLIC (images will be accessible)")
                    else:
                        logger.warning(f"⚠️  Bucket is PRIVATE (images won't load without auth)")
                        logger.info("   Fix: Update bucket to public in Supabase dashboard")
            else:
                logger.error(f"❌ Bucket '{bucket_name}' does not exist")
                logger.info("   Fix: Create bucket in Supabase dashboard or run setup script")
        except Exception as e:
            logger.error(f"❌ Failed to check buckets: {e}")
        
        # Check sample file access
        logger.info("\n🔍 Testing sample public URL...")
        sample_path = "test_image.webp"
        public_url = config.get_public_url(sample_path)
        logger.info(f"📍 Sample URL: {public_url}")
        logger.info("   (Test this URL in a browser - should return 404 if file doesn't exist)")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Storage verification failed: {e}")
        return False

def verify_database_state():
    """Check database for Top 3 AI images"""
    logger.info("\n🔍 Checking Database State...\n")
    
    try:
        from supabase import create_client
        
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if not supabase_url or not supabase_key:
            logger.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
            return False
        
        supabase = create_client(supabase_url, supabase_key)
        
        # Get today's date in Asia/Bangkok
        from datetime import datetime
        import pytz
        
        bangkok_tz = pytz.timezone('Asia/Bangkok')
        today = datetime.now(bangkok_tz).date()
        
        logger.info(f"📅 Checking data for: {today} (Asia/Bangkok)")
        
        # Query Top 3
        result = supabase.table('news_trends').select(
            'video_id', 'title', 'popularity_score_precise', 'ai_image_url', 'image_status'
        ).eq('date', str(today)).not_('popularity_score_precise', 'is', None).order(
            'popularity_score_precise', desc=True
        ).order('view_count', desc=True).order('published_date', desc=True).order('title').limit(3).execute()
        
        if result.data:
            logger.info(f"\n📊 Top 3 Stories for Today:")
            for i, item in enumerate(result.data, 1):
                has_image = bool(item.get('ai_image_url'))
                status = item.get('image_status', 'unknown')
                
                logger.info(f"\n#{i}: {item['title'][:50]}...")
                logger.info(f"   Score: {item.get('popularity_score_precise', 0)}")
                logger.info(f"   Has AI Image: {'✅ YES' if has_image else '❌ NO'}")
                logger.info(f"   Image Status: {status}")
                
                if has_image:
                    logger.info(f"   URL: {item['ai_image_url'][:80]}...")
        else:
            logger.warning("⚠️  No data found for today")
            logger.info("   Fix: Run the pipeline to generate today's data")
        
        # Summary
        with_images = sum(1 for item in (result.data or []) if item.get('ai_image_url'))
        logger.info(f"\n📊 Summary: {with_images}/3 Top stories have AI images")
        
        if with_images < 3:
            logger.info("\n💡 To generate missing images:")
            logger.info("   python summarize_all_v2.py --limit 20 --generate-images")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Database verification failed: {e}")
        return False

def main():
    """Run all verifications"""
    logger.info("=" * 60)
    logger.info("🎨 TrendSiam AI Image Setup Verification")
    logger.info("=" * 60)
    
    # Verify storage
    storage_ok = verify_storage_setup()
    
    # Verify database
    db_ok = verify_database_state()
    
    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("📊 VERIFICATION SUMMARY")
    logger.info("=" * 60)
    
    logger.info(f"Storage Setup: {'✅ OK' if storage_ok else '❌ FAILED'}")
    logger.info(f"Database State: {'✅ OK' if db_ok else '❌ NEEDS ATTENTION'}")
    
    if storage_ok and db_ok:
        logger.info("\n✅ All checks passed! AI images should work correctly.")
    else:
        logger.info("\n⚠️  Some issues found. Please address them for images to work.")
    
    logger.info("\n💡 Next Steps:")
    logger.info("1. Ensure bucket is PUBLIC in Supabase dashboard")
    logger.info("2. Run pipeline: python summarize_all_v2.py --generate-images")
    logger.info("3. Check Home page for AI images on Top 3 stories")

if __name__ == "__main__":
    main()
