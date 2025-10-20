#!/usr/bin/env node

/**
 * Check Home View Schema
 * 
 * Purpose: Verify that the home view has all required columns
 * Usage: node scripts/check-home-schema.mjs
 * 
 * Exit codes:
 * - 0: Schema is healthy (all required columns present)
 * - 1: Schema issue detected (missing web_view_count or other critical columns)
 * - 2: Connection error or exception
 */

import { createClient } from '@supabase/supabase-js'

const HOME_VIEW = 'home_feed_v1'
const HOME_SCHEMA = 'public'

// Required columns for current FE mapping
const REQUIRED_COLUMNS = [
  'id', 'title', 'summary', 'summary_en', 'category', 'platform', 'channel',
  'published_at', 'source_url', 'image_url', 'ai_prompt', 'popularity_score',
  'rank', 'is_top3', 'views', 'likes', 'comments', 'growth_rate_value',
  'growth_rate_label', 'ai_opinion', 'score_details', 'video_id', 'external_id',
  'platform_mentions', 'keywords', 'updated_at', 'web_view_count'
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!url || !anon) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    process.exit(2)
  }
  
  const supabase = createClient(url, anon, {
    auth: { persistSession: false }
  })
  
  try {
    console.log(`🔍 Checking schema for ${HOME_SCHEMA}.${HOME_VIEW}...`)
    
    // Query information_schema to get column list
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, ordinal_position')
      .eq('table_schema', HOME_SCHEMA)
      .eq('table_name', HOME_VIEW)
      .order('ordinal_position', { ascending: true })
    
    if (error) {
      console.error('❌ Failed to query information_schema:', error.message)
      process.exit(2)
    }
    
    if (!data || data.length === 0) {
      console.error(`❌ View ${HOME_VIEW} not found in schema ${HOME_SCHEMA}`)
      process.exit(1)
    }
    
    const columns = data.map(row => row.column_name)
    
    console.log(`\n📊 Found ${columns.length} columns in ${HOME_VIEW}`)
    
    // Check for required columns
    const missingColumns = REQUIRED_COLUMNS.filter(col => !columns.includes(col))
    const hasWebViewCount = columns.includes('web_view_count')
    
    if (missingColumns.length === 0) {
      console.log('✅ All required columns present')
      console.log(`   - web_view_count: ${hasWebViewCount ? 'YES' : 'NO'}`)
    } else {
      console.log(`❌ Missing ${missingColumns.length} required columns:`)
      missingColumns.forEach(col => console.log(`   - ${col}`))
    }
    
    // Get system metadata
    const { data: metaData } = await supabase
      .from('public_v_system_meta')
      .select('key, value')
      .in('key', ['home_view_version', 'home_view_canonical'])
    
    if (metaData && metaData.length > 0) {
      console.log('\n📝 System Metadata:')
      metaData.forEach(({ key, value }) => {
        console.log(`   - ${key}: ${value}`)
      })
    }
    
    // Get sample row count
    const { count, error: countError } = await supabase
      .from(HOME_VIEW)
      .select('*', { count: 'exact', head: true })
    
    if (!countError && count !== null) {
      console.log(`\n📈 Row count: ${count}`)
    }
    
    // Exit with appropriate code
    if (missingColumns.length === 0 && hasWebViewCount) {
      console.log('\n✅ Schema check PASSED')
      process.exit(0)
    } else if (!hasWebViewCount && missingColumns.length === 1 && missingColumns[0] === 'web_view_count') {
      console.log('\n⚠️  Schema check WARNING: web_view_count missing but API has fallback')
      console.log('   Run SQL migration: frontend/db/sql/fixes/2025-10-06_unify_home_view_web_view_count.sql')
      process.exit(1)
    } else {
      console.log('\n❌ Schema check FAILED: critical columns missing')
      process.exit(1)
    }
    
  } catch (error) {
    console.error('❌ Exception:', error.message)
    process.exit(2)
  }
}

main()
