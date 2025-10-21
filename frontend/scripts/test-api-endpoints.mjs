/**
 * Test API Endpoints
 * 
 * Test home and weekly APIs to verify they return data
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

console.log('🔍 Testing TrendSiam API Endpoints');
console.log('=' .repeat(60));
console.log(`Base URL: ${BASE_URL}`);
console.log('');

async function testEndpoint(name, path) {
  console.log(`\n📋 Testing: ${name}`);
  console.log(`   Path: ${path}`);
  
  const url = `${BASE_URL}${path}`;
  
  try {
    const response = await fetch(url);
    const status = response.status;
    
    console.log(`   Status: ${status} ${response.statusText}`);
    
    if (!response.ok) {
      const text = await response.text();
      console.log(`   ❌ Error response: ${text.substring(0, 200)}`);
      return { success: false, status };
    }
    
    const data = await response.json();
    
    // Check structure
    if (name.includes('Home')) {
      console.log(`   ✅ Success: ${data.success ? 'true' : 'false'}`);
      console.log(`   Items: ${data.data?.length || 0}`);
      console.log(`   Source: ${data.source}`);
      if (data.data && data.data.length > 0) {
        console.log(`   First item: ${data.data[0].title?.substring(0, 50)}...`);
        console.log(`   First item ID: ${data.data[0].id}`);
        console.log(`   First item score: ${data.data[0].popularity_score_precise}`);
      }
    } else if (name.includes('Weekly')) {
      console.log(`   ✅ Success: ${data.success ? 'true' : 'false'}`);
      console.log(`   Items: ${data.items?.length || 0}`);
      console.log(`   Source: ${data.source}`);
      console.log(`   Snapshot ID: ${data.snapshotId || 'N/A'}`);
      if (data.items && data.items.length > 0) {
        console.log(`   First item: ${data.items[0].title?.substring(0, 50)}...`);
      }
    } else {
      console.log(`   ✅ Response: ${JSON.stringify(data).substring(0, 100)}...`);
    }
    
    return { success: true, data, status };
    
  } catch (error) {
    console.log(`   ❌ Exception: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  const results = {};
  
  // Test Home API
  results.home = await testEndpoint('Home API', '/api/home');
  
  // Test Weekly API
  results.weekly = await testEndpoint('Weekly API', '/api/weekly');
  
  // Test Health endpoints
  results.healthHome = await testEndpoint('Health: Home', '/api/health/home');
  results.healthDb = await testEndpoint('Health: DB', '/api/health/db');
  
  console.log('\n' + '='.repeat(60));
  console.log('📝 SUMMARY');
  console.log('='.repeat(60));
  
  const tests = Object.keys(results);
  const passed = tests.filter(k => results[k].success);
  const failed = tests.filter(k => !results[k].success);
  
  console.log(`✅ Passed: ${passed.length}/${tests.length}`);
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.join(', ')}`);
  }
  
  if (failed.length === 0) {
    console.log('\n✅ All API endpoints working!');
    process.exit(0);
  } else {
    console.log('\n❌ Some API endpoints failed');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

