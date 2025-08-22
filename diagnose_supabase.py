#!/usr/bin/env python3
"""
Diagnostic script to test Supabase connection and identify issues
"""

from dotenv import load_dotenv
from pathlib import Path
import os
import json
from datetime import datetime, timezone, timedelta

# Try to load from multiple possible .env locations
root_env = Path(__file__).resolve().parent / '.env'
frontend_env = Path(__file__).resolve().parent / 'frontend' / '.env.local'

# Load .env files in order of preference
if frontend_env.exists():
    load_dotenv(dotenv_path=frontend_env)
    print(f"✅ Loaded environment from: {frontend_env}")
elif root_env.exists():
    load_dotenv(dotenv_path=root_env)
    print(f"✅ Loaded environment from: {root_env}")
else:
    print("⚠️ No .env file found, using system environment variables")

print("=" * 80)
print("🔍 SUPABASE DIAGNOSTIC TOOL")
print("=" * 80)

# Check environment variables
print("\n📋 STEP 1: Checking environment variables...")
supabase_url = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_KEY') or os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

print(f"SUPABASE_URL: {'✅ Found' if supabase_url else '❌ Not found'}")
print(f"SUPABASE_KEY: {'✅ Found' if supabase_key else '❌ Not found'}")

if supabase_url:
    print(f"URL: {supabase_url[:40]}...")
if supabase_key:
    print(f"KEY: {supabase_key[:20]}...{supabase_key[-10:]}")

if not supabase_url or not supabase_key:
    print("\n❌ Missing Supabase credentials. Please check your .env file.")
    exit(1)

# Try to import and initialize Supabase
print("\n📋 STEP 2: Initializing Supabase client...")
try:
    from supabase import create_client, Client
    print("✅ Supabase module imported successfully")
except ImportError as e:
    print(f"❌ Failed to import Supabase: {e}")
    print("💡 Run: pip install supabase")
    exit(1)

try:
    supabase = create_client(supabase_url, supabase_key)
    print("✅ Supabase client created")
except Exception as e:
    print(f"❌ Failed to create Supabase client: {e}")
    exit(1)

# Test basic connection
print("\n📋 STEP 3: Testing basic connection...")
try:
    result = supabase.table('news_trends').select('count', count='exact', head=True).execute()
    print(f"✅ Connected to Supabase successfully")
    print(f"📊 Total rows in news_trends: {result.count}")
except Exception as e:
    print(f"❌ Connection test failed: {e}")
    print("💡 Check if the table 'news_trends' exists and RLS is properly configured")

# Test insert with minimal data
print("\n📋 STEP 4: Testing simple insert...")
thailand_tz = timezone(timedelta(hours=7))
test_item = {
    'title': f'Test Insert {datetime.now().isoformat()}',
    'summary': 'This is a test insert from diagnostic script',
    'video_id': f'test_{int(datetime.now().timestamp())}',
    'popularity_score': 50.0,
    'popularity_score_precise': 50.5,
    'category': 'Test',
    'platform': 'Test Platform',
    'channel': 'Test Channel',
    'date': datetime.now(thailand_tz).date().isoformat()  # Use 'date' not 'summary_date'
}

print(f"Test item: {json.dumps(test_item, indent=2)}")

try:
    # Test insert (without select for now)
    result = supabase.table('news_trends').insert([test_item]).execute()
    
    # Check if data was returned
    if hasattr(result, 'data') and result.data:
        print(f"✅ Insert successful! Inserted {len(result.data)} item(s)")
        print(f"📋 Returned data: {json.dumps(result.data[0] if result.data else {}, indent=2)}")
        
        # Clean up test data
        print("\n📋 STEP 5: Cleaning up test data...")
        delete_result = supabase.table('news_trends').delete().eq('video_id', test_item['video_id']).execute()
        print("✅ Test data cleaned up")
    else:
        print("⚠️ Insert executed but returned no data")
        print("💡 This might be normal if RLS policies don't allow returning data")
        
except Exception as e:
    print(f"❌ Insert failed: {e}")
    print("\n🔍 Detailed error information:")
    print(f"Error type: {type(e).__name__}")
    print(f"Error message: {str(e)}")
    
    # Check if it's an RLS error
    if "new row violates row-level security policy" in str(e).lower():
        print("\n⚠️ This is an RLS (Row Level Security) issue!")
        print("💡 Solutions:")
        print("   1. Check if you have an INSERT policy that allows inserts")
        print("   2. Make sure you're using the correct API key (anon vs service role)")
        print("   3. If using anon key, ensure the policy allows anonymous inserts")

# Test upsert
print("\n📋 STEP 6: Testing upsert (without select)...")
try:
    result = supabase.table('news_trends').upsert(
        [test_item], 
        on_conflict='video_id'
    ).execute()
    
    if hasattr(result, 'data') and result.data:
        print(f"✅ Upsert successful! Upserted {len(result.data)} item(s)")
        
        # Clean up
        delete_result = supabase.table('news_trends').delete().eq('video_id', test_item['video_id']).execute()
        print("✅ Test data cleaned up")
    else:
        print("⚠️ Upsert executed but returned no data")
        print("💡 Trying to verify if data was inserted...")
        
        # Try to fetch the inserted data
        verify_result = supabase.table('news_trends').select('*').eq('video_id', test_item['video_id']).execute()
        if verify_result.data:
            print(f"✅ Data was inserted successfully! Found {len(verify_result.data)} item(s)")
            # Clean up
            delete_result = supabase.table('news_trends').delete().eq('video_id', test_item['video_id']).execute()
            print("✅ Test data cleaned up")
        
except Exception as e:
    print(f"❌ Upsert failed: {e}")

# Check if we're using service role key
print("\n📋 STEP 7: Checking API key type...")
if supabase_key and len(supabase_key) > 100:
    print("🔑 Key length suggests this might be a service role key (good for backend)")
else:
    print("🔑 Key length suggests this might be an anon key")

# Final recommendations
print("\n" + "=" * 80)
print("📋 DIAGNOSTIC SUMMARY")
print("=" * 80)

print("\n🔍 Common issues and solutions:")
print("\n1. If inserts fail with RLS errors:")
print("   - Ensure you have created an INSERT policy in Supabase")
print("   - The policy should be: FOR INSERT USING (true)")
print("   - Or use a service role key (bypasses RLS)")

print("\n2. If upserts return no data:")
print("   - Always add .select() after .upsert()")
print("   - Example: .upsert(data).select().execute()")

print("\n3. Environment variable issues:")
print("   - Python backend should use: SUPABASE_URL and SUPABASE_KEY")
print("   - Frontend should use: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY")

print("\n4. Check your Supabase dashboard:")
print("   - Go to Authentication > Policies")
print("   - Ensure news_trends table has proper RLS policies")
print("   - For testing, you can temporarily disable RLS (not recommended for production)")

print("\n✅ Diagnostic complete!")
