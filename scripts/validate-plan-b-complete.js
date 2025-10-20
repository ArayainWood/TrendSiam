#!/usr/bin/env node

/**
 * Plan-B Security Complete Validation
 * 
 * Comprehensive test suite to validate Plan-B Security Model implementation
 * Tests database views, API endpoints, and frontend functionality
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('❌ Missing environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false }
});

let totalTests = 0;
let passedTests = 0;

function test(name, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ ${name}`);
    if (details) console.log(`   ${details}`);
  } else {
    console.log(`❌ ${name}`);
    if (details) console.log(`   ${details}`);
  }
  return condition;
}

async function testViewAccess(viewName, description) {
  try {
    const { data, error } = await supabase
      .from(viewName)
      .select('count', { count: 'exact', head: true });
    
    return test(
      `${description} accessible`,
      !error,
      error ? `Error: ${error.message}` : `Count query successful`
    );
  } catch (err) {
    return test(
      `${description} accessible`,
      false,
      `Exception: ${err.message}`
    );
  }
}

async function testBaseTableBlocked(tableName, description) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('count', { count: 'exact', head: true });
    
    return test(
      `${description} properly blocked`,
      !!error,
      error ? `Correctly blocked: ${error.message}` : `SECURITY ISSUE: Base table accessible!`
    );
  } catch (err) {
    return test(
      `${description} properly blocked`,
      true,
      `Correctly blocked: ${err.message}`
    );
  }
}

async function testApiEndpoint(endpoint, description, expectedFields = []) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`);
    const data = await response.json();
    
    if (!response.ok) {
      return test(
        `${description} responds`,
        false,
        `HTTP ${response.status}: ${data.error || 'Failed'}`
      );
    }

    let fieldsOk = true;
    let fieldDetails = '';
    
    if (expectedFields.length > 0 && data.data && Array.isArray(data.data) && data.data.length > 0) {
      const item = data.data[0];
      const missingFields = expectedFields.filter(field => !(field in item));
      if (missingFields.length > 0) {
        fieldsOk = false;
        fieldDetails = `Missing fields: ${missingFields.join(', ')}`;
      } else {
        fieldDetails = `All expected fields present`;
      }
    }
    
    return test(
      `${description} responds correctly`,
      response.ok && (expectedFields.length === 0 || fieldsOk),
      fieldDetails || `Status: ${response.status}`
    );
  } catch (err) {
    return test(
      `${description} responds`,
      false,
      `Network error: ${err.message}`
    );
  }
}

async function testDataFreshness() {
  try {
    const response = await fetch(`${BASE_URL}/api/home?limit=5`);
    const data = await response.json();
    
    if (!response.ok || !data.data) {
      return test(
        'Home feed has data',
        false,
        'No data returned from home API'
      );
    }

    const hasData = data.data.length > 0;
    const hasRequiredFields = hasData && data.data[0].title && data.data[0].id;
    
    test('Home feed returns data', hasData, `${data.data.length} items returned`);
    return test('Home feed has required fields', hasRequiredFields, 'title and id present');
  } catch (err) {
    return test(
      'Home feed accessible',
      false,
      `Error: ${err.message}`
    );
  }
}

async function runDatabaseTests() {
  console.log('\n🗄️  DATABASE VIEW TESTS');
  console.log('='.repeat(50));
  
  // Views should be accessible
  await testViewAccess('public_v_home_news', 'Home news view');
  await testViewAccess('public_v_weekly_stats', 'Weekly stats view');
  await testViewAccess('public_v_weekly_snapshots', 'Weekly snapshots view');
  
  // Base tables should be blocked
  await testBaseTableBlocked('news_trends', 'News trends table');
  await testBaseTableBlocked('stories', 'Stories table');
  await testBaseTableBlocked('weekly_report_snapshots', 'Weekly snapshots table');
  await testBaseTableBlocked('image_files', 'Image files table');
  await testBaseTableBlocked('snapshots', 'Snapshots table');
}

async function runApiTests() {
  console.log('\n🌐 API ENDPOINT TESTS');
  console.log('='.repeat(50));
  
  await testApiEndpoint('/api/health', 'Health check');
  await testApiEndpoint('/api/home?limit=5', 'Home feed', ['id', 'title', 'summary']);
  await testApiEndpoint('/api/test-plan-b', 'Plan-B security test');
  
  // Test with cache buster
  const timestamp = Date.now();
  await testApiEndpoint(`/api/home?ts=${timestamp}&limit=3`, 'Home feed with cache buster', ['id', 'title']);
}

async function runFunctionalityTests() {
  console.log('\n🔧 FUNCTIONALITY TESTS');
  console.log('='.repeat(50));
  
  await testDataFreshness();
  
  // Test search functionality
  try {
    const response = await fetch(`${BASE_URL}/api/home?search=thailand&limit=3`);
    const data = await response.json();
    
    test(
      'Search functionality works',
      response.ok,
      response.ok ? `Search returned ${data.data?.length || 0} results` : 'Search failed'
    );
  } catch (err) {
    test('Search functionality works', false, `Error: ${err.message}`);
  }
}

async function runSecurityTests() {
  console.log('\n🔒 SECURITY COMPLIANCE TESTS');
  console.log('='.repeat(50));
  
  // Test Plan-B security endpoint
  try {
    const response = await fetch(`${BASE_URL}/api/test-plan-b`);
    const data = await response.json();
    
    if (response.ok && data.security_score !== undefined) {
      test(
        'Plan-B security score >= 90%',
        data.security_score >= 90,
        `Security score: ${data.security_score}%`
      );
      
      test(
        'Plan-B security overall status',
        data.ok,
        data.summary
      );
    } else {
      test('Plan-B security test accessible', false, 'Security test endpoint failed');
    }
  } catch (err) {
    test('Plan-B security test accessible', false, `Error: ${err.message}`);
  }
}

async function runPerformanceTests() {
  console.log('\n⚡ PERFORMANCE TESTS');
  console.log('='.repeat(50));
  
  // Test response times
  const endpoints = [
    { path: '/api/health', name: 'Health check', maxTime: 1000 },
    { path: '/api/home?limit=10', name: 'Home feed', maxTime: 2000 }
  ];
  
  for (const endpoint of endpoints) {
    const start = Date.now();
    try {
      const response = await fetch(`${BASE_URL}${endpoint.path}`);
      const duration = Date.now() - start;
      
      test(
        `${endpoint.name} responds within ${endpoint.maxTime}ms`,
        response.ok && duration <= endpoint.maxTime,
        `Response time: ${duration}ms`
      );
    } catch (err) {
      test(
        `${endpoint.name} performance`,
        false,
        `Error: ${err.message}`
      );
    }
  }
}

async function main() {
  console.log('🔍 Plan-B Security Complete Validation');
  console.log('=====================================');
  console.log(`Testing against: ${BASE_URL}`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log('');

  await runDatabaseTests();
  await runApiTests();
  await runFunctionalityTests();
  await runSecurityTests();
  await runPerformanceTests();

  // Summary
  const score = Math.round((passedTests / totalTests) * 100);
  console.log('\n📊 VALIDATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`Tests passed: ${passedTests}/${totalTests} (${score}%)`);
  
  if (score >= 95) {
    console.log('🎉 EXCELLENT: Plan-B Security Model is fully implemented and working!');
    process.exit(0);
  } else if (score >= 85) {
    console.log('✅ GOOD: Plan-B Security Model is mostly working with minor issues.');
    process.exit(0);
  } else if (score >= 70) {
    console.log('⚠️  WARNING: Plan-B Security Model has significant issues that need attention.');
    process.exit(1);
  } else {
    console.log('❌ CRITICAL: Plan-B Security Model implementation has major problems.');
    process.exit(1);
  }
}

// Handle errors gracefully
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the validation
main().catch(err => {
  console.error('💥 Validation failed:', err);
  process.exit(1);
});
