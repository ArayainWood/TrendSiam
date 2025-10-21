// DB Object Validation Script
// Purpose: Validate DB state against manifest (Plan-B compliance, permissions, objects)
// Usage: node scripts/validate-db-objects.js
// Requirements: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

// Load .env.local
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Validation results
const results = {
  passed: [],
  failed: [],
  warnings: []
}

function pass(check, message) {
  results.passed.push({ check, message })
  console.log(`✅ ${check}: ${message}`)
}

function fail(check, message) {
  results.failed.push({ check, message })
  console.error(`❌ ${check}: ${message}`)
}

function warn(check, message) {
  results.warnings.push({ check, message })
  console.warn(`⚠️  ${check}: ${message}`)
}

// Check 1: Can anon read v_home_news?
async function checkViewVHomeNews() {
  try {
    const { data, error } = await supabase
      .from('v_home_news')
      .select('count', { count: 'exact', head: true })
    
    if (error) {
      fail('v_home_news', `Cannot read: ${error.message}`)
    } else {
      pass('v_home_news', `Accessible, has ${data || 'unknown'} rows`)
    }
  } catch (e) {
    fail('v_home_news', `Exception: ${e.message}`)
  }
}

// Check 2: Can anon read public_v_home_news?
async function checkViewPublicVHomeNews() {
  try {
    const { data, error } = await supabase
      .from('public_v_home_news')
      .select('count', { count: 'exact', head: true })
    
    if (error) {
      fail('public_v_home_news', `Cannot read: ${error.message}`)
    } else {
      pass('public_v_home_news', `Accessible, has ${data || 'unknown'} rows`)
    }
  } catch (e) {
    fail('public_v_home_news', `Exception: ${e.message}`)
  }
}

// Check 3: Can anon read public_v_system_meta?
async function checkViewPublicVSystemMeta() {
  try {
    const { data, error } = await supabase
      .from('public_v_system_meta')
      .select('*')
      .limit(5)
    
    if (error) {
      fail('public_v_system_meta', `Cannot read: ${error.message}`)
    } else {
      const keys = (data || []).map(row => row.key).join(', ')
      pass('public_v_system_meta', `Accessible, keys: ${keys || 'none'}`)
    }
  } catch (e) {
    fail('public_v_system_meta', `Exception: ${e.message}`)
  }
}

// Check 4: Plan-B - Can anon read base table news_trends? (SHOULD FAIL)
async function checkPlanBNewsT

() {
  try {
    const { data, error } = await supabase
      .from('news_trends')
      .select('count', { count: 'exact', head: true })
    
    if (error && error.message.includes('permission denied')) {
      pass('Plan-B (news_trends)', 'Correctly denied access to base table')
    } else if (error) {
      warn('Plan-B (news_trends)', `Unexpected error: ${error.message}`)
    } else {
      fail('Plan-B (news_trends)', 'CAN READ BASE TABLE! Plan-B violation!')
    }
  } catch (e) {
    warn('Plan-B (news_trends)', `Exception: ${e.message}`)
  }
}

// Check 5: Plan-B - Can anon read base table system_meta? (SHOULD FAIL)
async function checkPlanBSystemMeta() {
  try {
    const { data, error } = await supabase
      .from('system_meta')
      .select('count', { count: 'exact', head: true })
    
    if (error && error.message.includes('permission denied')) {
      pass('Plan-B (system_meta)', 'Correctly denied access to base table')
    } else if (error) {
      warn('Plan-B (system_meta)', `Unexpected error: ${error.message}`)
    } else {
      fail('Plan-B (system_meta)', 'CAN READ BASE TABLE! Plan-B violation!')
    }
  } catch (e) {
    warn('Plan-B (system_meta)', `Exception: ${e.message}`)
  }
}

// Check 6: RPC get_public_home_news works?
async function checkRPCHomeNews() {
  try {
    const { data, error } = await supabase.rpc('get_public_home_news', {
      p_limit: 5,
      p_offset: 0
    })
    
    if (error) {
      warn('RPC get_public_home_news', `Cannot execute: ${error.message}`)
    } else {
      pass('RPC get_public_home_news', `Works, returned ${data?.length || 0} rows`)
    }
  } catch (e) {
    warn('RPC get_public_home_news', `Exception: ${e.message}`)
  }
}

// Check 7: RPC get_public_system_meta works?
async function checkRPCSystemMeta() {
  try {
    const { data, error } = await supabase.rpc('get_public_system_meta')
    
    if (error) {
      warn('RPC get_public_system_meta', `Cannot execute: ${error.message}`)
    } else {
      const keys = (data || []).map(row => row.key).join(', ')
      pass('RPC get_public_system_meta', `Works, keys: ${keys || 'none'}`)
    }
  } catch (e) {
    warn('RPC get_public_system_meta', `Exception: ${e.message}`)
  }
}

// Check 8: Load a sample from v_home_news and verify columns
async function checkHomeNewsColumns() {
  try {
    const { data, error } = await supabase
      .from('v_home_news')
      .select('*')
      .limit(1)
    
    if (error) {
      fail('v_home_news columns', `Cannot read: ${error.message}`)
    } else if (!data || data.length === 0) {
      warn('v_home_news columns', 'No data returned, cannot verify columns')
    } else {
      const item = data[0]
      const requiredFields = ['id', 'title', 'popularity_score', 'published_at']
      const missing = requiredFields.filter(f => !(f in item))
      
      if (missing.length > 0) {
        fail('v_home_news columns', `Missing fields: ${missing.join(', ')}`)
      } else {
        pass('v_home_news columns', `Has required fields: ${requiredFields.join(', ')}`)
      }
    }
  } catch (e) {
    fail('v_home_news columns', `Exception: ${e.message}`)
  }
}

// Main validation
async function main() {
  console.log('🔍 TrendSiam DB Object Validation')
  console.log('===================================\n')
  
  console.log('Testing view access (anon should have access)...')
  await checkViewVHomeNews()
  await checkViewPublicVHomeNews()
  await checkViewPublicVSystemMeta()
  
  console.log('\nTesting Plan-B (anon should NOT have access to base tables)...')
  await checkPlanBNewsT()
  await checkPlanBSystemMeta()
  
  console.log('\nTesting RPC functions...')
  await checkRPCHomeNews()
  await checkRPCSystemMeta()
  
  console.log('\nTesting data contract...')
  await checkHomeNewsColumns()
  
  console.log('\n===================================')
  console.log('SUMMARY')
  console.log('===================================')
  console.log(`✅ Passed: ${results.passed.length}`)
  console.log(`❌ Failed: ${results.failed.length}`)
  console.log(`⚠️  Warnings: ${results.warnings.length}`)
  
  if (results.failed.length > 0) {
    console.log('\n❌ VALIDATION FAILED!')
    console.log('\nFailed checks:')
    results.failed.forEach(r => console.log(`  - ${r.check}: ${r.message}`))
    process.exit(1)
  } else if (results.warnings.length > 0) {
    console.log('\n⚠️  VALIDATION PASSED WITH WARNINGS')
    console.log('\nWarnings:')
    results.warnings.forEach(r => console.log(`  - ${r.check}: ${r.message}`))
    process.exit(0)
  } else {
    console.log('\n✅ ALL VALIDATIONS PASSED!')
    process.exit(0)
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})

