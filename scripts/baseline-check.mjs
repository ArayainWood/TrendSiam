#!/usr/bin/env node
/**
 * Baseline Check: Published Date Issue
 * Reproduce current state and identify root cause
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('╔════════════════════════════════════════════════════════════╗')
console.log('║        BASELINE: Published Date Issue Diagnosis           ║')
console.log('╚════════════════════════════════════════════════════════════╝\n')

// Test 1: Data availability
async function test1DataAvailability() {
  console.log('📊 Test 1: Data Availability in home_feed_v1')
  console.log('━'.repeat(60))
  
  const { data, error } = await supabase
    .from('home_feed_v1')
    .select('id, published_at, snapshot_date')
    .limit(1000)
  
  if (error) {
    console.error('❌ Query failed:', error.message)
    return
  }
  
  const total = data.length
  const withPublished = data.filter(i => i.published_at != null).length
  const withSnapshot = data.filter(i => i.snapshot_date != null).length
  const nullPublished = total - withPublished
  
  console.log(`Total items queried: ${total}`)
  console.log(`Items with published_at: ${withPublished} (${Math.round(withPublished/total*100)}%)`)
  console.log(`Items with NULL published_at: ${nullPublished} (${Math.round(nullPublished/total*100)}%)`)
  console.log(`Items with snapshot_date: ${withSnapshot} (${Math.round(withSnapshot/total*100)}%)`)
  
  return { total, withPublished, nullPublished, withSnapshot }
}

// Test 2: Sample rows
async function test2SampleRows() {
  console.log('\n📋 Test 2: Sample Rows (Top 5 by Rank)')
  console.log('━'.repeat(60))
  
  const { data, error } = await supabase
    .from('home_feed_v1')
    .select('id, title, published_at, snapshot_date, platform, rank')
    .order('rank', { ascending: true })
    .limit(5)
  
  if (error) {
    console.error('❌ Query failed:', error.message)
    return
  }
  
  data.forEach((item, idx) => {
    console.log(`\n#${idx + 1}:`)
    console.log(`  ID: ${item.id}`)
    console.log(`  Title: ${item.title?.substring(0, 50)}...`)
    console.log(`  Published: ${item.published_at || 'NULL'}`)
    console.log(`  Snapshot: ${item.snapshot_date || 'NULL'}`)
    console.log(`  Platform: ${item.platform}`)
    console.log(`  Rank: ${item.rank}`)
  })
  
  return data
}

// Test 3: Date type analysis
async function test3DateAnalysis() {
  console.log('\n📅 Test 3: Date Type Analysis')
  console.log('━'.repeat(60))
  
  const { data, error } = await supabase
    .from('home_feed_v1')
    .select('published_at, snapshot_date')
    .limit(10)
  
  if (error) {
    console.error('❌ Query failed:', error.message)
    return
  }
  
  if (data.length === 0) {
    console.log('⚠️  No data to analyze')
    return
  }
  
  const first = data[0]
  console.log('Sample published_at value:', first.published_at)
  console.log('Type of published_at:', typeof first.published_at)
  console.log('Sample snapshot_date value:', first.snapshot_date)
  console.log('Type of snapshot_date:', typeof first.snapshot_date)
  
  // Try parsing
  if (first.published_at) {
    try {
      const parsed = new Date(first.published_at)
      console.log('Parsed published_at:', parsed.toISOString())
      console.log('Is valid:', !isNaN(parsed.getTime()))
    } catch (e) {
      console.log('❌ Failed to parse published_at:', e.message)
    }
  }
}

// Test 4: Upstream news_trends table
async function test4UpstreamData() {
  console.log('\n🔍 Test 4: Upstream news_trends Table')
  console.log('━'.repeat(60))
  
  const { data, error } = await supabase
    .from('news_trends')
    .select('id, title, published_at, published_date, date, platform')
    .order('date', { ascending: false })
    .limit(5)
  
  if (error) {
    console.error('❌ Query failed:', error.message)
    return
  }
  
  console.log(`Found ${data.length} rows in news_trends\n`)
  
  data.forEach((item, idx) => {
    console.log(`Row ${idx + 1}:`)
    console.log(`  Title: ${item.title?.substring(0, 40)}...`)
    console.log(`  published_at: ${item.published_at || 'NULL'} (${typeof item.published_at})`)
    console.log(`  published_date: ${item.published_date || 'NULL'} (${typeof item.published_date})`)
    console.log(`  date (snapshot): ${item.date || 'NULL'}`)
    console.log(`  platform: ${item.platform}`)
    console.log('')
  })
  
  return data
}

// Test 5: Check for Invalid Date strings
async function test5InvalidDateCheck() {
  console.log('\n⚠️  Test 5: Invalid Date String Check')
  console.log('━'.repeat(60))
  
  const { data, error } = await supabase
    .from('home_feed_v1')
    .select('id, title, published_at')
    .limit(50)
  
  if (error) {
    console.error('❌ Query failed:', error.message)
    return
  }
  
  let invalidCount = 0
  let nullCount = 0
  let validCount = 0
  
  data.forEach(item => {
    if (item.published_at === null) {
      nullCount++
    } else {
      const parsed = new Date(item.published_at)
      if (isNaN(parsed.getTime())) {
        invalidCount++
        if (invalidCount <= 3) {
          console.log(`Invalid: ${item.title?.substring(0, 40)} | value: ${item.published_at}`)
        }
      } else {
        validCount++
      }
    }
  })
  
  console.log(`\nSample of 50 items:`)
  console.log(`  Valid dates: ${validCount}`)
  console.log(`  NULL dates: ${nullCount}`)
  console.log(`  Invalid/unparseable: ${invalidCount}`)
  
  if (invalidCount > 0) {
    console.log('\n❌ ISSUE CONFIRMED: Invalid date strings found')
  } else if (nullCount > 0) {
    console.log('\n⚠️  ISSUE CONFIRMED: Many NULL published dates')
  } else {
    console.log('\n✅ All published dates are valid')
  }
  
  return { validCount, nullCount, invalidCount }
}

// Main
async function main() {
  try {
    await test1DataAvailability()
    await test2SampleRows()
    await test3DateAnalysis()
    await test4UpstreamData()
    const invalidCheck = await test5InvalidDateCheck()
    
    console.log('\n' + '═'.repeat(60))
    console.log('BASELINE SUMMARY')
    console.log('═'.repeat(60))
    console.log('\n📌 KEY FINDINGS:')
    console.log('1. Check if published_at column exists and is non-null')
    console.log('2. Check if dates are valid ISO-8601 strings')
    console.log('3. Identify root cause (NULL, invalid format, wrong source)')
    console.log('\n📋 NEXT STEPS:')
    console.log('1. Review view definition to see how published_at is populated')
    console.log('2. Check ingestion pipeline (summarize_all_v2.py)')
    console.log('3. Implement backfill/repair migration')
    console.log('4. Update frontend formatter to handle NULL gracefully')
    
  } catch (err) {
    console.error('\n💥 Fatal error:', err.message)
    process.exit(1)
  }
}

main()

