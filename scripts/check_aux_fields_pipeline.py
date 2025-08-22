#!/usr/bin/env python3
"""
Check auxiliary fields in the pipeline
Verify which fields are being computed and written
"""

import os
import sys
from datetime import datetime, timezone

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def check_pipeline_fields():
    """Check what fields the pipeline writes to news_trends"""
    print("🔍 Checking Pipeline Auxiliary Fields...\n")
    
    # Fields we're looking for
    auxiliary_fields = [
        'ai_opinion',
        'score_details', 
        'keywords',
        'growth_rate',
        'platform_mentions',
        'duration'
    ]
    
    # Check summarize_all_v2.py
    pipeline_file = 'summarize_all_v2.py'
    if os.path.exists(pipeline_file):
        with open(pipeline_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        print(f"📄 Checking {pipeline_file}...\n")
        
        # Check database write section (around line 810-840)
        db_write_section = content[content.find("supabase_items = []"):content.find("if item['title'] and item['video_id']:")]
        
        print("Database fields being written:")
        for field in auxiliary_fields:
            if f"'{field}'" in db_write_section:
                print(f"✅ {field} - Found in database write")
            else:
                print(f"❌ {field} - NOT found in database write")
        
        # Check if fields are being computed anywhere
        print("\nField computation check:")
        for field in auxiliary_fields:
            if field in content:
                # Find context
                index = content.find(field)
                if index > 0:
                    context = content[max(0, index-100):index+100]
                    print(f"⚠️  {field} - Referenced (check context)")
            else:
                print(f"❌ {field} - Not computed in pipeline")
    
    print("\n💡 Findings:")
    print("- Most auxiliary fields are NOT being written to news_trends")
    print("- These fields need to be computed and added to the pipeline")
    print("- The UI expects these fields in view_details structure")

if __name__ == "__main__":
    check_pipeline_fields()
