#!/usr/bin/env node
/**
 * Test Backward Compatibility Fix
 * Date: 2025-10-08
 * Usage: node frontend/scripts/test-backward-compatibility.mjs
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

console.log('========================================')
console.log('BACKWARD COMPATIBILITY TEST')
console.log('========================================\n')

// Test 1: /api/home - Should return 200 (not 500)
console.log('📊 Test 1: Home API Returns Data (Not 500)')
console.log('---')

try {
  const response = await fetch(`${BASE_URL}/api/home`)
  const data = await response.json()
  
  console.log(`Status: ${response.status}`)
  
  if (response.status === 500) {
    console.error('❌ FAIL: API returned 500 error')
    console.error('Error:', data.error || data)
    process.exit(1)
  }
  
  if (!response.ok) {
    console.error(`❌ FAIL: API returned ${response.status}`)
    console.error(data)
    process.exit(1)
  }
  
  console.log(`✅ PASS: HTTP 200`)
  console.log(`✅ Total items: ${data.data?.length || 0}`)
  console.log(`✅ Error: ${data.error || 'null'}`)
  
  if (data.data && data.data.length > 0) {
    const sample = data.data[0]
    console.log('\n--- Sample Story Fields ---')
    console.log(`Title: ${sample.title?.slice(0, 40)}`)
    console.log(`Views (legacy): ${sample.views !== undefined ? '✅ Present' : '❌ Missing'}`)
    console.log(`VideoViews (canonical): ${sample.videoViews !== undefined ? '✅ Present' : '⚠️ Missing (mapper not updated yet)'}`)
    console.log(`WebViewCount (site): ${sample.webViewCount !== undefined ? '✅ Present' : '❌ Missing'}`)
    
    // Check backward compatibility
    if (sample.views !== undefined && sample.videoViews !== undefined) {
      if (sample.views === sample.videoViews) {
        console.log(`✅ Backward compatibility: views === videoViews (${sample.views})`)
      } else {
        console.log(`⚠️  WARNING: views (${sample.views}) !== videoViews (${sample.videoViews})`)
      }
    } else if (sample.views !== undefined && sample.videoViews === undefined) {
      console.log(`✅ Legacy mode: Using "views" column (${sample.views})`)
    }
  }
} catch (error) {
  console.error('❌ Error:', error.message)
  console.error('\n⚠️  Make sure dev server is running: cd frontend && npm run dev')
  process.exit(1)
}

console.log('\n========================================')
console.log('DIAGNOSTICS TEST')
console.log('========================================\n')

// Test 2: /api/home/diagnostics
console.log('📊 Test 2: Diagnostics Shows All Columns')
console.log('---')

try {
  const response = await fetch(`${BASE_URL}/api/home/diagnostics`)
  const data = await response.json()
  
  console.log(`Status: ${response.status}`)
  
  if (!response.ok) {
    console.error(`❌ FAIL: Diagnostics returned ${response.status}`)
    console.error(data)
    process.exit(1)
  }
  
  console.log(`✅ PASS: HTTP 200`)
  console.log(`Total columns: ${data.columnsFromView?.length || 0}`)
  console.log(`Missing columns: ${data.missingColumns?.length || 0}`)
  
  // Check for key columns
  const cols = data.columnsFromView || []
  const hasViews = cols.includes('views')
  const hasVideoViews = cols.includes('video_views')
  const hasWebViewCount = data.hasWebViewCount || false
  
  console.log(`\n--- Key Columns ---`)
  console.log(`views (legacy): ${hasViews ? '✅ Present' : '❌ Missing'}`)
  console.log(`video_views (canonical): ${hasVideoViews ? '✅ Present' : '❌ Missing'}`)
  console.log(`web_view_count (site): ${hasWebViewCount ? '✅ Present' : '❌ Missing'}`)
  
  if (data.missingColumns && data.missingColumns.length > 0) {
    console.log(`\n⚠️  Missing columns detected:`)
    data.missingColumns.forEach(col => console.log(`   - ${col}`))
  } else {
    console.log(`\n✅ No missing columns`)
  }
} catch (error) {
  console.error('❌ Error:', error.message)
}

console.log('\n========================================')
console.log('SUMMARY')
console.log('========================================\n')

console.log('✅ Backward Compatibility: Check if "views" column exists')
console.log('✅ API Health: Should return 200 (not 500)')
console.log('✅ Diagnostics: Should show all expected columns\n')

console.log('Next Steps:')
console.log('1. Verify Homepage loads (http://localhost:3000)')
console.log('2. Click a story card → Modal opens')
console.log('3. Check Story Details shows platform views')
console.log('4. Verify cards show site click counts\n')

