#!/usr/bin/env python3
"""
Generate AI images for existing Top-3 items that are missing them
"""

import os
import sys
import logging
from dotenv import load_dotenv
from supabase import create_client

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment
load_dotenv()

# Get environment variables
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not url or not key:
    logger.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

# Create Supabase client
client = create_client(url, key)

def generate_images_for_top3():
    """Generate AI images for Top-3 items that are missing them"""
    
    # Get current Top-3 by popularity score
    logger.info("🔍 Fetching current Top-3 items by popularity score...")
    result = client.table('news_trends').select(
        'id,title,video_id,popularity_score_precise,ai_image_url,summary,channel'
    ).order('popularity_score_precise', desc=True).limit(3).execute()
    
    if not result.data:
        logger.error("❌ No data found in news_trends")
        return
    
    # Import the AI image generator
    try:
        from ai_image_supabase_generator import SupabaseAIImageGenerator
        
        # Initialize generator
        generator = SupabaseAIImageGenerator(client)
        
        # Ensure bucket exists
        if not generator.ensure_bucket_exists():
            logger.error("❌ Failed to ensure AI images bucket exists")
            return
            
    except Exception as e:
        logger.error(f"❌ Failed to initialize AI image generator: {e}")
        return
    
    # Process each Top-3 item
    for i, item in enumerate(result.data, 1):
        logger.info(f"\n{'='*60}")
        logger.info(f"Processing #{i}: {item['title'][:50]}...")
        logger.info(f"Score: {item['popularity_score_precise']}")
        
        if item['ai_image_url']:
            logger.info(f"✅ Already has AI image: {item['ai_image_url']}")
            continue
            
        logger.info("❌ Missing AI image - generating now...")
        
        # Prepare story object for generator
        story = {
            'story_id': item['id'][:16],  # Use first 16 chars of UUID
            'title': item['title'],
            'summary': item['summary'],
            'channel': item['channel'],
            'video_id': item['video_id']
        }
        
        # Generate and upload image
        success, image_url, status = generator.generate_and_upload_image(story)
        
        if success and image_url:
            logger.info(f"✅ Generated AI image: {image_url}")
            
            # Update database with new image URL
            update_result = client.table('news_trends').update({
                'ai_image_url': image_url,
                'ai_image_prompt': story.get('ai_image_prompt', '')
            }).eq('id', item['id']).execute()
            
            if update_result.data:
                logger.info("✅ Updated database with AI image URL")
            else:
                logger.error("❌ Failed to update database")
        else:
            logger.error(f"❌ Failed to generate AI image: {status}")
    
    logger.info(f"\n{'='*60}")
    logger.info("✅ AI image generation complete")
    
    # Show final status
    logger.info("\n📊 Final Top-3 status:")
    final_result = client.table('news_trends').select(
        'title,ai_image_url'
    ).order('popularity_score_precise', desc=True).limit(3).execute()
    
    for i, item in enumerate(final_result.data, 1):
        has_image = '✅' if item['ai_image_url'] else '❌'
        logger.info(f"{i}. {item['title'][:50]}... - AI Image: {has_image}")

if __name__ == "__main__":
    generate_images_for_top3()
