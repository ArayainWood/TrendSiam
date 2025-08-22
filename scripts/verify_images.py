#!/usr/bin/env python3
"""
Image Verification and Regeneration Script for TrendSiam

This script provides diagnostic capabilities to:
- List recent items missing AI images
- Verify existing image URLs are accessible
- Optionally regenerate missing images
"""

import os
import sys
import argparse
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Load environment
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def verify_supabase_connection():
    """Verify Supabase connection and return client."""
    try:
        from supabase import create_client
        
        supabase_url = os.getenv('SUPABASE_URL')
        service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if not supabase_url or not service_key:
            logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
            return None
        
        client = create_client(supabase_url, service_key)
        
        # Test connection
        result = client.table('news_trends').select('id', count='exact').limit(1).execute()
        logger.info(f"✅ Supabase connected - {result.count} total records")
        
        return client
        
    except Exception as e:
        logger.error(f"❌ Supabase connection failed: {e}")
        return None

def get_recent_items_without_images(client, limit: int = 20) -> List[Dict[str, Any]]:
    """Get recent news items that are missing AI images."""
    try:
        # Query for recent items without AI images
        result = client.table('news_trends').select('''
            id, title, video_id, published_date, 
            popularity_score_precise, ai_image_url
        ''').is_('ai_image_url', 'null').order(
            'popularity_score_precise', desc=True
        ).order('id', desc=False).limit(limit).execute()
        
        items = result.data or []
        logger.info(f"📊 Found {len(items)} recent items without AI images")
        
        return items
        
    except Exception as e:
        logger.error(f"❌ Failed to query items without images: {e}")
        return []

def verify_image_url(url: str) -> bool:
    """Verify that an image URL is accessible."""
    try:
        import requests
        
        response = requests.head(url, timeout=10)
        return response.status_code == 200
        
    except Exception as e:
        logger.debug(f"Image URL check failed for {url}: {e}")
        return False

def check_existing_images(client, limit: int = 10) -> Dict[str, Any]:
    """Check accessibility of existing AI image URLs."""
    try:
        # Get recent items with AI images
        result = client.table('news_trends').select('''
            id, title, ai_image_url
        ''').not_.is_('ai_image_url', 'null').order(
            'updated_at', desc=True
        ).limit(limit).execute()
        
        items = result.data or []
        logger.info(f"🔍 Checking {len(items)} recent images...")
        
        accessible = 0
        broken = 0
        broken_urls = []
        
        for item in items:
            url = item.get('ai_image_url')
            if url and verify_image_url(url):
                accessible += 1
                logger.debug(f"✅ Accessible: {url[:60]}...")
            else:
                broken += 1
                broken_urls.append({
                    'id': item.get('id'),
                    'title': item.get('title', '')[:50] + '...',
                    'url': url
                })
                logger.warning(f"❌ Broken: {url[:60]}...")
        
        return {
            'total_checked': len(items),
            'accessible': accessible,
            'broken': broken,
            'broken_items': broken_urls
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to check existing images: {e}")
        return {'total_checked': 0, 'accessible': 0, 'broken': 0, 'broken_items': []}

def regenerate_missing_images(client, items: List[Dict[str, Any]], dry_run: bool = True) -> None:
    """Regenerate missing images for provided items."""
    if not items:
        logger.info("No items to regenerate images for")
        return
    
    if dry_run:
        logger.info(f"🔍 DRY RUN: Would regenerate images for {len(items)} items")
        for item in items[:5]:  # Show first 5
            logger.info(f"   - {item.get('title', 'No title')[:60]}...")
        if len(items) > 5:
            logger.info(f"   ... and {len(items) - 5} more items")
        return
    
    logger.info(f"🎨 Regenerating images for {len(items)} items...")
    
    try:
        from ai_image_supabase_generator import SupabaseAIImageGenerator
        from core.storage_config import get_bucket_name
        
        bucket_name = get_bucket_name()
        generator = SupabaseAIImageGenerator(client, bucket_name)
        
        if not generator.ensure_bucket_exists():
            logger.error("❌ Cannot access bucket - aborting regeneration")
            return
        
        success_count = 0
        failed_count = 0
        
        for i, item in enumerate(items, 1):
            story_id = item.get('story_id') or item.get('video_id')
            title = item.get('title', 'Unknown')[:50]
            
            logger.info(f"🎨 [{i}/{len(items)}] Generating image for: {title}...")
            
            try:
                success, url, status = generator.generate_and_upload_image(item)
                
                if success and url:
                    success_count += 1
                    logger.info(f"   ✅ Generated: {url[:60]}...")
                else:
                    failed_count += 1
                    logger.warning(f"   ❌ Failed: {status}")
                    
            except Exception as e:
                failed_count += 1
                logger.error(f"   ❌ Error: {e}")
        
        logger.info(f"🎯 Regeneration complete: {success_count} success, {failed_count} failed")
        
    except ImportError as e:
        logger.error(f"❌ Image generator not available: {e}")
    except Exception as e:
        logger.error(f"❌ Regeneration failed: {e}")

def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Verify and regenerate AI images for TrendSiam")
    parser.add_argument('--verify-images', action='store_true', help='Check existing image URLs')
    parser.add_argument('--list-missing', action='store_true', help='List items missing AI images')
    parser.add_argument('--regenerate', action='store_true', help='Regenerate missing images')
    parser.add_argument('--limit', type=int, default=20, help='Number of items to process (default: 20)')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')
    
    args = parser.parse_args()
    
    if not any([args.verify_images, args.list_missing, args.regenerate]):
        parser.print_help()
        return 1
    
    # Connect to Supabase
    client = verify_supabase_connection()
    if not client:
        return 1
    
    # Verify existing images
    if args.verify_images:
        logger.info("🔍 Verifying existing image URLs...")
        results = check_existing_images(client, args.limit)
        
        logger.info("📊 Image Verification Results:")
        logger.info(f"   Total checked: {results['total_checked']}")
        logger.info(f"   Accessible: {results['accessible']}")
        logger.info(f"   Broken: {results['broken']}")
        
        if results['broken_items']:
            logger.info("❌ Broken images:")
            for item in results['broken_items']:
                logger.info(f"   - {item['title']} (ID: {item['id']})")
    
    # List missing images
    if args.list_missing:
        logger.info("📋 Listing items missing AI images...")
        missing_items = get_recent_items_without_images(client, args.limit)
        
        if missing_items:
            logger.info(f"📝 Items missing AI images:")
            for i, item in enumerate(missing_items, 1):
                score = item.get('popularity_score_precise') or 0
                logger.info(f"   {i:2d}. {item.get('title', 'No title')[:60]}... (Score: {score:.1f})")
        else:
            logger.info("✅ All recent items have AI images!")
    
    # Regenerate missing images
    if args.regenerate:
        logger.info("🎨 Regenerating missing images...")
        missing_items = get_recent_items_without_images(client, args.limit)
        regenerate_missing_images(client, missing_items, args.dry_run)
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
