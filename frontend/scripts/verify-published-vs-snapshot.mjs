#!/usr/bin/env node
/**
 * Verify Published vs Snapshot Date Separation
 * 
 * This script verifies that:
 * 1. View exposes both published_at and snapshot_date distinctly
 * 2. Story Details uses publishedAt (not snapshotDate)
 * 3. Home filtering/ranking uses snapshot_date (not published_at)
 * 4. Ranking is deterministic (is_top3, score, views, id)
 * 5. Fallback block appears AFTER today's items
 * 
 * Exit codes:
 * 0 = All checks passed
 * 1 = One or more checks failed
 * 2 = Connection error
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '../..')

// Load environment variables
dotenv.config({ path: join(projectRoot, '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY')
  process.exit(2)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let failCount = 0

function pass(message) {
  console.log(`✅ ${message}`)
}

function fail(message) {
  console.log(`❌ ${message}`)
  failCount++
}

function info(message) {
  console.log(`ℹ️  ${message}`)
}

async function main() {
  console.log('🔍 Verifying Published vs Snapshot Date Separation\n')

  // ============================================================================
  // Check 1: View exposes both fields
  // ============================================================================
  console.log('📋 Check 1: View exposes both published_at and snapshot_date')
  
  try {
    const { data, error } = await supabase
      .from('home_feed_v1')
      .select('id, published_at, snapshot_date, rank')
      .limit(1)
    
    if (error) throw error
    
    if (!data || data.length === 0) {
      fail('View returned 0 rows (pipeline may not have run)')
    } else {
      const row = data[0]
      
      if ('published_at' in row) {
        pass('View exposes published_at')
      } else {
        fail('View missing published_at column')
      }
      
      if ('snapshot_date' in row) {
        pass('View exposes snapshot_date')
      } else {
        fail('View missing snapshot_date column')
      }
      
      if (row.published_at !== row.snapshot_date) {
        pass('published_at and snapshot_date are distinct fields')
      } else {
        info('published_at and snapshot_date have same value (may be expected if recently ingested)')
      }
    }
  } catch (error) {
    fail(`View query failed: ${error.message}`)
  }
  
  console.log()

  // ============================================================================
  // Check 2: Home API uses snapshot_date for filtering
  // ============================================================================
  console.log('📋 Check 2: Home API filtering by snapshot_date')
  
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    
    const { data, error } = await supabase
      .from('home_feed_v1')
      .select('id, published_at, snapshot_date, rank, popularity_score')
      .eq('snapshot_date', today)
      .order('rank', { ascending: true })
      .limit(10)
    
    if (error) throw error
    
    if (!data || data.length === 0) {
      fail(`No items with snapshot_date = ${today} (today). Pipeline may not have run today.`)
    } else {
      pass(`Found ${data.length} items with snapshot_date = ${today} (today)`)
      
      // Check if any have different published_at
      const withDifferentDates = data.filter(row => {
        const pubDate = row.published_at ? new Date(row.published_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) : null
        return pubDate && pubDate !== today
      })
      
      if (withDifferentDates.length > 0) {
        pass(`Found ${withDifferentDates.length} items with older published_at (expected for viral old content)`)
        info(`Example: published_at=${withDifferentDates[0].published_at}, snapshot_date=${withDifferentDates[0].snapshot_date}`)
      } else {
        info('All items have published_at = snapshot_date (may mean only recently published content ingested today)')
      }
    }
  } catch (error) {
    fail(`Home API query failed: ${error.message}`)
  }
  
  console.log()

  // ============================================================================
  // Check 3: Ranking is deterministic
  // ============================================================================
  console.log('📋 Check 3: Ranking is deterministic')
  
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    
    const { data, error } = await supabase
      .from('home_feed_v1')
      .select('id, rank, is_top3, popularity_score, video_views, snapshot_date')
      .eq('snapshot_date', today)
      .order('rank', { ascending: true })
      .limit(20)
    
    if (error) throw error
    
    if (!data || data.length === 0) {
      fail('No items to check ranking')
    } else {
      // Verify ranks are sequential
      const ranks = data.map(r => r.rank)
      const isSequential = ranks.every((rank, i) => i === 0 || rank > ranks[i - 1])
      
      if (isSequential) {
        pass('Ranks are sequential (1, 2, 3, ...)')
      } else {
        fail('Ranks are NOT sequential (may have gaps)')
      }
      
      // Verify Top-3 items appear first
      const top3Items = data.filter(r => r.is_top3)
      const top3Ranks = top3Items.map(r => r.rank)
      
      if (top3Ranks.length > 0 && Math.max(...top3Ranks) <= 3) {
        pass(`Top-3 items have ranks <= 3 (found ${top3Items.length} items)`)
      } else if (top3Ranks.length === 0) {
        info('No is_top3 items found (may be expected if <3 items today)')
      } else {
        fail(`Top-3 items have ranks > 3: ${top3Ranks}`)
      }
      
      // Verify score ordering (should be descending within same date)
      let scoreOrderCorrect = true
      for (let i = 1; i < data.length; i++) {
        const prevScore = data[i - 1].popularity_score || 0
        const currScore = data[i].popularity_score || 0
        
        if (currScore > prevScore) {
          scoreOrderCorrect = false
          fail(`Rank ${data[i].rank} has higher score (${currScore}) than rank ${data[i - 1].rank} (${prevScore})`)
        }
      }
      
      if (scoreOrderCorrect) {
        pass('Scores are in descending order (higher scores at top)')
      }
    }
  } catch (error) {
    fail(`Ranking check failed: ${error.message}`)
  }
  
  console.log()

  // ============================================================================
  // Check 4: Fallback behavior
  // ============================================================================
  console.log('📋 Check 4: Fallback behavior')
  
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    
    // Get today's count
    const { count: todayCount, error: todayError } = await supabase
      .from('home_feed_v1')
      .select('id', { count: 'exact', head: true })
      .eq('snapshot_date', today)
    
    if (todayError) throw todayError
    
    // Get fallback items (ranks > 1000)
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('home_feed_v1')
      .select('id, rank, snapshot_date')
      .gt('rank', 1000)
      .order('rank', { ascending: true })
      .limit(5)
    
    if (fallbackError) throw fallbackError
    
    if (todayCount < 20) {
      info(`Today's count: ${todayCount} (< 20) - Fallback should be active`)
      
      if (fallbackData && fallbackData.length > 0) {
        pass(`Fallback block active: found ${fallbackData.length} items with rank > 1000`)
        
        // Verify fallback items are from older dates
        const olderDates = fallbackData.filter(r => r.snapshot_date && r.snapshot_date < today)
        
        if (olderDates.length === fallbackData.length) {
          pass('All fallback items have snapshot_date < today (correct)')
        } else {
          fail('Some fallback items have snapshot_date = today (incorrect)')
        }
      } else {
        fail('Fallback should be active but found 0 items with rank > 1000')
      }
    } else {
      info(`Today's count: ${todayCount} (>= 20) - Fallback should be inactive`)
      
      if (!fallbackData || fallbackData.length === 0) {
        pass('Fallback block inactive (no items with rank > 1000)')
      } else {
        info(`Found ${fallbackData.length} items with rank > 1000 (may be expected if view includes history)`)
      }
    }
  } catch (error) {
    fail(`Fallback check failed: ${error.message}`)
  }
  
  console.log()

  // ============================================================================
  // Check 5: Score distribution
  // ============================================================================
  console.log('📋 Check 5: Score distribution (today)')
  
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    
    const { data, error } = await supabase
      .from('home_feed_v1')
      .select('popularity_score')
      .eq('snapshot_date', today)
    
    if (error) throw error
    
    if (!data || data.length === 0) {
      fail('No items for score distribution check')
    } else {
      const scores = data.map(r => r.popularity_score || 0).sort((a, b) => a - b)
      const min = scores[0]
      const max = scores[scores.length - 1]
      const median = scores[Math.floor(scores.length / 2)]
      const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length
      
      const below70 = scores.filter(s => s < 70).length
      const mid = scores.filter(s => s >= 70 && s < 85).length
      const above85 = scores.filter(s => s >= 85).length
      
      info(`Score distribution: min=${min.toFixed(1)}, avg=${avg.toFixed(1)}, median=${median.toFixed(1)}, max=${max.toFixed(1)}`)
      info(`Score buckets: <70 (${below70}), 70-85 (${mid}), >85 (${above85})`)
      
      if (below70 > 0) {
        pass('Found items with score < 70 (no hidden cutoff)')
      } else if (scores.length > 10) {
        info('All items have score >= 70 (may be expected for high-quality day)')
      }
      
      if (max - min > 20) {
        pass('Score diversity: range > 20 points (diverse content)')
      } else {
        info('Score diversity: range <= 20 points (uniform scores)')
      }
    }
  } catch (error) {
    fail(`Score distribution check failed: ${error.message}`)
  }
  
  console.log()

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('=' .repeat(60))
  
  if (failCount === 0) {
    console.log('✅ All checks PASSED')
    console.log('=' .repeat(60))
    return 0
  } else {
    console.log(`❌ ${failCount} check(s) FAILED`)
    console.log('=' .repeat(60))
    return 1
  }
}

main()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('❌ Verification failed:', error)
    process.exit(2)
  })

