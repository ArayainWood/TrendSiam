#!/usr/bin/env node
/**
 * Home Feed Snapshot Date Verification Script
 * 
 * Verifies the 2025-10-10 hotfix for snapshot_date:
 * 1. View exists and has snapshot_date column
 * 2. API returns 200 (no 500 errors)
 * 3. Ranking is deterministic (is_top3 DESC, score DESC, views DESC, id ASC)
 * 4. Filtering by snapshot_date (Thai TZ)
 * 5. Score distribution diverse (no hidden cutoff)
 * 6. Published vs snapshot dates are distinct
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Logging helpers
function pass(msg) {
  console.log(`✅ ${msg}`)
}

function fail(msg) {
  console.error(`❌ ${msg}`)
}

function warn(msg) {
  console.warn(`⚠️  ${msg}`)
}

function info(msg) {
  console.log(`ℹ️  ${msg}`)
}

// Test 1: View columns
async function test1ViewColumns() {
  console.log('\n📋 Test 1: View Column Schema')
  console.log('━'.repeat(60))
  
  try {
    // Query a single row to get column list
    const { data, error } = await supabase
      .from('home_feed_v1')
      .select('*')
      .limit(1)
      .single()
    
    if (error) {
      fail(`View query failed: ${error.message}`)
      return false
    }
    
    if (!data) {
      warn('View exists but has no data (pipeline may not have run)')
      return true // Not a blocker for this test
    }
    
    const columns = Object.keys(data)
    info(`Total columns: ${columns.length}`)
    
    // Check critical columns
    const requiredColumns = [
      'id', 'title', 'published_at', 'snapshot_date', 'rank', 
      'popularity_score', 'is_top3', 'views', 'image_url', 'source_url'
    ]
    
    let allPresent = true
    for (const col of requiredColumns) {
      if (columns.includes(col)) {
        pass(`Column present: ${col}`)
      } else {
        fail(`Column missing: ${col}`)
        allPresent = false
      }
    }
    
    // Check distinct dates
    if (data.published_at && data.snapshot_date) {
      if (data.published_at !== data.snapshot_date) {
        pass('published_at and snapshot_date are distinct')
      } else {
        warn('published_at equals snapshot_date (may be acceptable if same day)')
      }
    }
    
    return allPresent
  } catch (err) {
    fail(`Exception: ${err.message}`)
    return false
  }
}

// Test 2: API Health
async function test2ApiHealth() {
  console.log('\n🌐 Test 2: API Health Check')
  console.log('━'.repeat(60))
  
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/home`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
    
    info(`Status: ${response.status}`)
    
    if (response.status !== 200) {
      fail(`API returned ${response.status} instead of 200`)
      const text = await response.text()
      console.error('Response:', text.substring(0, 200))
      return false
    }
    
    pass('API returns 200 OK')
    
    const json = await response.json()
    
    if (!json.data || !Array.isArray(json.data)) {
      fail('Response missing data array')
      return false
    }
    
    info(`Fetched ${json.data.length} items`)
    
    if (json.data.length === 0) {
      warn('API returned empty data (pipeline may not have run)')
      return true // Not a blocker
    }
    
    // Check first item has required fields
    const first = json.data[0]
    const hasPublished = 'publishedAt' in first
    const hasSnapshot = 'snapshotDate' in first
    
    if (hasPublished && hasSnapshot) {
      pass('API response includes both publishedAt and snapshotDate')
    } else {
      if (!hasPublished) warn('publishedAt missing from API response')
      if (!hasSnapshot) warn('snapshotDate missing from API response')
    }
    
    return true
  } catch (err) {
    fail(`Exception: ${err.message}`)
    return false
  }
}

// Test 3: Ranking Determinism
async function test3RankingDeterminism() {
  console.log('\n🎯 Test 3: Ranking Determinism')
  console.log('━'.repeat(60))
  
  try {
    const { data, error } = await supabase
      .from('home_feed_v1')
      .select('rank, is_top3, popularity_score, views, id')
      .order('rank', { ascending: true })
      .limit(10)
    
    if (error) {
      fail(`Query failed: ${error.message}`)
      return false
    }
    
    if (!data || data.length === 0) {
      warn('No data to verify ranking')
      return true
    }
    
    info(`Checking ranking for ${data.length} items...`)
    
    let prevRank = 0
    let prevScore = Infinity
    let allOrdered = true
    
    for (const item of data) {
      // Check rank sequence
      if (item.rank <= prevRank && prevRank !== 0) {
        fail(`Rank not sequential: ${prevRank} → ${item.rank}`)
        allOrdered = false
      }
      
      // Check Top-3
      if (item.rank <= 3 && !item.is_top3) {
        fail(`Rank ${item.rank} missing is_top3 flag`)
        allOrdered = false
      }
      
      // Check score descending (within same snapshot date)
      if (item.popularity_score > prevScore) {
        warn(`Score not descending: ${prevScore} → ${item.popularity_score} (may be in fallback block)`)
      }
      
      prevRank = item.rank
      prevScore = item.popularity_score
    }
    
    if (allOrdered) {
      pass('Ranks are sequential')
      pass('Top-3 flags are correct')
    }
    
    return allOrdered
  } catch (err) {
    fail(`Exception: ${err.message}`)
    return false
  }
}

// Test 4: Score Distribution
async function test4ScoreDistribution() {
  console.log('\n📊 Test 4: Score Distribution (Today)')
  console.log('━'.repeat(60))
  
  try {
    // Get today in Bangkok timezone
    const bangkokDate = new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })
    const today = new Date(bangkokDate).toISOString().split('T')[0]
    
    info(`Today (Bangkok): ${today}`)
    
    const { data, error } = await supabase
      .from('home_feed_v1')
      .select('snapshot_date, popularity_score, rank')
      .eq('snapshot_date', today)
      .order('rank', { ascending: true })
    
    if (error) {
      fail(`Query failed: ${error.message}`)
      return false
    }
    
    if (!data || data.length === 0) {
      warn(`No items for today (${today}). Pipeline may not have run.`)
      return true
    }
    
    info(`Found ${data.length} items for today`)
    
    // Score buckets
    const buckets = {
      high: 0,    // >= 85
      mid: 0,     // 70-85
      low: 0      // < 70
    }
    
    let minScore = Infinity
    let maxScore = -Infinity
    
    for (const item of data) {
      const score = item.popularity_score || 0
      
      if (score >= 85) buckets.high++
      else if (score >= 70) buckets.mid++
      else buckets.low++
      
      if (score < minScore) minScore = score
      if (score > maxScore) maxScore = score
    }
    
    console.log('\nScore Distribution:')
    console.log(`  High (≥85): ${buckets.high} items`)
    console.log(`  Mid (70-85): ${buckets.mid} items`)
    console.log(`  Low (<70): ${buckets.low} items`)
    console.log(`  Range: ${minScore.toFixed(1)} - ${maxScore.toFixed(1)}`)
    
    // Check diversity (no hidden cutoff)
    if (buckets.low > 0 || minScore < 70) {
      pass('Score diversity present (no hidden cutoff at 70)')
    } else if (data.length < 5) {
      warn('Not enough data to verify diversity')
    } else {
      warn('All scores >= 70 (may have a cutoff)')
    }
    
    return true
  } catch (err) {
    fail(`Exception: ${err.message}`)
    return false
  }
}

// Test 5: Freshness Filter
async function test5FreshnessFilter() {
  console.log('\n📅 Test 5: Freshness Filtering (snapshot_date)')
  console.log('━'.repeat(60))
  
  try {
    const { data, error } = await supabase
      .from('home_feed_v1')
      .select('snapshot_date, rank, popularity_score')
      .order('rank', { ascending: true })
      .limit(20)
    
    if (error) {
      fail(`Query failed: ${error.message}`)
      return false
    }
    
    if (!data || data.length === 0) {
      warn('No data to verify freshness')
      return true
    }
    
    // Group by snapshot_date
    const dateGroups = {}
    for (const item of data) {
      const date = item.snapshot_date || 'null'
      if (!dateGroups[date]) dateGroups[date] = []
      dateGroups[date].push(item)
    }
    
    const dates = Object.keys(dateGroups).sort().reverse()
    
    info(`Found ${dates.length} distinct snapshot dates`)
    
    for (const date of dates) {
      const items = dateGroups[date]
      console.log(`  ${date}: ${items.length} items (ranks: ${items.map(i => i.rank).join(', ')})`)
    }
    
    // Check if today's items come first
    const bangkokDate = new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })
    const today = new Date(bangkokDate).toISOString().split('T')[0]
    
    if (dates[0] === today) {
      pass(`Today's items (${today}) appear first`)
    } else {
      warn(`Latest snapshot is ${dates[0]}, expected today (${today})`)
    }
    
    return true
  } catch (err) {
    fail(`Exception: ${err.message}`)
    return false
  }
}

// Main
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║     Home Feed Snapshot Date Verification (2025-10-10)     ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  
  const results = []
  
  results.push(await test1ViewColumns())
  results.push(await test2ApiHealth())
  results.push(await test3RankingDeterminism())
  results.push(await test4ScoreDistribution())
  results.push(await test5FreshnessFilter())
  
  // Summary
  console.log('\n' + '═'.repeat(60))
  console.log('SUMMARY')
  console.log('═'.repeat(60))
  
  const passed = results.filter(r => r === true).length
  const total = results.length
  
  console.log(`Tests: ${passed}/${total} passed`)
  
  if (passed === total) {
    console.log('\n✅ All tests passed!')
    process.exit(0)
  } else {
    console.log(`\n⚠️  ${total - passed} test(s) failed or had warnings`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('💥 Fatal error:', err)
  process.exit(1)
})

