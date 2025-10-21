#!/usr/bin/env node
/**
 * Debug script to check the Home view schema directly in Supabase
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables')
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const RESET = '\x1b[0m'

async function debugSchema() {
  console.log(`${CYAN}🔍 Debugging Home View Schema...${RESET}\n`)
  
  try {
    // Step 1: Try to select from the view
    console.log('1. Testing direct SELECT from public_v_home_news...')
    const { data: viewData, error: viewError } = await supabase
      .from('public_v_home_news')
      .select('*')
      .limit(1)
    
    if (viewError) {
      console.error(`${RED}❌ Error selecting from view:${RESET}`, viewError.message)
      console.error('   Error code:', viewError.code)
      console.error('   Error details:', viewError.details)
    } else {
      console.log(`${GREEN}✅ Successfully selected from view${RESET}`)
      if (viewData && viewData.length > 0) {
        const columns = Object.keys(viewData[0]).sort()
        console.log(`   Found ${columns.length} columns:`)
        console.log(`   ${columns.join(', ')}`)
      } else {
        console.log(`${YELLOW}⚠️  No data in view (but structure is OK)${RESET}`)
      }
    }
    
    // Step 2: Try to query information_schema (this might fail due to permissions)
    console.log('\n2. Trying to query information_schema...')
    const { data: schemaData, error: schemaError } = await supabase
      .from('information_schema.columns')
      .select('column_name, ordinal_position')
      .eq('table_schema', 'public')
      .eq('table_name', 'public_v_home_news')
      .order('ordinal_position')
    
    if (schemaError) {
      console.error(`${YELLOW}⚠️  Cannot query information_schema (expected):${RESET}`, schemaError.message)
    } else if (schemaData && schemaData.length > 0) {
      console.log(`${GREEN}✅ Found columns in information_schema:${RESET}`)
      schemaData.forEach(col => {
        console.log(`   ${col.ordinal_position}: ${col.column_name}`)
      })
    }
    
    // Step 3: Test the expected columns
    console.log('\n3. Testing specific column selection...')
    const expectedColumns = [
      'id', 'title', 'summary', 'summary_en', 'category', 'platform',
      'channel', 'published_at', 'source_url', 'image_url', 'ai_prompt',
      'popularity_score', 'rank', 'is_top3', 'views', 'likes', 'comments',
      'growth_rate_value', 'growth_rate_label', 'ai_opinion', 'score_details'
    ]
    
    const { data: testData, error: testError } = await supabase
      .from('public_v_home_news')
      .select(expectedColumns.join(','))
      .limit(1)
    
    if (testError) {
      console.error(`${RED}❌ Error selecting expected columns:${RESET}`, testError.message)
      
      // Try to determine which columns are missing
      console.log('\n4. Testing individual columns...')
      const missingColumns = []
      const existingColumns = []
      
      for (const col of expectedColumns) {
        const { error: colError } = await supabase
          .from('public_v_home_news')
          .select(col)
          .limit(1)
        
        if (colError) {
          missingColumns.push(col)
          console.log(`   ${RED}✗ ${col}${RESET}`)
        } else {
          existingColumns.push(col)
          console.log(`   ${GREEN}✓ ${col}${RESET}`)
        }
      }
      
      if (missingColumns.length > 0) {
        console.log(`\n${RED}Missing columns: ${missingColumns.join(', ')}${RESET}`)
      }
      console.log(`${GREEN}Existing columns: ${existingColumns.join(', ')}${RESET}`)
    } else {
      console.log(`${GREEN}✅ All expected columns exist!${RESET}`)
    }
    
    // Step 4: Check system_meta table
    console.log('\n5. Checking system_meta configuration...')
    const { data: metaData, error: metaError } = await supabase
      .from('system_meta')
      .select('key, value')
      .in('key', ['home_limit', 'top3_max'])
    
    if (metaError) {
      console.error(`${YELLOW}⚠️  Error reading system_meta:${RESET}`, metaError.message)
    } else {
      console.log(`${GREEN}✅ System meta configuration:${RESET}`)
      metaData?.forEach(item => {
        console.log(`   ${item.key}: ${item.value}`)
      })
    }
    
  } catch (error) {
    console.error(`${RED}❌ Unexpected error:${RESET}`, error)
  }
}

debugSchema()
