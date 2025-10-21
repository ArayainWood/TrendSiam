// Test script to validate API response shape
// Usage: node test-api-response.js

const fetch = require('node-fetch');

async function testAPIResponseShape() {
  try {
    console.log('🧪 Testing API response shape validation...\n');
    
    // Test main endpoint
    const response = await fetch('http://localhost:3000/api/home');
    const data = await response.json();
    
    console.log('📊 Response Status:', response.status);
    
    if (!response.ok) {
      console.error('❌ API Error:', data);
      return;
    }
    
    // Validate required shape: { data: [], top3Ids: [], meta: {}, debug?: {} }
    const validations = [
      { test: 'data is array', result: Array.isArray(data.data) },
      { test: 'top3Ids is array', result: Array.isArray(data.top3Ids) },
      { test: 'meta exists', result: typeof data.meta === 'object' && data.meta !== null },
      { test: 'meta.updatedAt exists', result: typeof data.meta?.updatedAt === 'string' },
      { test: 'no top-level success field', result: !('success' in data) },
      { test: 'no top-level error field', result: !('error' in data) },
      { test: 'no top-level code field', result: !('code' in data) },
      { test: 'no top-level message field', result: !('message' in data) }
    ];
    
    console.log('🔍 Shape Validation Results:');
    validations.forEach(({ test, result }) => {
      console.log(`${result ? '✅' : '❌'} ${test}`);
    });
    
    const allPassed = validations.every(v => v.result);
    
    if (allPassed) {
      console.log('\n✅ All shape validations passed!');
      
      if (data.data.length > 0) {
        console.log('\n📝 Sample Item Structure:');
        const sampleItem = data.data[0];
        const requiredFields = ['id', 'title', 'popularityScore', 'isTop3', 'showImage', 'showAiPrompt'];
        
        requiredFields.forEach(field => {
          const exists = field in sampleItem;
          const value = sampleItem[field];
          console.log(`${exists ? '✅' : '❌'} ${field}: ${typeof value} = ${value}`);
        });
      }
    } else {
      console.log('\n❌ Some shape validations failed!');
    }
    
    // Test diagnostics endpoint
    console.log('\n🔍 Testing diagnostics endpoint...');
    const diagResponse = await fetch('http://localhost:3000/api/home/diagnostics');
    const diagData = await diagResponse.json();
    
    console.log('📊 Diagnostics Status:', diagResponse.status);
    if (diagResponse.ok) {
      console.log('✅ fetchedCount:', diagData.fetchedCount);
      console.log('✅ success:', diagData.success);
      if (diagData.top3Details) {
        console.log('✅ top3Details.count:', diagData.top3Details.count);
        console.log('✅ top3Details.withImages:', diagData.top3Details.withImages);
        console.log('✅ top3Details.withPrompts:', diagData.top3Details.withPrompts);
      }
    } else {
      console.log('❌ Diagnostics failed:', diagData);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAPIResponseShape();
