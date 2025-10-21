#!/usr/bin/env node
/**
 * Quick Web Views Verification
 * Checks if web views tracking is working end-to-end
 * 
 * Usage: node scripts/quick-verify-web-views.mjs
 */

console.log('🔍 Quick Web Views Verification\n')

const BASE_URL = 'http://localhost:3000'

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function checkDevServer() {
  console.log('1️⃣ Checking dev server...')
  try {
    const response = await fetch(BASE_URL)
    if (response.ok) {
      console.log('   ✅ Dev server is running\n')
      return true
    } else {
      console.log('   ❌ Dev server returned', response.status)
      return false
    }
  } catch (err) {
    console.log('   ❌ Dev server not responding')
    console.log('   👉 Run: Set-Location frontend; npm run dev\n')
    return false
  }
}

async function checkHomeAPI() {
  console.log('2️⃣ Checking Home API...')
  try {
    const response = await fetch(`${BASE_URL}/api/home`)
    const json = await response.json()
    
    if (!json.success) {
      console.log('   ❌ Home API returned success=false')
      return null
    }
    
    if (!json.data || json.data.length === 0) {
      console.log('   ⚠️  Home API returned no stories (database may be empty)')
      return null
    }
    
    const firstStory = json.data[0]
    console.log(`   ✅ Home API working (${json.data.length} stories)`)
    console.log(`   📊 First story: "${firstStory.title?.substring(0, 40)}..."`)
    console.log(`   👁 Current webViewCount: ${firstStory.webViewCount ?? 'undefined'}`)
    
    // Check schema guard
    if (json.meta?.schemaGuard) {
      const { hasWebViewCount, usingFallback } = json.meta.schemaGuard
      console.log(`   🛡️  Schema Guard: hasColumn=${hasWebViewCount}, fallback=${usingFallback}`)
      
      if (!hasWebViewCount) {
        console.log('   ⚠️  WARNING: web_view_count column missing!')
      }
    }
    
    console.log('')
    return firstStory
  } catch (err) {
    console.log('   ❌ Error:', err.message)
    return null
  }
}

async function checkHealthEndpoint() {
  console.log('3️⃣ Checking Health Endpoint...')
  try {
    const response = await fetch(`${BASE_URL}/api/health-schema?check=home_view`)
    const json = await response.json()
    
    console.log(`   Status: ${json.ok ? '✅ Healthy' : '⚠️  Degraded'}`)
    console.log(`   View: ${json.viewName}`)
    console.log(`   Has web_view_count: ${json.columns?.hasWebViewCount ? 'Yes' : 'No'}`)
    console.log('')
    
    return json.ok
  } catch (err) {
    console.log('   ❌ Error:', err.message)
    return false
  }
}

async function testTelemetry(story) {
  if (!story) {
    console.log('4️⃣ Skipping telemetry test (no story available)\n')
    return false
  }
  
  console.log('4️⃣ Testing Telemetry Endpoint...')
  console.log(`   Story: ${story.title?.substring(0, 40)}...`)
  console.log(`   Current count: ${story.webViewCount ?? 0}`)
  
  try {
    const response = await fetch(`${BASE_URL}/api/telemetry/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_id: story.videoId || story.externalId,
        story_id: story.id
      })
    })
    
    const json = await response.json()
    
    if (!response.ok) {
      console.log(`   ❌ Failed: ${response.status} ${json.error}`)
      if (response.status === 429) {
        console.log('   ℹ️  Rate limited (100/hour) - this is expected behavior')
      }
      return false
    }
    
    if (!json.success) {
      console.log(`   ❌ Error: ${json.error}`)
      return false
    }
    
    console.log(`   ✅ Incremented: ${story.webViewCount ?? 0} → ${json.views}`)
    console.log('')
    
    // Wait a bit for DB to flush
    console.log('   ⏳ Waiting 2 seconds for database...')
    await sleep(2000)
    
    // Verify count increased
    console.log('5️⃣ Verifying count persisted...')
    const verifyResponse = await fetch(`${BASE_URL}/api/home`)
    const verifyJson = await verifyResponse.json()
    
    const updatedStory = verifyJson.data?.find((s) => s.id === story.id)
    
    if (!updatedStory) {
      console.log('   ❌ Story not found in response')
      return false
    }
    
    console.log(`   📊 New webViewCount: ${updatedStory.webViewCount}`)
    
    if (updatedStory.webViewCount > (story.webViewCount ?? 0)) {
      console.log('   ✅ Count increased! Tracking is working!')
      console.log('')
      return true
    } else {
      console.log('   ⚠️  Count did not increase')
      console.log('   Possible causes:')
      console.log('   - Database write failed')
      console.log('   - Home API not reading updated value')
      console.log('   - Schema guard using fallback')
      console.log('')
      return false
    }
  } catch (err) {
    console.log('   ❌ Error:', err.message)
    return false
  }
}

async function runVerification() {
  const serverOk = await checkDevServer()
  if (!serverOk) {
    console.log('❌ Cannot continue without dev server')
    process.exit(1)
  }
  
  const story = await checkHomeAPI()
  const healthOk = await checkHealthEndpoint()
  const telemetryOk = await testTelemetry(story)
  
  console.log('═══════════════════════════════════════')
  console.log('📊 Verification Summary')
  console.log('═══════════════════════════════════════')
  console.log(`${serverOk ? '✅' : '❌'} Dev Server`)
  console.log(`${story ? '✅' : '❌'} Home API`)
  console.log(`${healthOk ? '✅' : '❌'} Health Endpoint`)
  console.log(`${telemetryOk ? '✅' : '❌'} Telemetry & Persistence`)
  console.log('')
  
  if (serverOk && story && healthOk && telemetryOk) {
    console.log('🎉 All checks passed! Web views tracking is working!')
    console.log('')
    console.log('Next steps:')
    console.log('1. Open http://localhost:3000 in browser')
    console.log('2. Click any card in Latest Stories')
    console.log('3. Check console for: [card] ✅ View tracked on click')
    console.log('4. Refresh page')
    console.log('5. Verify count increased by 1')
    process.exit(0)
  } else {
    console.log('❌ Some checks failed. See above for details.')
    console.log('')
    console.log('Common fixes:')
    console.log('- Ensure .env.local has correct SUPABASE_* keys')
    console.log('- Check database has stories (run pipeline)')
    console.log('- Restart dev server if needed')
    process.exit(1)
  }
}

runVerification().catch(err => {
  console.error('\n💥 Verification crashed:', err.message)
  process.exit(1)
})
