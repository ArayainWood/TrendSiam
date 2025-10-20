#!/usr/bin/env node
/**
 * Test Home API after migration
 * Usage: node frontend/scripts/test-home-api.mjs
 * Requires: Dev server running on localhost:3000
 */

const BASE_URL = 'http://localhost:3000';

async function testEndpoint(name, url, validator) {
  try {
    console.log(`\n📍 Testing: ${name}`);
    console.log(`   URL: ${url}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`   Status: ${response.status} ${response.ok ? '✅' : '❌'}`);
    
    if (validator) {
      const result = validator(data);
      if (result.pass) {
        console.log(`   Validation: ✅ ${result.message}`);
      } else {
        console.error(`   Validation: ❌ ${result.message}`);
        return false;
      }
    }
    
    return response.ok;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('Home API Test Suite');
  console.log('========================================');
  
  const tests = [
    {
      name: '/api/home',
      url: `${BASE_URL}/api/home`,
      validator: (data) => {
        if (!data.success) {
          return { pass: false, message: 'Response success=false' };
        }
        if (!Array.isArray(data.data)) {
          return { pass: false, message: 'data is not an array' };
        }
        if (data.data.length === 0) {
          return { pass: false, message: 'data array is empty (expected ≥1 items)' };
        }
        if (!data.data[0].webViewCount && data.data[0].webViewCount !== 0) {
          return { pass: false, message: 'First item missing webViewCount property' };
        }
        if (!data.meta?.schemaGuard) {
          return { pass: false, message: 'Missing meta.schemaGuard' };
        }
        
        return { 
          pass: true, 
          message: `${data.fetchedCount} items, webViewCount present, schemaGuard: ${JSON.stringify(data.meta.schemaGuard)}` 
        };
      }
    },
    {
      name: '/api/home/diagnostics',
      url: `${BASE_URL}/api/home/diagnostics`,
      validator: (data) => {
        if (!data.success) {
          return { pass: false, message: 'Response success=false' };
        }
        if (data.fetchedCount === 0) {
          return { pass: false, message: 'fetchedCount is 0' };
        }
        if (data.missingColumns && data.missingColumns.length > 0) {
          return { pass: false, message: `Missing columns: ${data.missingColumns.join(', ')}` };
        }
        if (!data.columnsFromView || data.columnsFromView.length === 0) {
          return { pass: false, message: 'columnsFromView is empty' };
        }
        
        const hasWebViewCount = data.columnsFromView.includes('web_view_count');
        
        return { 
          pass: true, 
          message: `${data.fetchedCount} items, ${data.columnsFromView.length} columns, web_view_count: ${hasWebViewCount ? '✓' : '✗'}` 
        };
      }
    },
    {
      name: '/api/health-schema?check=home_view',
      url: `${BASE_URL}/api/health-schema?check=home_view`,
      validator: (data) => {
        if (!data.ok) {
          return { pass: false, message: `Health check failed: ${data.message || 'unknown'}` };
        }
        if (!data.columns?.hasWebViewCount) {
          return { pass: false, message: 'hasWebViewCount is false or missing' };
        }
        if (data.columns.total !== 27) {
          return { pass: false, message: `Expected 27 columns, got ${data.columns.total}` };
        }
        
        return { 
          pass: true, 
          message: `${data.viewName} healthy, 27 columns, web_view_count present` 
        };
      }
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await testEndpoint(test.name, test.url, test.validator);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('\n========================================');
  console.log(`Results: ${passed}/${tests.length} passed`);
  console.log('========================================');
  
  if (failed > 0) {
    console.error('\n❌ Some tests failed. Check the output above for details.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  console.error('\n💡 Is the dev server running? Start it with: cd frontend && npm run dev');
  process.exit(1);
});
