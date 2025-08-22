#!/usr/bin/env python3
"""
[DEPRECATED] Use validate_e2e_fixes.py instead
Validate that the pipeline → DB → API → Frontend flow is working correctly
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client
from datetime import datetime

# Load environment
load_dotenv()

# Create Supabase client
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not url or not key:
    print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

client = create_client(url, key)

print("🔍 VALIDATION REPORT")
print("=" * 80)
print(f"Timestamp: {datetime.now().isoformat()}")
print()

# 1. Check top 3 items in news_trends
print("1️⃣ Top 3 items in news_trends table (direct query):")
print("-" * 80)

result = client.table('news_trends').select(
    'id,title,ai_image_url,popularity_score_precise,updated_at,published_date'
).order('popularity_score_precise', desc=True).limit(3).execute()

direct_top3 = []
for i, item in enumerate(result.data, 1):
    direct_top3.append(item['id'])
    print(f"{i}. {item['title'][:50]}...")
    print(f"   Score: {item['popularity_score_precise']}")
    print(f"   AI Image: {'✅ YES' if item['ai_image_url'] else '❌ NO'}")
    if item['ai_image_url']:
        print(f"   URL: {item['ai_image_url']}")
    print(f"   Updated: {item['updated_at']}")
    print(f"   Published: {item['published_date']}")
    print()

# 2. Check weekly_public_view
print("\n2️⃣ Top 3 items in weekly_public_view:")
print("-" * 80)

try:
    view_result = client.from_('weekly_public_view').select(
        'id,title,ai_image_url,popularity_score_precise,display_image_url'
    ).limit(3).execute()
    
    view_top3 = []
    for i, item in enumerate(view_result.data, 1):
        view_top3.append(item['id'])
        print(f"{i}. {item['title'][:50]}...")
        print(f"   Score: {item.get('popularity_score_precise', 'N/A')}")
        print(f"   AI Image: {'✅ YES' if item['ai_image_url'] else '❌ NO'}")
        print(f"   Display Image: {'✅ YES' if item['display_image_url'] else '❌ NO'}")
        print()
        
    # Check if top 3 match
    if direct_top3 == view_top3:
        print("✅ Top 3 items MATCH between direct query and view")
    else:
        print("❌ Top 3 items DO NOT MATCH between direct query and view")
        print(f"   Direct: {direct_top3}")
        print(f"   View: {view_top3}")
        
except Exception as e:
    print(f"❌ Error querying weekly_public_view: {e}")

# 3. Check AI images statistics
print("\n3️⃣ AI Image Statistics:")
print("-" * 80)

# Count items with AI images
ai_count = client.table('news_trends').select('id', count='exact', head=True).neq('ai_image_url', None).execute()
total_count = client.table('news_trends').select('id', count='exact', head=True).execute()

print(f"Total items: {total_count.count}")
print(f"Items with AI images: {ai_count.count}")
print(f"Coverage: {(ai_count.count/total_count.count*100):.1f}%")

# Check recent AI images
print("\n4️⃣ Most recent AI images generated:")
print("-" * 80)

recent_ai = client.table('news_trends').select(
    'title,ai_image_url,updated_at'
).neq('ai_image_url', None).order('updated_at', desc=True).limit(3).execute()

for item in recent_ai.data:
    print(f"• {item['title'][:50]}...")
    print(f"  {item['ai_image_url']}")
    print(f"  Updated: {item['updated_at']}")
    print()

# 5. Validation summary
print("\n5️⃣ VALIDATION SUMMARY:")
print("-" * 80)

# Check if top 3 have AI images
top3_have_images = all(item.get('ai_image_url') for item in result.data)

if top3_have_images:
    print("✅ All Top-3 items have AI images")
else:
    print("❌ Some Top-3 items are missing AI images")
    
# Check data freshness
if result.data:
    latest_update = result.data[0]['updated_at']
    print(f"✅ Latest update: {latest_update}")
else:
    print("❌ No data found")

print("\n" + "=" * 80)
print("VALIDATION COMPLETE")
