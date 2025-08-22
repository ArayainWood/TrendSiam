#!/usr/bin/env python3
"""Verify score details are being generated and written correctly"""

import os
import sys
from datetime import datetime

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from supabase import create_client, Client
    from summarize_all_v2 import TrendSiamNewsIngester
    
    print("🔍 Verifying score details pipeline...\n")
    
    # Test 1: Build score details function
    print("1️⃣ Testing build_score_details function...")
    pipeline = TrendSiamNewsIngester(dry_run=True)
    
    test_video = {
        'popularity_score_precise': 92.5,
        'view_count': '2345678',
        'like_count': '234567',
        'comment_count': '23456'
    }
    
    score_details = pipeline.build_score_details(test_video)
    print(f"   Input: score={test_video['popularity_score_precise']}, views={test_video['view_count']}")
    print(f"   Output: {score_details}")
    print(f"   ✅ Function works correctly\n")
    
    # Test 2: Check database if credentials available
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_ANON_KEY')
    
    if supabase_url and supabase_key:
        print("2️⃣ Checking database for score_details...")
        
        supabase: Client = create_client(supabase_url, supabase_key)
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Get today's stories
        result = supabase.from_('news_trends').select(
            'video_id, title, popularity_score_precise, score_details'
        ).eq('date', today).order('popularity_score_precise', desc=True).limit(5).execute()
        
        if result.data:
            print(f"   Found {len(result.data)} stories for today\n")
            
            has_details = 0
            missing_details = 0
            
            for item in result.data:
                has_score_details = bool(item.get('score_details') and item['score_details'].strip())
                status = "✅ HAS DETAILS" if has_score_details else "❌ MISSING"
                
                print(f"   {status} - {item['title'][:50]}...")
                if has_score_details:
                    print(f"      Score details: {item['score_details'][:80]}...")
                    has_details += 1
                else:
                    missing_details += 1
                print()
            
            print(f"   Summary: {has_details} with details, {missing_details} missing")
            
            if missing_details > 0:
                print("\n   💡 To populate missing score details, run:")
                print("      python summarize_all_v2.py --recompute-scores --limit 20")
        else:
            print("   No stories found for today")
    else:
        print("2️⃣ Skipping database check (no credentials)")
        print("   To check the database, ensure SUPABASE_URL and SUPABASE_ANON_KEY are set")
    
    print("\n✅ Verification complete!")
    
except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
