#!/usr/bin/env python3
"""
SECTION G - Pipeline Health Check Script

Reads system_meta('news_last_updated'), prints age in minutes, and top 1 story.
Exit non-zero if age > 180 minutes in production.
"""

import os
import sys
from datetime import datetime, timezone
from typing import Optional

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

try:
    from supabase import create_client
except ImportError:
    print("ERROR: supabase-py not installed. Run: pip install supabase")
    sys.exit(1)


def get_supabase_client():
    """Create Supabase client."""
    supabase_url = os.environ.get('SUPABASE_URL')
    service_role_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url or not service_role_key:
        print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    
    return create_client(supabase_url, service_role_key)


def get_last_updated() -> Optional[str]:
    """Get news_last_updated from system_meta."""
    try:
        supabase = get_supabase_client()
        result = supabase.table('system_meta').select('value').eq('key', 'news_last_updated').single().execute()
        
        if result.data:
            return result.data['value']
        return None
    except Exception as e:
        print(f"ERROR: Failed to get last_updated: {e}")
        return None


def get_top_story() -> Optional[dict]:
    """Get top story by popularity."""
    try:
        supabase = get_supabase_client()
        result = supabase.table('news_trends').select('title, updated_at, popularity_score').order('popularity_score', desc=True).limit(1).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]
        return None
    except Exception as e:
        print(f"ERROR: Failed to get top story: {e}")
        return None


def calculate_age_minutes(timestamp_str: str) -> int:
    """Calculate age in minutes from ISO timestamp."""
    try:
        if timestamp_str.endswith('Z'):
            timestamp_str = timestamp_str[:-1] + '+00:00'
        
        last_updated = datetime.fromisoformat(timestamp_str)
        now = datetime.now(timezone.utc)
        
        delta = now - last_updated
        return int(delta.total_seconds() / 60)
    except Exception as e:
        print(f"ERROR: Failed to parse timestamp {timestamp_str}: {e}")
        return 9999  # Very old


def main():
    """Main health check function."""
    print("TrendSiam Pipeline Health Check")
    print("=" * 40)
    
    # Get last updated timestamp
    last_updated = get_last_updated()
    if not last_updated:
        print("CRITICAL: news_last_updated not found in system_meta")
        sys.exit(1)
    
    # Calculate age
    age_minutes = calculate_age_minutes(last_updated)
    
    # Get top story
    top_story = get_top_story()
    
    # Print status
    print(f"Last Updated: {last_updated}")
    print(f"Age: {age_minutes} minutes")
    
    if top_story:
        print(f"Top Story: {top_story['title'][:60]}...")
        print(f"Story Updated: {top_story['updated_at']}")
        print(f"Score: {top_story['popularity_score']}")
    else:
        print("WARNING: No stories found")
    
    # Determine status
    is_production = os.environ.get('NODE_ENV') == 'production'
    max_age_minutes = 180  # 3 hours
    
    if age_minutes > max_age_minutes:
        if is_production:
            print(f"CRITICAL: Data is {age_minutes} minutes old (max: {max_age_minutes})")
            sys.exit(1)
        else:
            print(f"WARNING: Data is {age_minutes} minutes old (dev mode)")
    else:
        print(f"OK: Data is fresh ({age_minutes} minutes old)")
    
    print("\nHealth check passed ✅")
    sys.exit(0)


if __name__ == '__main__':
    main()
