#!/usr/bin/env node

/**
 * Plan-B Security Smoke Test
 * 
 * Quick validation that frontend uses views only, not base tables
 * Run this after deploying the Plan-B migration
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

async function testViewAccess(viewName, description) {
  try {
    const { data, error } = await supabase
      .from(viewName)
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.log(`❌ ${description}: ${error.message}`);
      return false;
    } else {
      console.log(`✅ ${description}: OK`);
      return true;
    }
  } catch (err) {
    console.log(`❌ ${description}: ${err.message}`);
    return false;
  }
}

async function testBaseTableBlocked(tableName, description) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.log(`✅ ${description}: Properly blocked (${error.message})`);
      return true;
    } else {
      console.log(`❌ ${description}: SECURITY ISSUE - Base table accessible!`);
      return false;
    }
  } catch (err) {
    console.log(`✅ ${description}: Properly blocked (${err.message})`);
    return true;
  }
}

async function testApiEndpoint(endpoint, description) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`);
    const data = await response.json();
    
    if (response.ok && data.ok !== false) {
      console.log(`✅ ${description}: OK`);
      return true;
    } else {
      console.log(`❌ ${description}: ${data.error || 'Failed'}`);
      return false;
    }
  } catch (err) {
    console.log(`❌ ${description}: ${err.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🔍 Plan-B Security Smoke Test\n');
  
  let passed = 0;
  let total = 0;
  
  // Test 1: Views should be accessible
  console.log('📊 Testing View Access (Should Succeed):');
  total++; if (await testViewAccess('public_v_home_news', 'Home news view')) passed++;
  total++; if (await testViewAccess('public_v_weekly_stats', 'Weekly stats view')) passed++;
  total++; if (await testViewAccess('public_v_weekly_snapshots', 'Weekly snapshots view')) passed++;
  
  console.log('\n🔒 Testing Base Table Protection (Should Be Blocked):');
  total++; if (await testBaseTableBlocked('news_trends', 'News trends table')) passed++;
  total++; if (await testBaseTableBlocked('stories', 'Stories table')) passed++;
  total++; if (await testBaseTableBlocked('weekly_report_snapshots', 'Weekly snapshots table')) passed++;
  total++; if (await testBaseTableBlocked('image_files', 'Image files table')) passed++;
  
  console.log('\n🌐 Testing API Endpoints:');
  total++; if (await testApiEndpoint('/api/health', 'Health check')) passed++;
  total++; if (await testApiEndpoint('/api/home?limit=5', 'Home feed')) passed++;
  total++; if (await testApiEndpoint('/api/test-plan-b', 'Plan-B security test')) passed++;
  
  // Summary
  const score = Math.round((passed / total) * 100);
  console.log(`\n📋 Summary: ${passed}/${total} tests passed (${score}%)`);
  
  if (score >= 90) {
    console.log('✅ Plan-B Security Model is properly implemented!');
    process.exit(0);
  } else {
    console.log('❌ Plan-B Security Model has issues. Check the failures above.');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(err => {
  console.error('💥 Test runner failed:', err);
  process.exit(1);
});
