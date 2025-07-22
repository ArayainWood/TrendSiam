#!/usr/bin/env python3
"""
Clean Thailand Trending Summary JSON File
Removes fake, placeholder, and test entries from the trending news data.
"""

import json
import re
from typing import List, Dict, Any, Optional

def is_fake_video_id(video_id: str) -> bool:
    """
    Check if a video_id appears to be fake or placeholder.
    Real YouTube video IDs are typically 11 characters of alphanumeric and specific symbols.
    """
    if not video_id or len(video_id) != 11:
        return True
    
    # Common fake patterns
    fake_patterns = [
        r'^[a-z]{3}\d{3}[a-z]{3}$',  # abc123def pattern
        r'^[xyz]{3}\d{3}$',          # xyz789 pattern
        r'^test\d+',                 # test123 pattern
        r'^fake\d+',                 # fake123 pattern
        r'^dummy\d+',                # dummy123 pattern
        r'^sample\d+',               # sample123 pattern
        r'^[x]{6,}',                 # xxxxxx pattern
        r'^[0-9]{11}$',              # All numbers
        r'^[a-z]{11}$',              # All lowercase letters
    ]
    
    video_id_lower = video_id.lower()
    for pattern in fake_patterns:
        if re.match(pattern, video_id_lower):
            return True
    
    return False

def is_fake_channel(channel: str) -> bool:
    """
    Check if a channel name appears to be fake or placeholder.
    """
    if not channel:
        return True
    
    fake_channels = [
        "test channel",
        "test user",
        "fake channel",
        "dummy channel",
        "sample channel",
        "placeholder channel",
        "example channel",
        "demo channel"
    ]
    
    channel_lower = channel.lower().strip()
    
    # Check exact matches
    if channel_lower in fake_channels:
        return True
    
    # Check for test patterns
    test_patterns = [
        r'^test\s*\d*$',
        r'^fake\s*\d*$',
        r'^dummy\s*\d*$',
        r'^sample\s*\d*$',
        r'^example\s*\d*$',
        r'^demo\s*\d*$',
        r'^placeholder\s*\d*$'
    ]
    
    for pattern in test_patterns:
        if re.match(pattern, channel_lower):
            return True
    
    return False

def is_fake_title(title: str) -> bool:
    """
    Check if a title appears to be fake or placeholder.
    """
    if not title:
        return True
    
    title_lower = title.lower().strip()
    
    # Obvious fake titles
    fake_titles = [
        "fake headline",
        "test title",
        "sample title",
        "dummy title",
        "placeholder title",
        "example title",
        "demo title"
    ]
    
    if title_lower in fake_titles:
        return True
    
    # Check for placeholder patterns
    placeholder_patterns = [
        r'^test\s+.*',
        r'^fake\s+.*',
        r'^dummy\s+.*',
        r'^sample\s+.*',
        r'^placeholder\s+.*',
        r'^example\s+.*',
        r'^demo\s+.*',
        r'.*\btest\b.*\bvideo\b.*',
        r'.*\bfake\b.*\bnews\b.*'
    ]
    
    for pattern in placeholder_patterns:
        if re.match(pattern, title_lower):
            return True
    
    return False

def has_suspicious_view_count(view_count: str) -> bool:
    """
    Check for obviously fake view counts.
    """
    if not view_count:
        return True
    
    # Remove commas and check if it's a reasonable number
    clean_count = view_count.replace(',', '').replace(' ', '')
    
    # Check for non-numeric or suspicious patterns
    if not clean_count.isdigit():
        return False  # Let other validators handle this
    
    count = int(clean_count)
    
    # Suspiciously round numbers that are likely fake
    suspicious_counts = [
        123, 1234, 12345, 123456,
        999, 9999, 99999, 999999,
        1000, 10000, 100000, 1000000,
        # Very specific test numbers
        1111, 2222, 3333, 4444, 5555,
        1337, 42, 69, 420, 666, 777
    ]
    
    return count in suspicious_counts

def is_fake_entry(entry: Dict[str, Any]) -> bool:
    """
    Determine if an entire entry appears to be fake based on multiple criteria.
    """
    reasons = []
    
    # Check video ID
    if is_fake_video_id(entry.get('video_id', '')):
        reasons.append(f"Fake video_id: {entry.get('video_id')}")
    
    # Check channel
    if is_fake_channel(entry.get('channel', '')):
        reasons.append(f"Fake channel: {entry.get('channel')}")
    
    # Check title
    if is_fake_title(entry.get('title', '')):
        reasons.append(f"Fake title: {entry.get('title')}")
    
    # Check view count
    if has_suspicious_view_count(entry.get('view_count', '')):
        reasons.append(f"Suspicious view_count: {entry.get('view_count')}")
    
    # Return True if any fake indicators found
    if reasons:
        print(f"🗑️  Removing fake entry: {entry.get('title', 'No title')}")
        for reason in reasons:
            print(f"   - {reason}")
        return True
    
    return False

def clean_trending_data(input_file: str, output_file: Optional[str] = None) -> None:
    """
    Clean the trending data JSON file by removing fake entries.
    """
    if output_file is None:
        output_file = input_file
    
    print(f"🔍 Reading data from: {input_file}")
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"❌ Error: File {input_file} not found!")
        return
    except json.JSONDecodeError as e:
        print(f"❌ Error: Invalid JSON in {input_file}: {e}")
        return
    
    if not isinstance(data, list):
        print("❌ Error: Expected JSON file to contain a list of entries")
        return
    
    original_count = len(data)
    print(f"📊 Original entries: {original_count}")
    
    # Filter out fake entries
    print("\n🧹 Scanning for fake entries...")
    cleaned_data = []
    removed_count = 0
    
    for i, entry in enumerate(data, 1):
        if is_fake_entry(entry):
            removed_count += 1
        else:
            # Keep the entry and update rank
            entry['rank'] = str(len(cleaned_data) + 1)
            cleaned_data.append(entry)
            print(f"✅ Keeping: #{entry['rank']} {entry.get('title', 'No title')[:60]}...")
    
    print(f"\n📈 Results:")
    print(f"   Original entries: {original_count}")
    print(f"   Removed entries:  {removed_count}")
    print(f"   Clean entries:    {len(cleaned_data)}")
    print(f"   Removal rate:     {removed_count/original_count*100:.1f}%")
    
    if removed_count == 0:
        print("🎉 No fake entries found! Your data is already clean.")
        return
    
    # Save cleaned data
    print(f"\n💾 Saving cleaned data to: {output_file}")
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(cleaned_data, f, ensure_ascii=False, indent=2)
        print(f"✅ Successfully saved {len(cleaned_data)} clean entries!")
    except Exception as e:
        print(f"❌ Error saving file: {e}")

def main():
    """
    Main function to clean the trending data.
    """
    input_file = "thailand_trending_summary.json"
    
    print("🧹 Thailand Trending Data Cleaner")
    print("=" * 50)
    
    # Option to save to different file for safety
    choice = input("Save to new file? (y/n, default=n): ").lower().strip()
    
    if choice == 'y' or choice == 'yes':
        output_file = "cleaned_trending_summary.json"
        print(f"📝 Will save cleaned data to: {output_file}")
    else:
        output_file = input_file
        print(f"⚠️  Will overwrite original file: {input_file}")
        
        confirm = input("Continue? (y/n): ").lower().strip()
        if confirm != 'y' and confirm != 'yes':
            print("❌ Operation cancelled.")
            return
    
    clean_trending_data(input_file, output_file)
    
    print("\n✨ Cleaning complete!")

if __name__ == "__main__":
    main() 