#!/usr/bin/env node

/**
 * Test Schema Guard Robustness
 * 
 * Purpose: Verify RPC-based column detection and fallback behavior
 * Usage: node scripts/test-schema-guard.mjs
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anon) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(url, anon, { auth: { persistSession: false } })

console.log('🧪 SCHEMA GUARD ROBUSTNESS TEST')
console.log('=' .repeat(70))
console.log('')

// Test 1: RPC function exists and works
console.log('TEST 1: RPC Function (util_has_column)')
try {
  const { data: hasColumn, error } = await supabase.rpc('util_has_column', {
    view_name: 'home_feed_v1',
    col_name: 'web_view_count'
  })
  
  if (error) {
    console.log('  ❌ RPC failed:', error.message)
    process.exit(1)
  }
  
  console.log('  ✅ RPC works: hasWebViewCount =', hasColumn)
} catch (error) {
  console.log('  ❌ Exception:', error.message)
  process.exit(1)
}
console.log('')

// Test 2: Non-existent column returns false
console.log('TEST 2: Non-existent Column Detection')
try {
  const { data: hasColumn, error } = await supabase.rpc('util_has_column', {
    view_name: 'home_feed_v1',
    col_name: 'non_existent_column_xyz'
  })
  
  if (error) {
    console.log('  ❌ RPC failed:', error.message)
  } else if (hasColumn === false) {
    console.log('  ✅ Correctly returns false for non-existent column')
  } else {
    console.log('  ❌ Expected false, got:', hasColumn)
  }
} catch (error) {
  console.log('  ❌ Exception:', error.message)
}
console.log('')

// Test 3: Health endpoint
console.log('TEST 3: Health Endpoint')
try {
  const response = await fetch('http://localhost:3000/api/health-schema?check=home_view')
  const health = await response.json()
  
  console.log('  Status:', response.status)
  console.log('  ok:', health.ok)
  console.log('  hasWebViewCount:', health.columns?.hasWebViewCount)
  console.log('  columnCount:', health.columns?.total)
  
  if (response.status === 200 && health.ok && health.columns?.hasWebViewCount) {
    console.log('  ✅ Health check passed')
  } else {
    console.log('  ⚠️  Health check degraded or failed')
  }
} catch (error) {
  console.log('  ⚠️  API unreachable:', error.message)
}
console.log('')

// Test 4: Home API with schema guard
console.log('TEST 4: Home API Schema Guard')
try {
  const response = await fetch('http://localhost:3000/api/home')
  const home = await response.json()
  
  console.log('  Status:', response.status)
  console.log('  success:', home.success)
  console.log('  schemaGuard.hasWebViewCount:', home.meta?.schemaGuard?.hasWebViewCount)
  console.log('  schemaGuard.usingFallback:', home.meta?.schemaGuard?.usingFallback)
  console.log('  fetchedCount:', home.fetchedCount)
  
  if (response.status === 200 && home.success) {
    console.log('  ✅ Home API returned 200')
    
    // Check first item has webViewCount
    if (home.data && home.data.length > 0) {
      const firstItem = home.data[0]
      const hasWebViewCount = 'webViewCount' in firstItem
      console.log('  Sample item has webViewCount:', hasWebViewCount, '(value:', firstItem.webViewCount, ')')
    }
  } else {
    console.log('  ❌ Home API failed')
  }
} catch (error) {
  console.log('  ⚠️  API unreachable:', error.message)
}
console.log('')

console.log('=' .repeat(70))
console.log('✅ All tests complete')
console.log('')
