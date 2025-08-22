#!/usr/bin/env python3
"""
Validate E2E fixes are working correctly
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

print("🔍 E2E FIX VALIDATION")
print("=" * 80)
print(f"Timestamp: {datetime.now().isoformat()}")
print()

# 1. Check Top-3 AI images
print("1️⃣ Checking Top-3 items have AI images:")
print("-" * 80)

result = client.table('news_trends').select(
    'id,title,ai_image_url,popularity_score_precise'
).order('popularity_score_precise', desc=True).limit(3).execute()

all_have_images = True
for i, item in enumerate(result.data, 1):
    has_image = bool(item['ai_image_url'])
    status = '✅' if has_image else '❌'
    print(f"{i}. {item['title'][:50]}...")
    print(f"   Score: {item['popularity_score_precise']}")
    print(f"   AI Image: {status}")
    if item['ai_image_url']:
        print(f"   URL: {item['ai_image_url'][:80]}...")
    print()
    
    if not has_image:
        all_have_images = False

if all_have_images:
    print("✅ SUCCESS: All Top-3 items have AI images")
else:
    print("❌ FAIL: Some Top-3 items missing AI images")

# 2. Check weekly_public_view
print("\n2️⃣ Checking weekly_public_view returns same Top-3:")
print("-" * 80)

try:
    view_result = client.from_('weekly_public_view').select(
        'id,title,ai_image_url,popularity_score_precise'
    ).limit(3).execute()
    
    # Compare IDs
    direct_ids = [item['id'] for item in result.data]
    view_ids = [item['id'] for item in view_result.data]
    
    if direct_ids == view_ids:
        print("✅ SUCCESS: View returns same Top-3 as direct query")
    else:
        print("❌ FAIL: View returns different items")
        print(f"   Direct: {direct_ids}")
        print(f"   View: {view_ids}")
        
except Exception as e:
    print(f"❌ Error querying view: {e}")

# 3. Check ordering consistency
print("\n3️⃣ Checking ordering is consistent:")
print("-" * 80)

# Get top 10 to check ordering
top10 = client.table('news_trends').select(
    'title,popularity_score_precise'
).order('popularity_score_precise', desc=True).limit(10).execute()

scores = [item['popularity_score_precise'] for item in top10.data]
is_descending = all(scores[i] >= scores[i+1] for i in range(len(scores)-1))

if is_descending:
    print("✅ SUCCESS: Items are properly ordered by popularity_score_precise DESC")
    print(f"   Score range: {scores[0]} → {scores[-1]}")
else:
    print("❌ FAIL: Ordering is incorrect")
    print(f"   Scores: {scores}")

# 4. Summary
print("\n4️⃣ VALIDATION SUMMARY:")
print("=" * 80)

# Check all test results
if all_have_images and direct_ids == view_ids and is_descending:
    print("✅ ALL TESTS PASSED - E2E fixes are working correctly!")
    print()
    print("Next steps:")
    print("1. Run frontend: cd frontend && npm run dev")
    print("2. Check homepage shows AI images for Top-3")
    print("3. Verify ordering matches database")
else:
    print("❌ SOME TESTS FAILED - Please apply all fixes:")
    print()
    print("1. Run: python fix_ai_images_for_existing.py")
    print("2. Apply SQL: fix_ordering_query.sql in Supabase")
    print("3. Re-run this validation")

print("\n" + "=" * 80)
