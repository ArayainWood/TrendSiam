#!/usr/bin/env npx tsx
/**
 * Debug homepage image rendering issues
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!url || !key) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

async function debugHomepageImages() {
  console.log('\n📊 Debugging Homepage Image Issues\n');
  console.log('=' * 80);
  
  // 1. Check what the home API returns
  console.log('\n1️⃣ Checking /api/home endpoint response...');
  try {
    const homeResponse = await fetch('http://localhost:3000/api/home', {
      headers: { 'Cache-Control': 'no-store' }
    });
    const homeData = await homeResponse.json();
    
    console.log(`   Source: ${homeData.source}`);
    console.log(`   Items: ${homeData.data?.length || 0}`);
    
    if (homeData.data && homeData.data.length > 0) {
      console.log('\n   Top 3 items from API:');
      homeData.data.slice(0, 3).forEach((item: any, idx: number) => {
        console.log(`   #${idx + 1} ${item.title?.substring(0, 40)}...`);
        console.log(`      Score: ${item.popularity_score_precise || item.score}`);
        console.log(`      ai_image_url: ${item.ai_image_url ? '✅ ' + item.ai_image_url.substring(0, 50) + '...' : '❌ NULL'}`);
        console.log(`      display_image_url: ${item.display_image_url ? '✅ ' + item.display_image_url.substring(0, 50) + '...' : '❌ NULL'}`);
        console.log(`      Fields present: ${Object.keys(item).join(', ')}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('   ❌ Failed to fetch from /api/home:', error);
  }
  
  // 2. Check what weekly_public_view returns
  console.log('\n2️⃣ Checking weekly_public_view directly...');
  const { data: viewData, error: viewError } = await supabase
    .from('weekly_public_view')
    .select('*')
    .limit(3);
    
  if (viewError) {
    console.error('   ❌ View error:', viewError.message);
  } else if (viewData && viewData.length > 0) {
    console.log('   View columns:', Object.keys(viewData[0]));
    viewData.forEach((item: any, idx: number) => {
      console.log(`\n   #${idx + 1} ${item.title?.substring(0, 40)}...`);
      console.log(`      ai_image_url: ${item.ai_image_url ? '✅' : '❌'}`);
      console.log(`      display_image_url: ${item.display_image_url ? '✅' : '❌'}`);
    });
  }
  
  // 3. Check image accessibility
  console.log('\n\n3️⃣ Checking image URL accessibility...');
  const { data: topItems } = await supabase
    .from('news_trends')
    .select('title, ai_image_url')
    .order('popularity_score_precise', { ascending: false })
    .limit(3);
    
  if (topItems) {
    for (const item of topItems) {
      if (item.ai_image_url) {
        console.log(`\n   Testing: ${item.title?.substring(0, 40)}...`);
        console.log(`   URL: ${item.ai_image_url}`);
        
        try {
          const response = await fetch(item.ai_image_url, { method: 'HEAD' });
          console.log(`   Status: ${response.status} ${response.statusText}`);
          console.log(`   Content-Type: ${response.headers.get('content-type')}`);
        } catch (error: any) {
          console.log(`   ❌ Failed to access: ${error.message}`);
        }
      }
    }
  }
  
  console.log('\n' + '=' * 80);
  console.log('\n🔍 Next Steps:');
  console.log('1. Check browser DevTools Network tab for failed image requests');
  console.log('2. Check browser Console for image loading errors');
  console.log('3. Verify Next.js is running on http://localhost:3000');
  console.log('4. Ensure Supabase Storage bucket is public');
}

debugHomepageImages().catch(console.error);
