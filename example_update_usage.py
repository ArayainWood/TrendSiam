#!/usr/bin/env python3
"""
Example Usage: TrendSiam Video Data Updater
==========================================

This script demonstrates how to safely use the TrendSiam video data updater
to refresh view counts and categories from YouTube API.

Prerequisites:
1. YOUTUBE_API_KEY in .env file
2. thailand_trending_summary.json exists
3. TrendSiam dependencies installed

Safety Features Demonstrated:
- Dry run testing before actual updates
- Automatic backup creation
- Validation and error handling
- Rate limiting compliance
"""

from update_video_data import TrendSiamVideoUpdater
import logging

# Configure logging to see what's happening
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def safe_update_workflow():
    """
    Demonstrates a safe workflow for updating video data.
    """
    print("🚀 TrendSiam Video Data Update - Safe Workflow")
    print("=" * 50)
    
    try:
        # Step 1: Initialize the updater
        print("\n📋 Step 1: Initialize updater...")
        updater = TrendSiamVideoUpdater()
        print("✅ Updater initialized successfully")
        
        # Step 2: Create manual backup (optional but recommended)
        print("\n📋 Step 2: Create backup...")
        backup_path = updater.create_backup("_manual_before_update")
        print(f"✅ Backup created: {backup_path}")
        
        # Step 3: Run dry run to see what would be updated
        print("\n📋 Step 3: Running dry run (no changes saved)...")
        dry_results = updater.update_all_videos(dry_run=True)
        
        if dry_results['success']:
            print(f"✅ Dry run completed:")
            print(f"   • Total items: {dry_results['total_items']}")
            print(f"   • Valid video IDs: {dry_results['valid_video_ids']}")
            print(f"   • Statistics fetched: {dry_results['stats_fetched']}")
            print(f"   • Items that would be updated: {dry_results['items_updated']}")
            
            if dry_results['items_updated'] > 0:
                print(f"\n🔄 Sample changes that would be made:")
                for change in dry_results['changes'][:3]:  # Show first 3
                    print(f"   📹 {change['title']}")
                    for detail in change['changes'][:2]:  # Show first 2 changes
                        print(f"      • {detail}")
                
                # Step 4: Confirm and run actual update
                print(f"\n📋 Step 4: Ready to apply {dry_results['items_updated']} updates")
                user_input = input("Continue with actual update? (y/N): ").strip().lower()
                
                if user_input == 'y':
                    print("🔄 Running actual update...")
                    real_results = updater.update_all_videos(dry_run=False)
                    
                    if real_results['success']:
                        print(f"✅ Update completed successfully!")
                        print(f"   • Items updated: {real_results['items_updated']}")
                        print(f"   • Backup available: {backup_path}")
                    else:
                        print(f"❌ Update failed: {real_results.get('error', 'Unknown error')}")
                        print(f"🔄 You can restore from backup: {backup_path}")
                else:
                    print("⚠️ Update cancelled by user")
            else:
                print("ℹ️ No updates needed - all data is current")
        else:
            print(f"❌ Dry run failed: {dry_results.get('error', 'Unknown error')}")
            
    except Exception as e:
        logger.error(f"❌ Error in update workflow: {e}")
        print(f"❌ Error: {e}")

def demonstrate_features():
    """
    Demonstrate key features of the updater.
    """
    print("\n🎯 TrendSiam Video Updater - Key Features")
    print("=" * 45)
    
    features = [
        "🔒 Security & Validation",
        "  • YouTube video ID format validation",
        "  • Data integrity checks before saving",
        "  • API key validation and secure storage",
        "  • Rate limiting to respect YouTube API limits",
        "",
        "📊 Data Updates",
        "  • Fetches latest view counts, likes, comments",
        "  • Re-classifies categories using TrendSiam logic",
        "  • Updates only when values actually change",
        "  • Validates view counts are reasonable (1 to 10B)",
        "",
        "🛡️ Safety Features",
        "  • Automatic backup creation before updates",
        "  • Dry run mode to preview changes",
        "  • Atomic file operations (temp file + move)",
        "  • Rollback capability with backup restore",
        "",
        "⚙️ Usage Options",
        "  • --dry-run: Preview changes without saving",
        "  • --backup-only: Create backup without updating",
        "  • --restore: Restore from specific backup",
        "  • --data-file: Specify custom data file path",
        "",
        "📈 API Compliance",
        "  • Respects YouTube API Terms of Service",
        "  • Implements proper rate limiting",
        "  • Handles API errors gracefully",
        "  • Batch requests for efficiency (up to 50 IDs per request)"
    ]
    
    for feature in features:
        print(feature)

if __name__ == "__main__":
    print("📚 TrendSiam Video Data Updater - Examples")
    print("=" * 45)
    
    print("\n1️⃣ Display key features:")
    demonstrate_features()
    
    print("\n\n2️⃣ Run safe update workflow:")
    try:
        safe_update_workflow()
    except KeyboardInterrupt:
        print("\n⚠️ Workflow cancelled by user")
    
    print("\n\n3️⃣ Command-line usage examples:")
    print("   # Preview changes without saving:")
    print("   python update_video_data.py --dry-run")
    print()
    print("   # Create backup only:")
    print("   python update_video_data.py --backup-only")
    print()
    print("   # Run actual update:")
    print("   python update_video_data.py")
    print()
    print("   # Restore from backup:")
    print("   python update_video_data.py --restore backups/thailand_trending_summary_backup_20250123_143000.json")
    
    print("\n✅ Example completed. Ready to use TrendSiam Video Data Updater!") 