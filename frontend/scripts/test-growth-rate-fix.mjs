#!/usr/bin/env node
/**
 * Test Growth Rate Fix and Views Verification
 * Date: 2025-10-08
 * Usage: node frontend/scripts/test-growth-rate-fix.mjs
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

console.log('========================================')
console.log('GROWTH RATE FIX VERIFICATION')
console.log('========================================\n')

// Test 1: /api/home - Check growth rate labels
console.log('📊 Test 1: Check Growth Rate Labels in API Response')
console.log('---')

try {
  const response = await fetch(`${BASE_URL}/api/home`)
  const data = await response.json()
  
  if (!response.ok) {
    console.error(`❌ API returned ${response.status}`)
    console.error(data)
    process.exit(1)
  }
  
  console.log(`✅ Status: ${response.status}`)
  console.log(`✅ Total items: ${data.data?.length || 0}`)
  
  if (data.data && data.data.length > 0) {
    // Check first 3 items (Top-3)
    console.log('\n--- Top-3 Growth Rate Labels ---')
    data.data.slice(0, 3).forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.title?.slice(0, 40)}`)
      console.log(`   Rank: ${item.rank}`)
      console.log(`   Growth Rate Label: "${item.growthRateLabel || 'N/A'}"`)
      console.log(`   Growth Rate Value: ${item.growthRateValue || 'N/A'}`)
      
      // Validation
      const label = item.growthRateLabel || ''
      const isFormatted = 
        label.includes('Viral') || 
        label.includes('High') || 
        label.includes('Moderate') || 
        label.includes('Growing') || 
        label.includes('Stable') ||
        label.includes('Declining')
      
      const isRawNumber = /^\d+(\.\d+)?$/.test(label)
      
      if (isRawNumber) {
        console.log(`   ❌ FAIL: Shows raw number "${label}" instead of formatted label`)
      } else if (isFormatted) {
        console.log(`   ✅ PASS: Formatted label detected`)
      } else {
        console.log(`   ⚠️  WARN: Unexpected label format`)
      }
      console.log('')
    })
    
    // Summary statistics
    const labelCounts = data.data.reduce((acc, item) => {
      const label = item.growthRateLabel || 'Unknown'
      acc[label] = (acc[label] || 0) + 1
      return acc
    }, {})
    
    console.log('--- Growth Rate Label Distribution ---')
    Object.entries(labelCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([label, count]) => {
        const isRawNumber = /^\d+(\.\d+)?$/.test(label)
        const icon = isRawNumber ? '❌' : '✅'
        console.log(`${icon} ${label}: ${count}`)
      })
  }
} catch (error) {
  console.error('❌ Error:', error.message)
  console.error('\n⚠️  Make sure dev server is running: cd frontend && npm run dev')
  process.exit(1)
}

console.log('\n========================================')
console.log('VIEWS SEPARATION CHECK')
console.log('========================================\n')

// Test 2: Check views vs web_view_count
console.log('📊 Test 2: Views Separation (Video vs Web)')
console.log('---')

try {
  const response = await fetch(`${BASE_URL}/api/home`)
  const data = await response.json()
  
  if (data.data && data.data.length > 0) {
    const sample = data.data[0]
    console.log(`Sample Story: ${sample.title?.slice(0, 50)}`)
    console.log(`Video Views: ${sample.views || 'N/A'}`)
    console.log(`Web View Count: ${sample.webViewCount || 'N/A'}`)
    
    if (sample.views === sample.webViewCount && sample.views > 1000000) {
      console.log('\n⚠️  WARNING: Views and web_view_count are IDENTICAL')
      console.log('   This is a known data model limitation.')
      console.log('   Both fields read from news_trends.view_count (YouTube + site clicks combined).')
      console.log('   See docs/WEB_VIEWS_TRACKING.md for details.')
    } else if (Math.abs((sample.views || 0) - (sample.webViewCount || 0)) > 1000) {
      console.log('\n✅ PASS: Views and web_view_count are DIFFERENT')
      console.log('   Video views and site views properly separated.')
    } else {
      console.log('\n⚠️  INFO: Views difference is small (may be expected)')
    }
  }
} catch (error) {
  console.error('❌ Error:', error.message)
}

console.log('\n========================================')
console.log('AI IMAGES CHECK')
console.log('========================================\n')

// Test 3: Check Top-3 AI images
console.log('📊 Test 3: Top-3 AI Images Presence')
console.log('---')

try {
  const response = await fetch(`${BASE_URL}/api/home`)
  const data = await response.json()
  
  if (data.data && data.data.length >= 3) {
    const top3 = data.data.slice(0, 3)
    let hasImages = 0
    
    top3.forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.title?.slice(0, 40)}`)
      console.log(`   Image URL: ${item.imageUrl ? '✅ Present' : '❌ NULL'}`)
      console.log(`   AI Prompt: ${item.aiPrompt ? '✅ Present' : '❌ NULL'}`)
      
      if (item.imageUrl) hasImages++
      console.log('')
    })
    
    if (hasImages === 0) {
      console.log('❌ BLOCKED: No AI images found')
      console.log('   Root cause: ai_images table has 0 rows')
      console.log('   Required action: python ai_image_generator_v2.py --top3-only')
    } else if (hasImages < 3) {
      console.log(`⚠️  PARTIAL: Only ${hasImages}/3 images present`)
    } else {
      console.log('✅ PASS: All Top-3 have AI images')
    }
  }
} catch (error) {
  console.error('❌ Error:', error.message)
}

console.log('\n========================================')
console.log('SUMMARY')
console.log('========================================\n')

console.log('✅ Growth Rate: Check labels above (should be formatted, not raw numbers)')
console.log('⚠️  Views Separation: Known limitation (combined metric)')
console.log('⏸️  AI Images: Blocked on content generation\n')

console.log('Next Steps:')
console.log('1. Restart dev server if not running: cd frontend && npm run dev')
console.log('2. Open Story Details modal for Top-3 story')
console.log('3. Verify Growth Rate shows "Viral (>1M/day)" or similar')
console.log('4. Generate AI images: python ai_image_generator_v2.py --top3-only\n')

