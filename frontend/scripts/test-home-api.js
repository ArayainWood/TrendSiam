#!/usr/bin/env node
/**
 * Home API Test Script
 * Validates the /api/home endpoint meets all acceptance criteria
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testHomeAPI() {
  console.log('🧪 Testing Home API...\n');
  
  let exitCode = 0;
  const errors = [];
  
  try {
    // Test 1: Basic API response
    console.log('Test 1: Basic API response');
    const response = await fetch(`${API_URL}/api/home`);
    
    if (!response.ok) {
      errors.push(`API returned ${response.status}`);
      console.error(`❌ API returned ${response.status}`);
      return 1;
    }
    
    const data = await response.json();
    console.log(`✅ API returned ${data.data?.length || 0} items`);
    
    // Test 2: Data structure validation
    console.log('\nTest 2: Data structure validation');
    if (!data.data || !Array.isArray(data.data)) {
      errors.push('data.data is not an array');
      console.error('❌ data.data is not an array');
    } else {
      console.log('✅ data.data is an array');
    }
    
    // Test 3: Required fields check
    console.log('\nTest 3: Required fields check');
    const requiredFields = [
      'id', 'title', 'sourceUrl', 'popularityScore', 'rank', 'isTop3'
    ];
    
    if (data.data && data.data.length > 0) {
      const firstItem = data.data[0];
      const missingFields = requiredFields.filter(field => !(field in firstItem));
      
      if (missingFields.length > 0) {
        errors.push(`First item missing fields: ${missingFields.join(', ')}`);
        console.error(`❌ First item missing fields: ${missingFields.join(', ')}`);
      } else {
        console.log('✅ All required fields present');
      }
    }
    
    // Test 4: Source URL validation
    console.log('\nTest 4: Source URL validation');
    const invalidSourceUrls = data.data?.filter(item => 
      !item.sourceUrl || 
      item.sourceUrl === '' ||
      (!item.sourceUrl.includes('youtube.com') && !item.sourceUrl.includes('youtu.be') && !item.sourceUrl.includes('trendsiam.com'))
    ) || [];
    
    if (invalidSourceUrls.length > 0) {
      errors.push(`${invalidSourceUrls.length} items have invalid sourceUrl`);
      console.error(`❌ ${invalidSourceUrls.length} items have invalid sourceUrl`);
      invalidSourceUrls.slice(0, 3).forEach(item => {
        console.error(`   - ${item.id}: "${item.sourceUrl}"`);
      });
    } else {
      console.log('✅ All sourceUrls are valid');
    }
    
    // Test 5: Top-3 validation
    console.log('\nTest 5: Top-3 validation');
    const top3Items = data.data?.filter(item => item.isTop3) || [];
    
    if (top3Items.length > 3) {
      errors.push(`Too many Top-3 items: ${top3Items.length}`);
      console.error(`❌ Too many Top-3 items: ${top3Items.length}`);
    } else {
      console.log(`✅ Top-3 count: ${top3Items.length}`);
    }
    
    // Test 6: Top-3 image/prompt policy
    console.log('\nTest 6: Top-3 image/prompt policy');
    const nonTop3WithAssets = data.data?.filter(item => 
      !item.isTop3 && (item.imageUrl || item.aiPrompt)
    ) || [];
    
    if (nonTop3WithAssets.length > 0) {
      errors.push(`${nonTop3WithAssets.length} non-Top3 items have images/prompts`);
      console.error(`❌ ${nonTop3WithAssets.length} non-Top3 items have images/prompts`);
    } else {
      console.log('✅ Top-3 policy compliance: OK');
    }
    
    // Test 7: Debug endpoint
    console.log('\nTest 7: Debug endpoint');
    const debugResponse = await fetch(`${API_URL}/api/home?debug=1`);
    const debugData = await debugResponse.json();
    
    if (debugData.missingColumns && debugData.missingColumns.length > 0) {
      errors.push(`View missing columns: ${debugData.missingColumns.join(', ')}`);
      console.error(`❌ View missing columns: ${debugData.missingColumns.join(', ')}`);
    } else {
      console.log('✅ View has all required columns');
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    if (errors.length === 0) {
      console.log('✅ All tests passed!');
    } else {
      console.log(`❌ ${errors.length} tests failed:`);
      errors.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err}`);
      });
      exitCode = 1;
    }
    
    // Additional debug info
    if (debugData) {
      console.log('\nDebug Info:');
      console.log(`- Config: home_limit=${debugData.config?.home_limit}, top3_max=${debugData.config?.top3_max}`);
      console.log(`- Counts:`, debugData.counts);
      console.log(`- Dropped rows: ${debugData.droppedRows || 0}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    exitCode = 1;
  }
  
  process.exit(exitCode);
}

// Run the test
testHomeAPI();
