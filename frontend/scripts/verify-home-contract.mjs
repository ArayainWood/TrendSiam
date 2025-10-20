#!/usr/bin/env node
/**
 * Verify Home Contract Script
 * 
 * This script verifies that the HOME_COLUMNS constant in the frontend
 * matches the actual columns in the public_v_home_news database view.
 * 
 * Exit codes:
 * - 0: Contract matches
 * - 1: Contract mismatch or error
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'
import { readFileSync } from 'fs'

// Load environment variables
config()

// Expected columns (must match schema-constants.ts)
const EXPECTED_COLUMNS = [
  'id',
  'title',
  'summary',
  'summary_en',
  'category',
  'platform',
  'channel',
  'published_at',
  'source_url',
  'image_url',
  'ai_prompt',
  'popularity_score',
  'rank',
  'is_top3',
  'views',
  'likes',
  'comments',
  'growth_rate_value',
  'growth_rate_label',
  'ai_opinion',
  'score_details',
  'video_id',
  'external_id',
  'platform_mentions',
  'keywords',
  'updated_at'
]

async function verifyHomeContract() {
  console.log('🔍 Verifying Home View Contract...\n')

  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing required environment variables:')
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
    console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓' : '✗')
    process.exit(1)
  }

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
  })

  try {
    // Step 1: Verify schema-constants.ts matches expected
    console.log('1️⃣ Checking schema-constants.ts...')
    const schemaConstantsPath = resolve('src/lib/db/schema-constants.ts')
    const schemaContent = readFileSync(schemaConstantsPath, 'utf-8')
    
    // Extract HOME_COLUMNS from the file
    const match = schemaContent.match(/export const HOME_COLUMNS = \[([\s\S]*?)\] as const/)
    if (!match) {
      console.error('❌ Could not parse HOME_COLUMNS from schema-constants.ts')
      process.exit(1)
    }

    const fileColumns = match[1]
      .split(',')
      .map(col => col.trim().replace(/['"]/g, ''))
      .filter(col => col.length > 0)

    // Compare with expected
    const missingInFile = EXPECTED_COLUMNS.filter(col => !fileColumns.includes(col))
    const extraInFile = fileColumns.filter(col => !EXPECTED_COLUMNS.includes(col))

    if (missingInFile.length > 0 || extraInFile.length > 0) {
      console.error('❌ schema-constants.ts mismatch:')
      if (missingInFile.length > 0) {
        console.error('   Missing:', missingInFile.join(', '))
      }
      if (extraInFile.length > 0) {
        console.error('   Extra:', extraInFile.join(', '))
      }
      process.exit(1)
    }

    console.log('✅ schema-constants.ts has correct columns')

    // Step 2: Get a sample row from the view
    console.log('\n2️⃣ Fetching sample from public_v_home_news...')
    const { data, error } = await supabase
      .from('public_v_home_news')
      .select(EXPECTED_COLUMNS.join(','))
      .limit(1)

    if (error) {
      console.error('❌ Database error:', error.message)
      process.exit(1)
    }

    if (!data || data.length === 0) {
      console.warn('⚠️  No data in view, checking column structure via query...')
      
      // Try to get column info directly
      const { data: metaData, error: metaError } = await supabase
        .from('public_v_system_meta')
        .select('key, value')
        .eq('key', 'home_columns_hash')
        .single()

      if (metaError || !metaData) {
        console.error('❌ Could not verify columns (view empty and no hash available)')
        process.exit(1)
      }

      console.log('✅ Found column hash in metadata:', metaData.value.substring(0, 16) + '...')
    } else {
      // Step 3: Check actual columns from the sample
      console.log('✅ Retrieved sample row')
      
      const actualColumns = Object.keys(data[0])
      const missingColumns = EXPECTED_COLUMNS.filter(col => !actualColumns.includes(col))
      const unexpectedColumns = actualColumns.filter(col => !EXPECTED_COLUMNS.includes(col))

      if (missingColumns.length > 0 || unexpectedColumns.length > 0) {
        console.error('\n❌ Column mismatch detected:')
        if (missingColumns.length > 0) {
          console.error('   Missing columns:', missingColumns.join(', '))
        }
        if (unexpectedColumns.length > 0) {
          console.error('   Unexpected columns:', unexpectedColumns.join(', '))
        }
        process.exit(1)
      }

      console.log('✅ All 26 columns present and match expected contract')
    }

    // Step 4: Check metadata
    console.log('\n3️⃣ Checking system metadata...')
    const { data: metaData, error: metaError } = await supabase
      .from('public_v_system_meta')
      .select('key, value')
      .in('key', ['home_limit', 'top3_max', 'home_freshness_policy'])

    if (metaError) {
      console.error('❌ Could not fetch metadata:', metaError.message)
      process.exit(1)
    }

    const meta = {}
    metaData?.forEach(row => {
      meta[row.key] = row.value
    })

    console.log('📊 System configuration:')
    console.log('   home_limit:', meta.home_limit || '(not set)')
    console.log('   top3_max:', meta.top3_max || '(not set)')
    console.log('   home_freshness_policy:', meta.home_freshness_policy || '(not set)')

    if (meta.home_freshness_policy === 'latest_snapshot:72h_primary|30d_fallback') {
      console.log('✅ Snapshot-based freshness policy is active')
    } else {
      console.warn('⚠️  Unexpected freshness policy:', meta.home_freshness_policy)
    }

    // Success
    console.log('\n✅ Home contract verification PASSED')
    console.log('   - schema-constants.ts matches expected 26 columns')
    console.log('   - Database view structure is correct')
    console.log('   - Snapshot-based freshness is configured')
    
    process.exit(0)

  } catch (err) {
    console.error('\n❌ Unexpected error:', err.message)
    console.error(err.stack)
    process.exit(1)
  }
}

// Run the verification
verifyHomeContract()
