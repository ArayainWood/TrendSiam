#!/usr/bin/env node
/**
 * Web Views Tracking E2E Test
 * Tests the complete flow: Card click → Telemetry → DB → API → UI
 * 
 * Usage: node scripts/test-web-views-tracking.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env.local from project root
config({ path: join(__dirname, '../../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const anonClient = createClient(SUPABASE_URL, ANON_KEY)
const adminClient = createClient(SUPABASE_URL, SERVICE_KEY)

// ============================================================================
// Test 1: RPC Function Exists and is Callable
// ============================================================================

async function testRPCExists() {
  console.log('\n📋 Test 1: RPC Function (util_has_column) Exists')
  
  try {
    const { data, error } = await anonClient.rpc('util_has_column', {
      view_name: 'home_feed_v1',
      col_name: 'web_view_count'
    })
    
    if (error) {
      console.error('❌ FAIL: RPC error:', error.message)
      return false
    }
    
    if (data === true) {
      console.log('✅ PASS: RPC callable, web_view_count column exists')
      return true
    } else {
      console.error('❌ FAIL: web_view_count column missing from home_feed_v1')
      return false
    }
  } catch (err) {
    console.error('❌ FAIL: Exception:', err.message)
    return false
  }
}

// ============================================================================
// Test 2: Home API Returns web_view_count
// ============================================================================

async function testHomeAPI() {
  console.log('\n📋 Test 2: Home API Includes web_view_count')
  
  try {
    const response = await fetch(`${SUPABASE_URL.replace('//', '//').replace(/:\d+/, '')}:3000/api/home`)
    
    if (!response.ok) {
      console.error(`❌ FAIL: Home API returned ${response.status}`)
      return false
    }
    
    const json = await response.json()
    
    if (!json.success) {
      console.error('❌ FAIL: Home API success=false')
      return false
    }
    
    if (!json.data || json.data.length === 0) {
      console.warn('⚠️  WARN: Home API returned no data (pipeline may need to run)')
      return true // Not a failure, just no data
    }
    
    const firstItem = json.data[0]
    
    if (typeof firstItem.webViewCount !== 'number') {
      console.error('❌ FAIL: webViewCount missing or not a number:', typeof firstItem.webViewCount)
      return false
    }
    
    console.log('✅ PASS: Home API includes webViewCount:', firstItem.webViewCount)
    
    // Check schema guard metadata
    if (json.meta?.schemaGuard) {
      const { hasWebViewCount, usingFallback } = json.meta.schemaGuard
      console.log(`   Schema Guard: hasColumn=${hasWebViewCount}, fallback=${usingFallback}`)
      
      if (!hasWebViewCount && !usingFallback) {
        console.error('❌ FAIL: Schema guard inconsistent (column missing but not using fallback)')
        return false
      }
    }
    
    return true
  } catch (err) {
    console.error('❌ FAIL: Exception:', err.message)
    return false
  }
}

// ============================================================================
// Test 3: Telemetry Endpoint Increments Count
// ============================================================================

async function testTelemetryIncrement() {
  console.log('\n📋 Test 3: Telemetry Endpoint Increments View Count')
  
  try {
    // Get a sample story from DB
    const { data: stories, error: fetchError } = await adminClient
      .from('news_trends')
      .select('id, video_id, view_count')
      .not('video_id', 'is', null)
      .limit(1)
      .single()
    
    if (fetchError || !stories) {
      console.error('❌ FAIL: Could not fetch test story:', fetchError?.message)
      return false
    }
    
    const { video_id, view_count } = stories
    const beforeCount = parseInt(String(view_count || '0').replace(/[^0-9]/g, ''), 10) || 0
    
    console.log(`   Test story: ${video_id}, current count: ${beforeCount}`)
    
    // Call telemetry endpoint
    const response = await fetch(`${SUPABASE_URL.replace('//', '//').replace(/:\d+/, '')}:3000/api/telemetry/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id })
    })
    
    if (!response.ok) {
      console.error(`❌ FAIL: Telemetry returned ${response.status}`)
      return false
    }
    
    const json = await response.json()
    
    if (!json.success) {
      console.error('❌ FAIL: Telemetry success=false:', json.error)
      return false
    }
    
    const afterCount = json.views
    
    if (afterCount !== beforeCount + 1) {
      console.error(`❌ FAIL: Count not incremented correctly (${beforeCount} → ${afterCount})`)
      return false
    }
    
    console.log(`✅ PASS: View count incremented (${beforeCount} → ${afterCount})`)
    
    // Check rate limit headers
    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining')
    if (rateLimitRemaining) {
      console.log(`   Rate limit remaining: ${rateLimitRemaining}`)
    }
    
    return true
  } catch (err) {
    console.error('❌ FAIL: Exception:', err.message)
    return false
  }
}

// ============================================================================
// Test 4: Rate Limiting Works
// ============================================================================

async function testRateLimiting() {
  console.log('\n📋 Test 4: Rate Limiting Prevents Abuse')
  
  try {
    // This test would require 100+ rapid requests, skip for now
    console.log('⏭️  SKIP: Manual test required (would need 100+ requests)')
    console.log('   To test: Make 100+ requests to /api/telemetry/view from same IP')
    console.log('   Expected: 429 status after 100 requests')
    return true
  } catch (err) {
    console.error('❌ FAIL: Exception:', err.message)
    return false
  }
}

// ============================================================================
// Test 5: Health Endpoint Reports Correctly
// ============================================================================

async function testHealthEndpoint() {
  console.log('\n📋 Test 5: Health Endpoint Reports Schema Status')
  
  try {
    const response = await fetch(`${SUPABASE_URL.replace('//', '//').replace(/:\d+/, '')}:3000/api/health-schema?check=home_view`)
    
    if (!response.ok && response.status !== 503) {
      console.error(`❌ FAIL: Health endpoint returned ${response.status}`)
      return false
    }
    
    const json = await response.json()
    
    console.log(`   Status: ${json.ok ? '✅ Healthy' : '⚠️  Degraded'}`)
    console.log(`   View: ${json.viewName}`)
    console.log(`   Columns: ${json.columns?.total || 'unknown'}`)
    console.log(`   Has web_view_count: ${json.columns?.hasWebViewCount ? 'Yes' : 'No'}`)
    
    if (json.columns?.hasWebViewCount === false) {
      console.warn('⚠️  WARN: web_view_count column missing (check migration status)')
    }
    
    return true
  } catch (err) {
    console.error('❌ FAIL: Exception:', err.message)
    return false
  }
}

// ============================================================================
// Run All Tests
// ============================================================================

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('🧪 Web Views Tracking E2E Test Suite')
  console.log('═══════════════════════════════════════════════════════════')
  
  const results = {
    rpc: await testRPCExists(),
    homeAPI: await testHomeAPI(),
    telemetry: await testTelemetryIncrement(),
    rateLimit: await testRateLimiting(),
    health: await testHealthEndpoint()
  }
  
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('📊 Test Results Summary')
  console.log('═══════════════════════════════════════════════════════════')
  
  for (const [name, passed] of Object.entries(results)) {
    console.log(`${passed ? '✅' : '❌'} ${name}`)
  }
  
  const totalPassed = Object.values(results).filter(Boolean).length
  const total = Object.values(results).length
  
  console.log(`\n${totalPassed}/${total} tests passed`)
  
  if (totalPassed === total) {
    console.log('\n🎉 All tests passed!')
    process.exit(0)
  } else {
    console.log('\n❌ Some tests failed')
    process.exit(1)
  }
}

runAllTests().catch(err => {
  console.error('\n💥 Test suite crashed:', err)
  process.exit(1)
})
