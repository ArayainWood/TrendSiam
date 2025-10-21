/**
 * Test Home API Data Structure
 * 
 * Check what fields are actually returned by /api/home
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

console.log('🔍 Testing Home API Data Structure');
console.log('=' .repeat(60));

async function testHomeApi() {
  try {
    const response = await fetch(`${BASE_URL}/api/home`);
    
    if (!response.ok) {
      console.log(`❌ API returned ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.log('Response:', text.substring(0, 500));
      return;
    }
    
    const data = await response.json();
    
    console.log(`✅ API Success`);
    console.log(`   Items: ${data.data?.length || 0}`);
    console.log(`   Source: ${data.source}`);
    
    if (data.data && data.data.length > 0) {
      const firstItem = data.data[0];
      
      console.log('\n📋 First Item Fields:');
      console.log('   ID:', firstItem.id);
      console.log('   Title:', firstItem.title?.substring(0, 50) + '...');
      console.log('   Category:', firstItem.category);
      console.log('   Channel:', firstItem.channel);
      console.log('   Popularity Score:', firstItem.popularity_score);
      console.log('   Popularity Score Precise:', firstItem.popularity_score_precise);
      console.log('   Published At:', firstItem.published_at);
      console.log('   Published Date:', firstItem.published_date);
      console.log('   Views:', firstItem.view_count || firstItem.views);
      console.log('   Likes:', firstItem.like_count || firstItem.likes);
      console.log('   Comments:', firstItem.comment_count || firstItem.comments);
      console.log('   Growth Rate:', firstItem.growth_rate);
      console.log('   Platforms:', firstItem.platforms);
      console.log('   Keywords:', firstItem.keywords);
      console.log('   AI Opinion:', firstItem.ai_opinion ? firstItem.ai_opinion.substring(0, 50) + '...' : 'N/A');
      console.log('   AI Image URL:', firstItem.ai_image_url || 'N/A');
      console.log('   AI Image Prompt:', firstItem.ai_image_prompt ? 'YES' : 'NO');
      console.log('   Display Image URL:', firstItem.display_image_url || firstItem.displayImageUrl);
      console.log('   Is AI Image:', firstItem.is_ai_image || firstItem.isAIImage);
      console.log('   View Details:', firstItem.view_details ? 'YES' : 'NO');
      
      console.log('\n🔍 All Available Fields:');
      console.log('   ', Object.keys(firstItem).join(', '));
      
      // Check if view_details exists and what's in it
      if (firstItem.view_details) {
        console.log('\n📊 View Details Contents:');
        console.log('   ', JSON.stringify(firstItem.view_details, null, 2));
      }
      
      // Check for missing critical fields
      console.log('\n⚠️  Field Status:');
      const criticalFields = {
        'channel': firstItem.channel,
        'published_at': firstItem.published_at,
        'published_date': firstItem.published_date,
        'view_count': firstItem.view_count || firstItem.views,
        'like_count': firstItem.like_count || firstItem.likes,
        'comment_count': firstItem.comment_count || firstItem.comments,
        'growth_rate': firstItem.growth_rate,
        'platforms': firstItem.platforms,
        'keywords': firstItem.keywords,
        'ai_opinion': firstItem.ai_opinion,
        'view_details': firstItem.view_details
      };
      
      for (const [field, value] of Object.entries(criticalFields)) {
        const status = value ? '✅' : '❌';
        console.log(`   ${status} ${field}:`, value || 'MISSING');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testHomeApi();

