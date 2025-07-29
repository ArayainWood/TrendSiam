#!/usr/bin/env python3
"""
Force Regenerate AI Images for TrendSiam

This script force regenerates AI images for the top 3 trending news items,
completely replacing any existing images.

Usage:
    python force_regenerate_images.py [api_key]
    
    If no API key is provided, will try to get from OPENAI_API_KEY environment variable.
"""

import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file early
load_dotenv()

def force_regenerate_images(api_key=None):
    """Force regenerate all AI images for top 3 news."""
    
    print("🎨 TrendSiam Force Image Regeneration")
    print("=" * 50)
    
    # Get API key
    if not api_key:
        api_key = os.getenv('OPENAI_API_KEY')
    
    if not api_key:
        print("❌ OPENAI_API_KEY not found. Please set it in your .env file.")
        print("💡 Usage options:")
        print("   1. Create .env file with: OPENAI_API_KEY=your-key-here")
        print("   2. Set environment variable: export OPENAI_API_KEY=your-key")
        print("   3. Pass directly: python force_regenerate_images.py your-api-key")
        return False
    
    # Debug-safe confirmation (never expose the actual key)
    print("✅ API key loaded successfully")
    print(f"🔑 API key format: {api_key[:3]}...{api_key[-4:]} ({len(api_key)} chars)")
    
    # Check for news data
    if not Path('thailand_trending_summary.json').exists():
        print("❌ Error: thailand_trending_summary.json not found")
        print("💡 Run summarize_all.py first to generate news data")
        return False
    
    try:
        # Import and run the enhanced image generator
        from ai_image_generator import generate_ai_images_for_top3_news
        
        print("🚀 Starting force regeneration process...")
        print("⚠️ This will COMPLETELY REPLACE all existing images!")
        print()
        
        # Execute force regeneration
        result = generate_ai_images_for_top3_news(api_key)
        
        # Report results
        if result.get('success'):
            successful = result.get('successful', 0)
            processed = result.get('processed', 0)
            
            print(f"✅ SUCCESS: Generated {successful}/{processed} NEW images")
            print(f"📁 Images saved to: ai_generated_images/")
            print(f"💰 Estimated cost: ~${successful * 0.04:.2f}")
            print()
            print("🎉 Force regeneration completed successfully!")
            print("🔄 New images will appear in the Streamlit app immediately")
            
            if result.get('errors'):
                print(f"\n⚠️ Encountered {len(result['errors'])} errors:")
                for error in result['errors']:
                    print(f"  • {error}")
            
            return True
            
        else:
            print(f"❌ FAILED: {result.get('message', 'Unknown error')}")
            
            if result.get('errors'):
                print(f"\n📋 Error details:")
                for error in result['errors']:
                    print(f"  • {error}")
            
            print(f"\n🔧 Troubleshooting:")
            print(f"  • Check your OpenAI API key is valid")
            print(f"  • Ensure you have sufficient credits")
            print(f"  • Wait 1-2 minutes if you hit rate limits")
            print(f"  • Check internet connection")
            
            return False
            
    except ImportError as e:
        print(f"❌ Import Error: {e}")
        print("💡 Ensure ai_image_generator.py is available")
        return False
        
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        return False

def main():
    """Main function."""
    
    # Get API key from command line argument
    api_key = sys.argv[1] if len(sys.argv) > 1 else None
    
    # Run force regeneration
    success = force_regenerate_images(api_key)
    
    if success:
        print("\n✨ Next steps:")
        print("  • Open the TrendSiam Streamlit app")
        print("  • Enable '🖼️ Show AI Images & Prompts' in filters")
        print("  • View your NEW force-generated images!")
    else:
        print("\n😞 Force regeneration failed")
        print("   Check the error messages above for guidance")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 