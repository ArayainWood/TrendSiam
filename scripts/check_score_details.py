#!/usr/bin/env python3
"""Check score_details column and data in the database"""

import os
from datetime import datetime
from supabase import create_client, Client

# Initialize Supabase client
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_ANON_KEY')

if not supabase_url or not supabase_key:
    print('❌ Missing Supabase credentials')
    exit(1)

supabase: Client = create_client(supabase_url, supabase_key)

print('🔍 Checking score_details for today\'s batch...\n')

try:
    # Get today's date
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Fetch today's stories
    result = supabase.from_('news_trends').select(
        'id, video_id, title, popularity_score_precise, view_count, score_details'
    ).eq('date', today).order('popularity_score_precise', desc=True).limit(20).execute()
    
    print(f'Found {len(result.data)} stories for today ({today})')
    print('\nScore details status:')
    print('-' * 80)
    
    null_count = 0
    empty_count = 0
    has_value_count = 0
    
    for idx, item in enumerate(result.data):
        score_details = item.get('score_details')
        video_id = item.get('video_id', 'unknown')
        title = item.get('title', '')[:40]
        score = item.get('popularity_score_precise', 0)
        
        if score_details is None:
            null_count += 1
            status = 'NULL'
        elif score_details == '':
            empty_count += 1
            status = 'EMPTY'
        else:
            has_value_count += 1
            status = f'HAS_VALUE: "{score_details[:60]}..."' if len(score_details) > 60 else f'HAS_VALUE: "{score_details}"'
        
        print(f'{idx+1:2d}. [{video_id[:10]}...] Score: {score:>5.1f} | {status}')
        print(f'    Title: {title}...')
        print()
    
    print('-' * 80)
    print(f'Summary:')
    print(f'  Total stories: {len(result.data)}')
    print(f'  NULL: {null_count}')
    print(f'  EMPTY: {empty_count}')
    print(f'  HAS_VALUE: {has_value_count}')
    
    # Check if we have the expected structure in existing score_details
    if has_value_count > 0:
        print('\nSample of existing score_details:')
        for item in result.data:
            if item.get('score_details') and item['score_details'] != '':
                print(f'  - {item["score_details"]}')
                break
    
except Exception as e:
    print(f'❌ Error: {str(e)}')
    import traceback
    traceback.print_exc()
