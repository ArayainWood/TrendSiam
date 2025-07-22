#!/usr/bin/env python3
"""
Quick Clean Script - Remove fake entries from trending data
This is a simplified version that runs automatically without prompts.
"""

import json
import re

def is_fake_entry(entry):
    """Check if an entry appears to be fake based on simple criteria"""
    video_id = entry.get('video_id', '')
    channel = entry.get('channel', '')
    title = entry.get('title', '')
    
    # Check for obvious fake video IDs
    fake_video_patterns = [
        'abc123def',  # Obvious fake pattern
        'xyz789',     # Another obvious fake
        'test123',    # Test pattern
        'xxxxxx',     # Placeholder x's
    ]
    
    if video_id.lower() in [p.lower() for p in fake_video_patterns]:
        return True, f"Fake video_id: {video_id}"
    
    # Check for test channels
    if channel.lower() in ['test channel', 'fake channel', 'dummy channel']:
        return True, f"Test channel: {channel}"
    
    # Check for obviously fake titles
    fake_title_keywords = ['fake headline', 'test title', 'placeholder']
    if any(keyword in title.lower() for keyword in fake_title_keywords):
        return True, f"Fake title: {title}"
    
    return False, ""

def clean_data():
    """Clean the data file"""
    input_file = "thailand_trending_summary.json"
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"❌ File {input_file} not found!")
        return
    
    print(f"📊 Original entries: {len(data)}")
    
    cleaned_data = []
    removed_count = 0
    
    for entry in data:
        is_fake, reason = is_fake_entry(entry)
        if is_fake:
            print(f"🗑️  Removing: {entry.get('title', 'No title')[:50]}...")
            print(f"   Reason: {reason}")
            removed_count += 1
        else:
            # Re-rank the kept entries
            entry['rank'] = str(len(cleaned_data) + 1)
            cleaned_data.append(entry)
    
    if removed_count == 0:
        print("✅ No fake entries found! Data is already clean.")
        return
    
    # Save cleaned data
    with open(input_file, 'w', encoding='utf-8') as f:
        json.dump(cleaned_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n📈 Results:")
    print(f"   Removed: {removed_count} fake entries")
    print(f"   Kept: {len(cleaned_data)} real entries")
    print(f"✅ Cleaned data saved to {input_file}")

if __name__ == "__main__":
    print("🧹 Quick Clean - Thailand Trending Data")
    print("=" * 40)
    clean_data() 