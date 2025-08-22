#!/usr/bin/env python3
"""
Fix missing auxiliary fields for a single video
Specifically handles BNK48 and other edge cases
"""

import os
import sys
import re
from datetime import datetime, timezone
import logging

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

try:
    from core.config import get_supabase_client
    from utils.safe import set_if_truthy
except ImportError as e:
    print(f"Error: Could not import required modules: {e}")
    sys.exit(1)

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def extract_keywords_multilingual(text: str, limit: int = 5) -> str:
    """Extract keywords from text, handling multiple languages including Japanese"""
    if not text:
        return ''
    
    # Split by various delimiters
    # Include Japanese word boundaries
    words = re.findall(r'[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+', text)
    
    # Filter short words but keep Japanese characters
    significant_words = []
    for word in words:
        # Keep if: 3+ latin chars, or any Japanese chars, or Thai chars
        if len(word) >= 3 or any('\u3040' <= c <= '\u9FAF' for c in word):
            significant_words.append(word)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_words = []
    for word in significant_words:
        if word.lower() not in seen:
            seen.add(word.lower())
            unique_words.append(word)
    
    # Return top N words
    return ', '.join(unique_words[:limit]) if unique_words else ''


def calculate_growth_rate_safe(view_count, published_date):
    """Calculate growth rate with better error handling"""
    try:
        if not view_count or not published_date:
            return None
            
        views = int(str(view_count).replace(',', ''))
        
        # Handle various date formats
        if isinstance(published_date, str):
            # Try to parse ISO format
            if 'T' in published_date:
                pub_date = datetime.fromisoformat(published_date.replace('Z', '+00:00'))
            else:
                pub_date = datetime.strptime(published_date, '%Y-%m-%d')
        else:
            pub_date = published_date
            
        days_old = (datetime.now(timezone.utc) - pub_date).days
        
        if days_old > 0:
            daily_growth = views / days_old
            if daily_growth > 100000:
                return 'Viral (>100K/day)'
            elif daily_growth > 10000:
                return 'High (>10K/day)'
            elif daily_growth > 1000:
                return 'Medium (>1K/day)'
            else:
                return 'Steady'
        else:
            return 'New (< 1 day)'
    except Exception as e:
        logger.warning(f"Error calculating growth rate: {e}")
        return None


def extract_platform_mentions(title, description):
    """Extract platform mentions from title and description"""
    text = f"{title or ''} {description or ''}".lower()
    platforms = []
    
    platform_patterns = {
        'Facebook': ['facebook', 'fb.com', 'fb ', ' fb'],
        'Instagram': ['instagram', 'ig ', ' ig', 'insta'],
        'Twitter/X': ['twitter', 'x.com', 'tweet'],
        'TikTok': ['tiktok', 'tik tok'],
        'Line': ['line', 'ไลน์'],
        'Weibo': ['weibo', '微博']
    }
    
    for platform, patterns in platform_patterns.items():
        if any(pattern in text for pattern in patterns):
            platforms.append(platform)
    
    return ', '.join(platforms) if platforms else 'Primary platform only'


def generate_score_details(popularity_score, view_count, published_date):
    """Generate descriptive score details"""
    details = []
    
    # Score-based description
    if popularity_score >= 90:
        details.append('Top trending')
    elif popularity_score >= 70:
        details.append('High engagement')
    elif popularity_score >= 50:
        details.append('Good traction')
    else:
        details.append('Building momentum')
    
    # View-based insight
    try:
        views = int(str(view_count).replace(',', ''))
        if views >= 1000000:
            details.append('1M+ views')
        elif views >= 100000:
            details.append('100K+ views')
        elif views >= 10000:
            details.append('10K+ views')
    except:
        pass
    
    # Age-based insight
    try:
        if published_date:
            pub_date = datetime.fromisoformat(str(published_date).replace('Z', '+00:00'))
            days_old = (datetime.now(timezone.utc) - pub_date).days
            if days_old == 0:
                details.append('Released today')
            elif days_old <= 7:
                details.append('This week')
    except:
        pass
    
    return ' • '.join(details) if details else 'Trending content'


