// Test script for /api/home endpoint
// Usage: node test-api-home.js

const fetch = require('node-fetch');

async function testHomeAPI() {
  try {
    console.log('🧪 Testing /api/home endpoint...\n');
    
    // Test main endpoint with debug
    const response = await fetch('http://localhost:3000/api/home?debug=1');
    const data = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      console.error('❌ API Error:', data);
      return;
    }
    
    console.log('\n📋 API Response Structure:');
    console.log('- data:', Array.isArray(data.data) ? `Array[${data.data.length}]` : typeof data.data);
    console.log('- top3Ids:', Array.isArray(data.top3Ids) ? `Array[${data.top3Ids.length}]` : typeof data.top3Ids);
    console.log('- meta:', data.meta ? 'Present' : 'Missing');
    console.log('- debug:', data.debug ? 'Present' : 'Missing');
    
    if (data.debug) {
      console.log('\n🔍 Debug Info:');
      console.log('- count:', data.debug.count);
      console.log('- nullablePrev:', data.debug.nullablePrev);
      console.log('- top3Count:', data.debug.top3Count);
      console.log('- showImageCount:', data.debug.showImageCount);
      console.log('- showAiPromptCount:', data.debug.showAiPromptCount);
    }
    
    if (data.data && data.data.length > 0) {
      console.log('\n📝 First Item Keys:');
      console.log(Object.keys(data.data[0]).sort());
      
      console.log('\n🏆 Top 3 Items:');
      data.data.slice(0, 3).forEach((item, index) => {
        console.log(`${index + 1}. ${item.title?.substring(0, 50)}...`);
        console.log(`   - ID: ${item.id}`);
        console.log(`   - isTop3: ${item.isTop3}`);
        console.log(`   - showImage: ${item.showImage}`);
        console.log(`   - showAiPrompt: ${item.showAiPrompt}`);
        console.log(`   - popularityScore: ${item.popularityScore}`);
        console.log(`   - growthRateLabel: ${item.growthRateLabel}`);
        console.log('');
      });
    }
    
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testHomeAPI();
