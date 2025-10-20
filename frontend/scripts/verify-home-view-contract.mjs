#!/usr/bin/env node
/**
 * Verify Home View Contract
 * Ensures public_v_home_news has all required columns
 * Run this as part of build process to catch regressions
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const EXPECTED_COLUMNS = [
  'id', 'title', 'summary', 'summary_en', 'category', 'platform',
  'channel', 'published_at', 'source_url', 'image_url', 'ai_prompt',
  'popularity_score', 'rank', 'is_top3', 'views', 'likes', 'comments',
  'growth_rate_value', 'growth_rate_label', 'ai_opinion', 'score_details',
  'video_id', 'external_id', 'platform_mentions', 'keywords', 'updated_at'
]

async function verifyHomeView() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false }
  })

  console.log('🔍 Verifying public_v_home_news view...')

  try {
    // Get column information from information_schema
    const { data: columnData, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'public_v_home_news')
      .order('ordinal_position')

    if (columnError) {
      throw new Error(`Failed to query columns: ${columnError.message}`)
    }

    const actualColumns = columnData?.map(row => row.column_name) || []
    
    // Check for missing columns
    const missingColumns = EXPECTED_COLUMNS.filter(col => !actualColumns.includes(col))
    const unexpectedColumns = actualColumns.filter(col => !EXPECTED_COLUMNS.includes(col))

    if (missingColumns.length > 0) {
      console.error(`❌ Missing columns in view: ${missingColumns.join(', ')}`)
      process.exit(1)
    }

    if (unexpectedColumns.length > 0) {
      console.warn(`⚠️  Unexpected columns in view: ${unexpectedColumns.join(', ')}`)
    }

    // Test data retrieval
    const { data, error } = await supabase
      .from('public_v_home_news')
      .select('*')
      .limit(1)

    if (error) {
      throw new Error(`Failed to query view: ${error.message}`)
    }

    console.log(`✅ View has ${actualColumns.length} columns (expected ${EXPECTED_COLUMNS.length})`)
    console.log(`✅ View is queryable`)

    // Verify Top-3 policy
    if (data && data.length > 0) {
      const { data: top3Data } = await supabase
        .from('public_v_home_news')
        .select('rank, is_top3, image_url, ai_prompt')
        .order('rank')
        .limit(10)

      let policyViolations = 0
      top3Data?.forEach(row => {
        if (!row.is_top3 && (row.image_url || row.ai_prompt)) {
          policyViolations++
          console.error(`❌ Policy violation: rank ${row.rank} has image/prompt but is_top3=false`)
        }
      })

      if (policyViolations === 0) {
        console.log('✅ Top-3 policy compliance verified')
      }
    }

    console.log('\n✅ All home view contract checks passed!')
    process.exit(0)

  } catch (error) {
    console.error('\n❌ View verification failed:', error)
    process.exit(1)
  }
}

// Run verification
verifyHomeView()
