#!/usr/bin/env node
/**
 * DATA FRESHNESS CHECK - Automated Home Feed Verification
 * Purpose: Verify data freshness, score distribution, and date diversity
 * Usage: node frontend/scripts/data-freshness-check.mjs
 * 
 * Checks:
 * 1. Total items for today (Thai TZ)
 * 2. Score distribution (min/median/max)
 * 3. Percentage with summaries TH/EN
 * 4. Percentage with growth labels
 * 5. Percentage with AI images (Top-3)
 * 6. Date diversity
 * 
 * Exit Codes:
 * 0 = All checks passed
 * 1 = Warning (some checks failed but not critical)
 * 2 = Error (critical checks failed)
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment (try both frontend and root)
config({ path: join(__dirname, '../.env.local') }) ||
config({ path: join(__dirname, '../../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(2)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatPercentage(value, total) {
  if (total === 0) return '0.00%'
  return `${((value / total) * 100).toFixed(2)}%`
}

function getScoreRangeLabel(score) {
  if (score === null || score === undefined) return 'NULL'
  if (score >= 95) return '95-100 (Top Tier)'
  if (score >= 85) return '85-94 (Excellent)'
  if (score >= 78) return '78-84 (Very Good)'
  if (score >= 70) return '70-77 (Good)'
  if (score >= 50) return '50-69 (Average)'
  if (score >= 30) return '30-49 (Below Average)'
  return '0-29 (Low)'
}

function percentile(arr, p) {
  if (arr.length === 0) return null
  const sorted = [...arr].sort((a, b) => a - b)
  const index = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index % 1
  if (lower === upper) return sorted[lower]
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

// ============================================================================
// MAIN CHECKS
// ============================================================================

async function runChecks() {
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║         TrendSiam Data Freshness Check v1.0                  ║')
  console.log('╚════════════════════════════════════════════════════════════════╝\n')

  const results = {
    passed: [],
    warnings: [],
    errors: []
  }

  try {
    // ========================================================================
    // CHECK 1: Fetch all items from home view
    // ========================================================================
    console.log('🔍 Fetching data from home_feed_v1...')
    const { data: items, error } = await supabase
      .from('home_feed_v1')
      .select('*')
      .order('rank', { ascending: true })

    if (error) {
      console.error('❌ Database query failed:', error.message)
      results.errors.push(`Database query failed: ${error.message}`)
      return results
    }

    if (!items || items.length === 0) {
      console.error('❌ No items returned from home_feed_v1')
      results.errors.push('No items in home_feed_v1 view')
      return results
    }

    console.log(`✅ Fetched ${items.length} items\n`)

    // ========================================================================
    // CHECK 2: Today's Items (Thai TZ)
    // ========================================================================
    console.log('📅 CHECK 1: Today\'s Items (Thai TZ)')
    console.log('─'.repeat(60))

    const now = new Date()
    const bangkokDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
    const todayStr = bangkokDate.toISOString().split('T')[0]

    console.log(`Current time (Bangkok): ${bangkokDate.toISOString()}`)
    console.log(`Today's date (Bangkok): ${todayStr}`)

    const todayItems = items.filter(item => {
      if (!item.published_at && !item.created_at) return false
      const itemDate = new Date(item.published_at || item.created_at)
      const itemBangkokDate = new Date(itemDate.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
      const itemDateStr = itemBangkokDate.toISOString().split('T')[0]
      return itemDateStr === todayStr
    })

    console.log(`Items from today: ${todayItems.length}/${items.length}`)

    if (todayItems.length >= 20) {
      console.log(`✅ PASS: ${todayItems.length} items from today (≥20 required)\n`)
      results.passed.push('Today\'s items check')
    } else if (todayItems.length > 0) {
      console.log(`⚠️  WARN: Only ${todayItems.length} items from today (<20)\n`)
      results.warnings.push(`Only ${todayItems.length} items from today`)
    } else {
      console.log(`❌ FAIL: 0 items from today - showing all-time items\n`)
      results.errors.push('No items from today (Thai TZ)')
    }

    // ========================================================================
    // CHECK 3: Score Distribution
    // ========================================================================
    console.log('📊 CHECK 2: Score Distribution')
    console.log('─'.repeat(60))

    const scores = items
      .map(item => item.popularity_score)
      .filter(score => score !== null && score !== undefined)

    if (scores.length === 0) {
      console.log('❌ FAIL: No items have popularity_score\n')
      results.errors.push('No popularity scores found')
    } else {
      const min = Math.min(...scores)
      const max = Math.max(...scores)
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length
      const median = percentile(scores, 50)
      const p25 = percentile(scores, 25)
      const p75 = percentile(scores, 75)

      console.log(`Total items with scores: ${scores.length}/${items.length}`)
      console.log(`Min score:    ${min.toFixed(2)}`)
      console.log(`P25 score:    ${p25.toFixed(2)}`)
      console.log(`Median score: ${median.toFixed(2)}`)
      console.log(`Average score: ${avg.toFixed(2)}`)
      console.log(`P75 score:    ${p75.toFixed(2)}`)
      console.log(`Max score:    ${max.toFixed(2)}`)

      // Score distribution by range
      const distribution = {}
      items.forEach(item => {
        const label = getScoreRangeLabel(item.popularity_score)
        distribution[label] = (distribution[label] || 0) + 1
      })

      console.log('\nScore Distribution:')
      const sortOrder = {
        '95-100 (Top Tier)': 1,
        '85-94 (Excellent)': 2,
        '78-84 (Very Good)': 3,
        '70-77 (Good)': 4,
        '50-69 (Average)': 5,
        '30-49 (Below Average)': 6,
        '0-29 (Low)': 7,
        'NULL': 8
      }
      Object.entries(distribution)
        .sort(([a], [b]) => (sortOrder[a] || 99) - (sortOrder[b] || 99))
        .forEach(([range, count]) => {
          const pct = formatPercentage(count, items.length)
          console.log(`  ${range.padEnd(25)} ${count.toString().padStart(4)} (${pct})`)
        })

      // Check for diversity
      const below70 = scores.filter(s => s < 70).length
      const above78 = scores.filter(s => s >= 78).length

      if (below70 > 0 && above78 > 0) {
        console.log(`✅ PASS: Score distribution is diverse (${below70} below 70, ${above78} above 78)\n`)
        results.passed.push('Score distribution diversity')
      } else if (above78 === scores.length) {
        console.log(`⚠️  WARN: All items have high scores (≥78) - possible filtering issue\n`)
        results.warnings.push('All items have high scores')
      } else {
        console.log(`✅ PASS: Score distribution exists\n`)
        results.passed.push('Score distribution')
      }
    }

    // ========================================================================
    // CHECK 4: Top 20 Items (What API Returns)
    // ========================================================================
    console.log('🏆 CHECK 3: Top 20 Items (API Response)')
    console.log('─'.repeat(60))

    const top20 = items.filter(item => item.rank && item.rank <= 20)

    if (top20.length === 0) {
      console.log('❌ FAIL: No items with rank ≤ 20\n')
      results.errors.push('No Top 20 items found')
    } else {
      const top20Scores = top20.map(item => item.popularity_score).filter(Boolean)
      const minTop20 = Math.min(...top20Scores)
      const maxTop20 = Math.max(...top20Scores)
      const avgTop20 = top20Scores.reduce((a, b) => a + b, 0) / top20Scores.length

      console.log(`Total Top 20 items: ${top20.length}`)
      console.log(`Score range: ${minTop20.toFixed(2)} - ${maxTop20.toFixed(2)}`)
      console.log(`Average score: ${avgTop20.toFixed(2)}`)

      const top20Below70 = top20Scores.filter(s => s < 70).length
      console.log(`Items below 70: ${top20Below70}`)

      if (top20Below70 > 0) {
        console.log(`✅ PASS: Top 20 includes diverse scores\n`)
        results.passed.push('Top 20 diversity')
      } else {
        console.log(`⚠️  WARN: Top 20 are all high scores (natural for score-based ranking)\n`)
        results.warnings.push('Top 20 all high scores (expected for score-based ranking)')
      }
    }

    // ========================================================================
    // CHECK 5: Summary Coverage
    // ========================================================================
    console.log('📝 CHECK 4: Summary Coverage')
    console.log('─'.repeat(60))

    const withSummaryTh = items.filter(item => item.summary && item.summary.trim()).length
    const withSummaryEn = items.filter(item => item.summary_en && item.summary_en.trim()).length

    console.log(`Items with TH summary: ${withSummaryTh}/${items.length} (${formatPercentage(withSummaryTh, items.length)})`)
    console.log(`Items with EN summary: ${withSummaryEn}/${items.length} (${formatPercentage(withSummaryEn, items.length)})`)

    if (withSummaryTh >= items.length * 0.95 && withSummaryEn >= items.length * 0.95) {
      console.log(`✅ PASS: Summary coverage ≥95%\n`)
      results.passed.push('Summary coverage')
    } else {
      console.log(`⚠️  WARN: Summary coverage <95%\n`)
      results.warnings.push('Summary coverage below 95%')
    }

    // ========================================================================
    // CHECK 6: Growth Labels
    // ========================================================================
    console.log('📈 CHECK 5: Growth Labels')
    console.log('─'.repeat(60))

    const withGrowthLabel = items.filter(item => 
      item.growth_rate_label && 
      item.growth_rate_label !== 'Not enough data' &&
      item.growth_rate_label.trim()
    ).length

    console.log(`Items with growth labels: ${withGrowthLabel}/${items.length} (${formatPercentage(withGrowthLabel, items.length)})`)

    if (withGrowthLabel >= items.length * 0.8) {
      console.log(`✅ PASS: Growth label coverage ≥80%\n`)
      results.passed.push('Growth label coverage')
    } else {
      console.log(`⚠️  WARN: Growth label coverage <80%\n`)
      results.warnings.push('Growth label coverage below 80%')
    }

    // ========================================================================
    // CHECK 7: Top-3 AI Images
    // ========================================================================
    console.log('🖼️  CHECK 6: Top-3 AI Images')
    console.log('─'.repeat(60))

    const top3Items = items.filter(item => item.is_top3 === true || (item.rank && item.rank <= 3))
    const top3WithImages = top3Items.filter(item => item.image_url && item.image_url.trim()).length

    console.log(`Top-3 items: ${top3Items.length}`)
    console.log(`Top-3 with images: ${top3WithImages}/${top3Items.length}`)

    if (top3Items.length === 3 && top3WithImages === 3) {
      console.log(`✅ PASS: All Top-3 have images\n`)
      results.passed.push('Top-3 AI images')
    } else if (top3Items.length === 3 && top3WithImages > 0) {
      console.log(`⚠️  WARN: Only ${top3WithImages}/3 Top-3 items have images\n`)
      results.warnings.push(`Only ${top3WithImages}/3 Top-3 items have images`)
    } else {
      console.log(`❌ FAIL: Top-3 images missing or incorrect count\n`)
      results.errors.push('Top-3 images not properly configured')
    }

    // ========================================================================
    // CHECK 8: Date Diversity
    // ========================================================================
    console.log('📆 CHECK 7: Date Diversity')
    console.log('─'.repeat(60))

    const dates = new Set()
    items.forEach(item => {
      const date = item.published_at || item.created_at
      if (date) {
        const itemDate = new Date(date)
        const itemBangkokDate = new Date(itemDate.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
        dates.add(itemBangkokDate.toISOString().split('T')[0])
      }
    })

    console.log(`Unique dates in dataset: ${dates.size}`)
    if (dates.size > 0) {
      console.log(`Date range: ${Array.from(dates).sort().join(', ')}`)
    }

    if (dates.size >= 7) {
      console.log(`✅ PASS: Date diversity ≥7 days\n`)
      results.passed.push('Date diversity')
    } else if (dates.size >= 1) {
      console.log(`⚠️  WARN: Limited date diversity (${dates.size} unique dates)\n`)
      results.warnings.push(`Limited date diversity (${dates.size} days)`)
    } else {
      console.log(`❌ FAIL: No date information\n`)
      results.errors.push('No date information in items')
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    results.errors.push(`Unexpected error: ${error.message}`)
  }

  return results
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

;(async () => {
  const results = await runChecks()

  // Summary
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║                      SUMMARY                                   ║')
  console.log('╚════════════════════════════════════════════════════════════════╝\n')

  console.log(`✅ Passed:   ${results.passed.length}`)
  results.passed.forEach(check => console.log(`   - ${check}`))

  console.log(`\n⚠️  Warnings: ${results.warnings.length}`)
  results.warnings.forEach(warning => console.log(`   - ${warning}`))

  console.log(`\n❌ Errors:   ${results.errors.length}`)
  results.errors.forEach(error => console.log(`   - ${error}`))

  // Exit code
  console.log('\n' + '═'.repeat(60))
  if (results.errors.length > 0) {
    console.log('❌ RESULT: FAIL (critical errors found)')
    process.exit(2)
  } else if (results.warnings.length > 0) {
    console.log('⚠️  RESULT: WARN (some checks failed but not critical)')
    process.exit(1)
  } else {
    console.log('✅ RESULT: PASS (all checks passed)')
    process.exit(0)
  }
})()