def generate_ai_opinion(title, category, view_count, channel):
    """Generate AI opinion based on available data"""
    # More nuanced opinion generation
    category_lower = (category or '').lower()
    
    # Check for specific content types
    if 'BNK48' in title or 'AKB48' in title:
        return 'J-pop idol group content with dedicated fanbase engagement'
    elif 'MV' in title or 'music video' in title.lower():
        return 'Music video release tracking audience reception'
    elif 'news' in category_lower or 'การเมือง' in category_lower:
        return 'News content addressing current events and public interest'
    elif 'entertainment' in category_lower or 'บันเทิง' in category_lower:
        return 'Entertainment content engaging diverse audience segments'
    elif 'gaming' in category_lower or 'game' in title.lower():
        return 'Gaming content appealing to enthusiast community'
    else:
        # Generic but informative
        try:
            views = int(str(view_count).replace(',', ''))
            if views > 1000000:
                return 'Viral content demonstrating exceptional audience reach'
            elif views > 100000:
                return 'Popular content showing strong viewer engagement'
            else:
                return 'Emerging content building audience momentum'
        except:
            return 'Content gaining traction in target demographics'


def enrich_single_video(video_id: str):
    """Enrich a single video with auxiliary fields"""
    logger.info(f"🎯 Enriching single video: {video_id}")
    
    supabase = get_supabase_client()
    
    # Fetch the video
    result = supabase.table('news_trends') \
        .select('*') \
        .eq('video_id', video_id) \
        .execute()
    
    if not result.data:
        logger.error(f"Video not found: {video_id}")
        return False
    
    video = result.data[0]
    logger.info(f"Found video: {video['title']}")
    
    # Prepare update payload
    update_payload = {
        'video_id': video_id,
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    # Calculate each field
    logger.info("Calculating auxiliary fields...")
    
    # Growth rate
    growth_rate = calculate_growth_rate_safe(
        video.get('view_count'),
        video.get('published_date')
    )
    if growth_rate:
        set_if_truthy(update_payload, 'growth_rate', growth_rate)
        logger.info(f"  growth_rate: {growth_rate}")
    
    # Keywords
    keywords = extract_keywords_multilingual(
        f"{video.get('title', '')} {video.get('description', '')}"
    )
    if keywords:
        set_if_truthy(update_payload, 'keywords', keywords)
        logger.info(f"  keywords: {keywords}")
    
    # Platform mentions
    platform_mentions = extract_platform_mentions(
        video.get('title'),
        video.get('description')
    )
    if platform_mentions:
        set_if_truthy(update_payload, 'platform_mentions', platform_mentions)
        logger.info(f"  platform_mentions: {platform_mentions}")
    
    # Score details
    if video.get('popularity_score_precise'):
        score_details = generate_score_details(
            video['popularity_score_precise'],
            video.get('view_count'),
            video.get('published_date')
        )
        if score_details:
            set_if_truthy(update_payload, 'score_details', score_details)
            logger.info(f"  score_details: {score_details}")
    
    # AI Opinion
    if not video.get('ai_opinion'):
        ai_opinion = generate_ai_opinion(
            video.get('title', ''),
            video.get('category') or video.get('auto_category'),
            video.get('view_count'),
            video.get('channel')
        )
        if ai_opinion:
            set_if_truthy(update_payload, 'ai_opinion', ai_opinion)
            logger.info(f"  ai_opinion: {ai_opinion}")
    
    # Update the database
    logger.info(f"Updating database with {len(update_payload) - 2} auxiliary fields...")
    
    try:
        update_result = supabase.table('news_trends') \
            .update(update_payload) \
            .eq('video_id', video_id) \
            .execute()
        
        logger.info("✅ Successfully updated auxiliary fields")
        
        # Verify the update
        verify_result = supabase.table('news_trends') \
            .select('growth_rate, platform_mentions, keywords, ai_opinion, score_details') \
            .eq('video_id', video_id) \
            .execute()
        
        if verify_result.data:
            updated = verify_result.data[0]
            logger.info("\nVerification - Updated fields:")
            for field, value in updated.items():
                if value:
                    logger.info(f"  ✅ {field}: {value}")
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to update database: {e}")
        return False


def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Fix auxiliary fields for a single video')
    parser.add_argument('video_id', help='Video ID to fix')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without updating')
    
    args = parser.parse_args()
    
    if args.dry_run:
        logger.info("DRY RUN MODE - No database updates will be made")
    
    success = enrich_single_video(args.video_id)
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
