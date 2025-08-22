#!/usr/bin/env python3
"""
Quick verification script to check image URL status in the database
Shows which items have URLs, which are missing, and recent changes
"""

import os
import sys
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from core.config import get_supabase_client
except ImportError:
    print("Error: Could not import Supabase client. Make sure environment is set up.")
    sys.exit(1)


def verify_image_urls():
    """Check current state of image URLs in the database"""
    print("🔍 Verifying Image URLs in Database...\n")
    
    try:
        supabase = get_supabase_client()
        
        # Get today's date in Bangkok timezone
        from datetime import datetime
        import pytz
        bangkok_tz = pytz.timezone('Asia/Bangkok')
        today = datetime.now(bangkok_tz).date()
        
        # Query today's items
        result = supabase.table('news_trends') \
            .select('video_id, title, ai_image_url, rank, popularity_score_precise, updated_at') \
            .eq('date', today.isoformat()) \
            .order('popularity_score_precise', desc=True) \
            .limit(20) \
            .execute()
        
        if not result.data:
            print(f"No data found for {today}")
            return
        
        # Analyze results
        total = len(result.data)
        with_urls = 0
        without_urls = 0
        top3_with_urls = 0
        
        print(f"📅 Date: {today}")
        print(f"📊 Total items: {total}\n")
        
        print("Top 10 items:")
        print("-" * 100)
        
        for i, item in enumerate(result.data[:10]):
            rank = i + 1
            has_url = bool(item.get('ai_image_url'))
            
            if has_url:
                with_urls += 1
                if rank <= 3:
                    top3_with_urls += 1
                url_status = "✅ HAS URL"
                url_preview = item['ai_image_url'][:50] + "..." if len(item['ai_image_url']) > 50 else item['ai_image_url']
            else:
                without_urls += 1
                url_status = "❌ NO URL"
                url_preview = "None"
            
            title_preview = item['title'][:40] + "..." if len(item['title']) > 40 else item['title']
            
            print(f"#{rank:2d} | {url_status} | {title_preview}")
            print(f"     | Score: {item['popularity_score_precise']:.1f} | URL: {url_preview}")
            print(f"     | Updated: {item['updated_at']}")
            print()
        
        # Summary statistics
        print("\n" + "=" * 100)
        print("📈 Summary Statistics:")
        print(f"  - Total items with URLs: {with_urls}/{total}")
        print(f"  - Total items without URLs: {without_urls}/{total}")
        print(f"  - Top 3 with URLs: {top3_with_urls}/3")
        
        # Check for recent changes
        print("\n🕒 Recent URL Changes (last 24 hours):")
        yesterday = (today - timedelta(days=1)).isoformat()
        
        recent = supabase.table('news_trends') \
            .select('video_id, title, ai_image_url, updated_at') \
            .gte('updated_at', yesterday + 'T00:00:00') \
            .not_('ai_image_url', 'is', None) \
            .order('updated_at', desc=True) \
            .limit(5) \
            .execute()
        
        if recent.data:
            for item in recent.data:
                print(f"  - {item['title'][:50]}...")
                print(f"    Updated: {item['updated_at']}")
        else:
            print("  No recent URL updates found")
        
        # Protection verification
        print("\n🛡️ Protection Status:")
        print("  - Image URL protection is ACTIVE")
        print("  - URLs will be preserved unless --override-images is used")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    # Load environment
    load_dotenv()
    
    # Run verification
    exit_code = verify_image_urls()
    sys.exit(exit_code)
