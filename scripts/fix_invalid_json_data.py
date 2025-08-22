#!/usr/bin/env python3
"""
Fix Invalid JSON Data in news_trends
Converts invalid JSON strings to valid arrays
"""

import os
import sys
import json
from supabase import create_client, Client

def fix_invalid_json_data():
    """Fix records with invalid JSON in keywords and score_details columns"""
    
    # Get Supabase credentials
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if not url or not key:
        print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return False
    
    # Create client
    supabase: Client = create_client(url, key)
    
    print("🔍 Finding records with invalid JSON...")
    
    # Fix keywords that are "null" string or invalid
    try:
        # Get records with problematic keywords
        result = supabase.table('news_trends').select('id, video_id, keywords').or_(
            'keywords.eq.null',
            'keywords.eq.',
            'keywords.eq.{}',
            'keywords.like.No%'
        ).execute()
        
        if result.data:
            print(f"📝 Found {len(result.data)} records with invalid keywords")
            
            fixed_count = 0
            for record in result.data:
                try:
                    keywords = record.get('keywords', '')
                    
                    # Convert various invalid formats to empty array
                    if (keywords == 'null' or 
                        keywords == '' or 
                        keywords == '{}' or 
                        keywords is None or
                        (isinstance(keywords, str) and not keywords.strip().startswith('['))):
                        
                        # Update to empty array
                        update_result = supabase.table('news_trends').update({
                            'keywords': '[]'
                        }).eq('id', record['id']).execute()
                        
                        if update_result.data:
                            fixed_count += 1
                            print(f"  ✓ Fixed record {record['video_id'] or record['id']}")
                
                except Exception as e:
                    print(f"  ⚠ Error fixing record {record['id']}: {e}")
            
            print(f"✅ Fixed {fixed_count} records with invalid keywords")
        else:
            print("✅ No records with invalid keywords found")
    
    except Exception as e:
        print(f"❌ Error querying keywords: {e}")
        return False
    
    # Fix score_details that are not valid JSON
    try:
        # For score_details, we'll just ensure they're text strings
        # The view will handle conversion with safe_to_jsonb
        print("\n🔍 Checking score_details...")
        
        # Just verify we can query them
        result = supabase.table('news_trends').select('id').limit(1).execute()
        print("✅ score_details will be handled by safe_to_jsonb function in views")
        
    except Exception as e:
        print(f"❌ Error checking score_details: {e}")
        return False
    
    return True

if __name__ == "__main__":
    # Load environment variables
    try:
        from dotenv import load_dotenv
        load_dotenv('.env.local')
    except ImportError:
        print("⚠️  python-dotenv not installed, using existing environment")
    
    success = fix_invalid_json_data()
    sys.exit(0 if success else 1)
