#!/usr/bin/env node
/**
 * Test Home API Endpoint
 * Tests the /api/home endpoint to see what data it's actually returning
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')

dotenv.config({ path: envPath })

const FRONTEND_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

console.log('🧪 Testing Home API Endpoint')
console.log('=' .repeat(60))
console.log(`Frontend URL: ${FRONTEND_URL}`)
console.log('')

async function testHomeAPI() {
  try {
    console.log(`📡 Fetching: ${FRONTEND_URL}/api/home`)
    console.log('Adding cache-busting query param...')
    
    const url = `${FRONTEND_URL}/api/home?_t=${Date.now()}`
    const response = await fetch(url, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    })
    
    console.log(`Status: ${response.status} ${response.statusText}`)
    console.log('')
    
    if (!response.ok) {
      const text = await response.text()
      console.error('❌ API Error:', text)
      process.exit(1)
    }
    
    const data = await response.json()
    
    console.log('✅ API Response:')
    console.log(`  success: ${data.success}`)
    console.log(`  fetchedCount: ${data.fetchedCount}`)
    console.log(`  top3Ids: ${JSON.stringify(data.top3Ids || [])}`)
    console.log('')
    
    if (data.meta) {
      console.log('📊 Metadata:')
      console.log(`  updatedAt: ${data.meta.updatedAt}`)
      if (data.meta.schemaGuard) {
        console.log(`  schemaGuard.hasWebViewCount: ${data.meta.schemaGuard.hasWebViewCount}`)
        console.log(`  schemaGuard.usingFallback: ${data.meta.schemaGuard.usingFallback}`)
      }
      console.log('')
    }
    
    if (data.data && Array.isArray(data.data)) {
      console.log(`📰 Top 5 Stories:`)
      data.data.slice(0, 5).forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.title?.substring(0, 50) || 'Untitled'}...`)
        console.log(`     rank: ${item.rank}, score: ${item.popularityScore}, isTop3: ${item.isTop3}`)
        console.log(`     videoViews: ${item.videoViews}, webViewCount: ${item.webViewCount}`)
        console.log(`     snapshotDate: ${item.snapshotDate || 'N/A'}`)
        console.log('')
      })
    }
    
    if (data.error) {
      console.error('⚠️ Error in response:', data.error)
    }
    
    // Check for stale data
    if (data.data && data.data.length > 0) {
      const firstItem = data.data[0]
      const snapshotDate = firstItem.snapshotDate
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
      
      console.log('🔍 Freshness Check:')
      console.log(`  First item snapshot_date: ${snapshotDate}`)
      console.log(`  Today (local): ${today}`)
      console.log(`  Data is fresh: ${snapshotDate === today ? '✅ YES' : '❌ NO (STALE!)'}`)
    }
    
    process.exit(0)
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

testHomeAPI()

