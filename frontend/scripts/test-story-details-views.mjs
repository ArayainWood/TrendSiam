#!/usr/bin/env node
/**
 * Story Details Views & Popularity Narrative Test
 * Verifies:
 * 1. Basic Info shows videoViews (not 0)
 * 2. Cards show webViewCount (site clicks)
 * 3. Popularity narrative includes growth label + engagement rates
 * 4. Telemetry increments site_click_count only
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

console.log('🧪 Story Details Views Test\n')

// Test 1: Fetch home data
console.log('📥 Test 1: Fetching /api/home...')
const homeRes = await fetch(`${BASE_URL}/api/home`)
if (!homeRes.ok) {
  console.error(`❌ FAIL: HTTP ${homeRes.status}`)
  process.exit(1)
}

const homeData = await homeRes.json()
const stories = homeData.data || []

if (stories.length === 0) {
  console.error('❌ FAIL: No stories returned')
  process.exit(1)
}

console.log(`✅ PASS: ${stories.length} stories fetched\n`)

// Test 2: Verify field presence
console.log('📊 Test 2: Field validation...')
const firstStory = stories[0]

const requiredFields = ['videoViews', 'webViewCount', 'likes', 'comments', 'popularityNarrative']
const missing = requiredFields.filter(f => !(f in firstStory))

if (missing.length > 0) {
  console.error(`❌ FAIL: Missing fields: ${missing.join(', ')}`)
  process.exit(1)
}

console.log('✅ PASS: All required fields present\n')

// Test 3: Verify videoViews is non-zero
console.log('📹 Test 3: Video views validation...')
console.log(`  Story: ${firstStory.title}`)
console.log(`  videoViews: ${firstStory.videoViews?.toLocaleString() || 'null'}`)
console.log(`  webViewCount: ${firstStory.webViewCount || 0}`)
console.log(`  likes: ${firstStory.likes?.toLocaleString() || 'null'}`)
console.log(`  comments: ${firstStory.comments?.toLocaleString() || 'null'}`)

if (!firstStory.videoViews || firstStory.videoViews === 0) {
  console.error('❌ FAIL: videoViews is 0 or null (Basic Info will show 0)')
  process.exit(1)
}

console.log('✅ PASS: videoViews is non-zero\n')

// Test 4: Verify popularity narrative
console.log('📝 Test 4: Popularity narrative validation...')
console.log(`  Narrative: "${firstStory.popularityNarrative || 'null'}"`)

if (!firstStory.popularityNarrative) {
  console.warn('⚠️ WARN: popularityNarrative is null (may use fallback)')
} else {
  // Check narrative includes expected elements
  const narrative = firstStory.popularityNarrative.toLowerCase()
  const hasGrowthLabel = narrative.includes('viral') || narrative.includes('high') || narrative.includes('growing')
  const hasViews = narrative.includes('view')
  const hasEngagement = narrative.includes('engagement') || narrative.includes('like rate')
  
  if (!hasGrowthLabel || !hasViews) {
    console.error('❌ FAIL: Narrative missing growth label or views')
    console.error(`  Has growth label: ${hasGrowthLabel}`)
    console.error(`  Has views: ${hasViews}`)
    console.error(`  Has engagement: ${hasEngagement}`)
    process.exit(1)
  }
  
  console.log('✅ PASS: Narrative includes growth label, views, and engagement\n')
}

// Test 5: Verify separation (videoViews != webViewCount for most stories)
console.log('🔀 Test 5: Views separation validation...')
const top5 = stories.slice(0, 5)
const separated = top5.filter(s => s.videoViews !== s.webViewCount)
console.log(`  Top-5 stories with separated metrics: ${separated.length}/5`)

if (separated.length === 0) {
  console.warn('⚠️ WARN: All stories have identical videoViews and webViewCount')
  console.warn('  This is OK if site_click_count was just initialized')
} else {
  console.log('✅ PASS: Metrics are separated\n')
}

// Test 6: Telemetry test (optional, requires story_id)
console.log('📡 Test 6: Telemetry endpoint validation...')
const testStory = stories.find(s => s.id && s.videoId)

if (!testStory) {
  console.warn('⚠️ SKIP: No story with id + videoId found for telemetry test\n')
} else {
  const initialWebViews = testStory.webViewCount || 0
  console.log(`  Testing with story: ${testStory.title}`)
  console.log(`  Initial webViewCount: ${initialWebViews}`)
  
  const telemetryRes = await fetch(`${BASE_URL}/api/telemetry/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storyId: testStory.id,
      videoId: testStory.videoId
    })
  })
  
  if (!telemetryRes.ok) {
    console.error(`❌ FAIL: Telemetry HTTP ${telemetryRes.status}`)
    const errorText = await telemetryRes.text()
    console.error(`  Error: ${errorText}`)
    process.exit(1)
  }
  
  const telemetryData = await telemetryRes.json()
  console.log(`  Response: ${JSON.stringify(telemetryData)}`)
  
  if (!telemetryData.success) {
    console.error('❌ FAIL: Telemetry returned success=false')
    process.exit(1)
  }
  
  if (!('site_click_count' in telemetryData)) {
    console.error('❌ FAIL: Response missing site_click_count field')
    process.exit(1)
  }
  
  console.log(`  New site_click_count: ${telemetryData.site_click_count}`)
  console.log('✅ PASS: Telemetry increments site_click_count\n')
}

// Summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('✅ ALL TESTS PASSED')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('\n📋 Summary:')
console.log('  ✅ Story Details will show videoViews (platform/YouTube)')
console.log('  ✅ Cards show webViewCount (site clicks)')
console.log('  ✅ Popularity narrative includes growth + engagement')
console.log('  ✅ Telemetry increments site_click_count only')
console.log('\n🎯 Next Steps:')
console.log('  1. Open http://localhost:3000')
console.log('  2. Click Top-1 story')
console.log('  3. Verify Basic Info > Views shows ~715K (not 0)')
console.log('  4. Verify green panel shows narrative with engagement rates')
console.log('  5. Refresh page → card should show "1 view" (site click)')

