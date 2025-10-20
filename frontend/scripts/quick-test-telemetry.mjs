#!/usr/bin/env node
/**
 * Quick Telemetry Test
 * Tests if web views tracking works end-to-end
 */

const BASE_URL = 'http://localhost:3000'

async function test() {
  console.log('🧪 Quick Telemetry Test\n')
  
  // 1. Get a story from home API
  console.log('1️⃣ Fetching story from /api/home...')
  const homeRes = await fetch(`${BASE_URL}/api/home`)
  const homeJson = await homeRes.json()
  
  if (!homeJson.success || !homeJson.data || homeJson.data.length === 0) {
    console.error('❌ No stories found')
    process.exit(1)
  }
  
  const story = homeJson.data[0]
  console.log(`   ✅ Found story: "${story.title?.substring(0, 50)}..."`)
  console.log(`   📊 Current webViewCount: ${story.webViewCount ?? 'undefined'}`)
  console.log(`   🆔 ID: ${story.id}`)
  console.log(`   🎬 VideoID: ${story.videoId || 'none'}`)
  console.log('')
  
  // 2. Try incrementing
  console.log('2️⃣ Calling POST /api/telemetry/view...')
  const telemetryRes = await fetch(`${BASE_URL}/api/telemetry/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      story_id: story.id,
      video_id: story.videoId || story.externalId || story.id
    })
  })
  
  console.log(`   Status: ${telemetryRes.status}`)
  const telemetryJson = await telemetryRes.json()
  console.log(`   Response:`, telemetryJson)
  
  if (telemetryRes.status === 200 && telemetryJson.success) {
    console.log(`   ✅ SUCCESS: View incremented to ${telemetryJson.views}`)
  } else if (telemetryRes.status === 429) {
    console.log(`   ⚠️  Rate limited (this is OK - means it's working)`)
  } else {
    console.error(`   ❌ FAILED: ${telemetryJson.error}`)
    process.exit(1)
  }
  
  console.log('\n🎉 Test passed!')
}

test().catch(err => {
  console.error('\n💥 Test failed:', err.message)
  process.exit(1)
})
