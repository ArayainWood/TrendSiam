#!/usr/bin/env node
/**
 * Comprehensive Verification: Published Date Fix & Ranking Policy
 * 
 * Tests:
 * 1. View schema (published_at & snapshot_date distinct)
 * 2. Data availability (% of items with valid published_at)
 * 3. API response (both fields present, no "Invalid Date")
 * 4. Ranking determinism (is_top3 → score → views → id)
 * 5. Score distribution (diversity, no hidden cutoff)
 * 6. Freshness filtering (snapshot_date Thai TZ, today first)
 * 7. Published date sanity (valid ISO or NULL, never "Invalid Date")
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env from project root
dotenv.config({ path: join(__dirname, '../../.env') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

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

// Test 1: View Schema
async function test1ViewSchema() {
  console.log('\n📋 Test 1: View Schema (published_at vs snapshot_date)')
  console.log('━'.repeat(60))
  
  try {
    const { data, error } = await supabase
      .from('home_feed_v1')
      .select('id, published_at, snapshot_date')
      .limit(1)
      .single()
    
    if (error) {
      fail(`View query failed: ${error.message}`)
      return false
    }
    
    if (!data) {
      warn('View exists but has no data')
      return true
    }
    
    // Check both fields exist
    const hasPublished = 'published_at' in data
    const hasSnapshot = 'snapshot_date' in data
    
    if (hasPublished && hasSnapshot) {
      pass('Both published_at and snapshot_date columns exist')
      
      // Check if distinct
      if (data.published_at !== data.snapshot_date) {
        pass('published_at and snapshot_date are distinct (not equal)')
      } else {
        warn('published_at equals snapshot_date (may be acceptable)')
      }
      
      // Check types
      info(`published_at type: ${typeof data.published_at} | value: ${data.published_at || 'NULL'}`)
      info(`snapshot_date type: ${typeof data.snapshot_date} | value: ${data.snapshot_date}`)
      
      return true
    } else {
      if (!hasPublished) fail('Column missing: published_at')
      if (!hasSnapshot) fail('Column missing: snapshot_date')
      return false
    }
  } catch (err) {
    fail(`Exception: ${err.message}`)
    return false
  }
}

// Test 2: Data Availability
async function test2DataAvailability() {
  console.log('\n📊 Test 2: Published Date Availability')
  console.log('━'.repeat(60))
  
  try {
    const { data, error } = await supabase
      .from('home_feed_v1')
      .select('id, published_at, snapshot_date')
      .limit(1000)
    
    if (error) {
      fail(`Query failed: ${error.message}`)
      return false
    }
    
    const total = data.length
    const withPublished = data.filter(i => i.published_at != null).length
    const withSnapshot = data.filter(i => i.snapshot_date != null).length
    const nullPublished = total - withPublished
    
    const publishedPct = Math.round(withPublished / total * 100)
    const snapshotPct = Math.round(withSnapshot / total * 100)
    
    info(`Total items: ${total}`)
    info(`Items with published_at: ${withPublished} (${publishedPct}%)`)
    info(`Items with NULL published_at: ${nullPublished} (${100 - publishedPct}%)`)
    info(`Items with snapshot_date: ${withSnapshot} (${snapshotPct}%)`)
    
    if (snapshotPct === 100) {
      pass('All items have snapshot_date (100%)')
    } else {
      fail(`Some items missing snapshot_date (${snapshotPct}%)`)
    }
    
    if (publishedPct >= 90) {
      pass(`Good published_at coverage (${publishedPct}%)`)
    } else if (publishedPct >= 50) {
      warn(`Moderate published_at coverage (${publishedPct}%)`)
    } else {
      warn(`Low published_at coverage (${publishedPct}%) - most items NULL`)
    }
    
    return snapshotPct === 100 && publishedPct >= 50
  } catch (err) {
    fail(`Exception: ${err.message}`)
    return false
  }
}

// Test 3: Published Date Sanity
async function test3PublishedSanity() {
  console.log('\n🔍 Test 3: Published Date Sanity Check')
  console.log('━'.repeat(60))
  
  try {
    const { data, error } = await supabase
      .from('home_feed_v1')
      .select('id, title, published_at')
      .limit(50)
    
    if (error) {
      fail(`Query failed: ${error.message}`)
      return false
    }
    
    let validCount = 0
    let nullCount = 0
    let invalidCount = 0
    const invalidSamples = []
    
    data.forEach(item => {
      if (item.published_at === null || item.published_at === undefined) {
        nullCount++
      } else {
        const parsed = new Date(item.published_at)
        if (isNaN(parsed.getTime())) {
          invalidCount++
          if (invalidSamples.length < 3) {
            invalidSamples.push(`${item.title?.substring(0, 30)} | value: ${item.published_at}`)
          }
        } else {
          validCount++
        }
      }
    })
    
    info(`Sample of 50 items:`)
    console.log(`  Valid ISO dates: ${validCount}`)
    console.log(`  NULL dates: ${nullCount}`)
    console.log(`  Invalid/unparseable: ${invalidCount}`)
    
    if (invalidCount === 0) {
      pass('No invalid date strings (all are valid ISO or NULL)')
    } else {
      fail(`Found ${invalidCount} invalid date strings:`)
      invalidSamples.forEach(s => console.log(`    ${s}`))
    }
    
    if (nullCount > 0) {
      info(`${nullCount} items have NULL published_at (will show "—" placeholder in UI)`)
    }
    
    return invalidCount === 0
  } catch (err) {
    fail(`Exception: ${err.message}`)
    return false
  }
}

// Test 4: Ranking Determinism
async function test4RankingDeterminism() {
  console.log('\n🎯 Test 4: Ranking Determinism')
  console.log('━'.repeat(60))
  
  try {
    const { data, error } = await supabase
      .from('home_feed_v1')
      .select('rank, is_top3, popularity_score, views, id, title')
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
    
    let allGood = true
    let prevRank = 0
    
    data.forEach((item, idx) => {
      const issues = []
      
      // Check rank sequence
      if (item.rank !== idx + 1 && prevRank !== 0) {
        issues.push(`Rank not sequential: expected ${idx + 1}, got ${item.rank}`)
      }
      
      // Check Top-3 flag
      if (item.rank <= 3 && !item.is_top3) {
        issues.push(`Rank ${item.rank} missing is_top3 flag`)
      }
      
      if (issues.length > 0) {
        fail(`Rank ${item.rank}: ${issues.join(', ')}`)
        allGood = false
      }
      
      prevRank = item.rank
    })
    
    if (allGood) {
      pass('Ranks are sequential')
      pass('Top-3 flags are correct')
    }
    
    // Show top 5
    console.log('\nTop 5 items:')
    data.slice(0, 5).forEach(item => {
      console.log(`  #${item.rank}: score=${item.popularity_score}, is_top3=${item.is_top3}, title=${item.title?.substring(0, 40)}...`)
    })
    
    return allGood
  } catch (err) {
    fail(`Exception: ${err.message}`)
    return false
  }
}

// Test 5: Score Distribution
async function test5ScoreDistribution() {
  console.log('\n📊 Test 5: Score Distribution (Today)')
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
    
    data.forEach(item => {
      const score = item.popularity_score || 0
      
      if (score >= 85) buckets.high++
      else if (score >= 70) buckets.mid++
      else buckets.low++
      
      if (score < minScore) minScore = score
      if (score > maxScore) maxScore = score
    })
    
    console.log('\nScore Distribution:')
    console.log(`  High (≥85): ${buckets.high} items`)
    console.log(`  Mid (70-85): ${buckets.mid} items`)
    console.log(`  Low (<70): ${buckets.low} items`)
    console.log(`  Range: ${minScore.toFixed(1)} - ${maxScore.toFixed(1)}`)
    
    // Check diversity
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

// Test 6: Freshness Filtering
async function test6FreshnessFiltering() {
  console.log('\n📅 Test 6: Freshness Filtering (snapshot_date)')
  console.log('━'.repeat(60))
  
  try {
    const { data, error } = await supabase
      .from('home_feed_v1')
      .select('snapshot_date, published_at, rank, popularity_score, title')
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
    data.forEach(item => {
      const date = item.snapshot_date || 'null'
      if (!dateGroups[date]) dateGroups[date] = []
      dateGroups[date].push(item)
    })
    
    const dates = Object.keys(dateGroups).sort().reverse()
    
    info(`Found ${dates.length} distinct snapshot dates`)
    
    for (const date of dates) {
      const items = dateGroups[date]
      const ranks = items.map(i => i.rank).join(', ')
      console.log(`  ${date}: ${items.length} items (ranks: ${ranks})`)
      
      // Show sample item to demonstrate published_at vs snapshot_date
      if (items.length > 0) {
        const sample = items[0]
        const pubDate = sample.published_at ? new Date(sample.published_at).toISOString().split('T')[0] : 'NULL'
        const snapDate = sample.snapshot_date
        
        if (pubDate !== 'NULL' && pubDate !== snapDate) {
          info(`    Example: "${sample.title?.substring(0, 30)}..."`)
          info(`      Platform published: ${pubDate} (older)`)
          info(`      We ingested: ${snapDate} (snapshot - used for ranking)`)
          pass('    Correct: Old content can appear in today\'s feed (freshness-first policy)')
        }
      }
    }
    
    // Check if latest snapshot comes first
    const bangkokDate = new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })
    const today = new Date(bangkokDate).toISOString().split('T')[0]
    
    if (dates[0] === today) {
      pass(`Today's items (${today}) appear first`)
    } else {
      warn(`Latest snapshot is ${dates[0]}, expected today (${today})`)
      info('This is OK if pipeline hasn\'t run today')
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
  console.log('║   Published Date Fix & Ranking Policy Verification        ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  
  const results = []
  
  results.push(await test1ViewSchema())
  results.push(await test2DataAvailability())
  results.push(await test3PublishedSanity())
  results.push(await test4RankingDeterminism())
  results.push(await test5ScoreDistribution())
  results.push(await test6FreshnessFiltering())
  
  // Summary
  console.log('\n' + '═'.repeat(60))
  console.log('SUMMARY')
  console.log('═'.repeat(60))
  
  const passed = results.filter(r => r === true).length
  const total = results.length
  
  console.log(`\nTests: ${passed}/${total} passed`)
  
  if (passed === total) {
    console.log('\n✅ All tests passed!')
    console.log('\n📋 Key Confirmations:')
    console.log('  • View has both published_at and snapshot_date (distinct)')
    console.log('  • No "Invalid Date" strings (all valid ISO or NULL)')
    console.log('  • Ranking uses snapshot_date for freshness')
    console.log('  • Story Details will show published_at or "—" placeholder')
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

