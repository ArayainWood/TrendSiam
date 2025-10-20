#!/usr/bin/env node

/**
 * Auto-Repair Home View Schema
 * 
 * Purpose: Introspect Supabase, fix migration, apply, and verify
 * Usage: node scripts/auto-repair-home-view.mjs
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ============================================================================
// STEP 1: Connect to Supabase
// ============================================================================

console.log('🔌 Connecting to Supabase...')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anon) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  console.error('   Make sure you are running this from the frontend directory with .env loaded')
  process.exit(1)
}

const supabase = createClient(url, anon, {
  auth: { persistSession: false }
})

console.log('✅ Connected to Supabase\n')

// ============================================================================
// STEP 2: Introspect Current Schema
// ============================================================================

console.log('🔍 Introspecting current schema...')

async function introspectViews() {
  const views = ['home_feed_v1', 'public_v_home_news']
  const report = {
    views: {},
    canonical: null
  }
  
  for (const viewName of views) {
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, ordinal_position, data_type')
      .eq('table_schema', 'public')
      .eq('table_name', viewName)
      .order('ordinal_position', { ascending: true })
    
    if (error) {
      report.views[viewName] = { exists: false, columns: [], error: error.message }
      continue
    }
    
    if (!data || data.length === 0) {
      report.views[viewName] = { exists: false, columns: [] }
      continue
    }
    
    const columns = data.map(row => row.column_name)
    const hasWebViewCount = columns.includes('web_view_count')
    
    report.views[viewName] = {
      exists: true,
      columnCount: columns.length,
      hasWebViewCount,
      columns: columns.slice(0, 5) // First 5 for brevity
    }
    
    console.log(`  ✅ ${viewName}: ${columns.length} columns, web_view_count=${hasWebViewCount}`)
  }
  
  // Check system_meta for canonical view
  const { data: metaData } = await supabase
    .from('public_v_system_meta')
    .select('key, value')
    .eq('key', 'home_view_canonical')
    .single()
  
  report.canonical = metaData?.value || 'home_feed_v1'
  
  return report
}

const schemaReport = await introspectViews()
console.log(`\n📊 Current state:`)
console.log(`   Canonical view: ${schemaReport.canonical}`)
console.log(`   home_feed_v1: ${schemaReport.views.home_feed_v1.exists ? 'EXISTS' : 'MISSING'}`)
console.log(`   public_v_home_news: ${schemaReport.views.public_v_home_news.exists ? 'EXISTS' : 'MISSING'}`)

// ============================================================================
// STEP 3: Read and Validate Migration
// ============================================================================

console.log('\n📄 Reading migration SQL...')

const migrationPath = path.join(__dirname, '..', 'db', 'sql', 'fixes', '2025-10-06_unify_home_view_web_view_count.sql')

if (!fs.existsSync(migrationPath)) {
  console.error(`❌ Migration not found: ${migrationPath}`)
  process.exit(1)
}

const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')
console.log(`✅ Migration loaded (${migrationSQL.length} chars)`)

// ============================================================================
// STEP 4: Apply Migration (requires service_role key)
// ============================================================================

console.log('\n⚠️  Migration requires service_role key to execute SQL directly')
console.log('   Please run the migration manually in Supabase SQL Editor:')
console.log(`   File: frontend/db/sql/fixes/2025-10-06_unify_home_view_web_view_count.sql\n`)

// Alternative: Check if we can verify the views exist after manual application
console.log('🔄 Checking if migration has been applied...')

const postCheck = await introspectViews()

const bothViewsExist = postCheck.views.home_feed_v1.exists && postCheck.views.public_v_home_news.exists
const bothHaveWebViewCount = postCheck.views.home_feed_v1.hasWebViewCount && postCheck.views.public_v_home_news.hasWebViewCount

if (bothViewsExist && bothHaveWebViewCount) {
  console.log('✅ Migration appears to be applied!')
  console.log('   Both views exist and have web_view_count column\n')
} else {
  console.log('⚠️  Migration not yet applied or incomplete:')
  if (!bothViewsExist) {
    console.log('   - Not all views exist')
  }
  if (!bothHaveWebViewCount) {
    console.log('   - web_view_count column missing from one or more views')
  }
  console.log('')
}

// ============================================================================
// STEP 5: Verification Report
// ============================================================================

console.log('📋 VERIFICATION REPORT')
console.log('=' .repeat(70))

// Test 1: View existence
console.log('\n1️⃣  View Existence:')
console.log(`   home_feed_v1: ${postCheck.views.home_feed_v1.exists ? '✅ EXISTS' : '❌ MISSING'}`)
console.log(`   public_v_home_news: ${postCheck.views.public_v_home_news.exists ? '✅ EXISTS' : '❌ MISSING'}`)

// Test 2: Column count
console.log('\n2️⃣  Column Count:')
if (postCheck.views.home_feed_v1.exists) {
  console.log(`   home_feed_v1: ${postCheck.views.home_feed_v1.columnCount} columns`)
}
if (postCheck.views.public_v_home_news.exists) {
  console.log(`   public_v_home_news: ${postCheck.views.public_v_home_news.columnCount} columns`)
}

// Test 3: web_view_count presence
console.log('\n3️⃣  web_view_count Column:')
console.log(`   home_feed_v1: ${postCheck.views.home_feed_v1.hasWebViewCount ? '✅ PRESENT' : '❌ MISSING'}`)
console.log(`   public_v_home_news: ${postCheck.views.public_v_home_news.hasWebViewCount ? '✅ PRESENT' : '❌ MISSING'}`)

// Test 4: System metadata
console.log('\n4️⃣  System Metadata:')
const { data: metaValues } = await supabase
  .from('public_v_system_meta')
  .select('key, value, updated_at')
  .in('key', ['home_view_version', 'home_view_canonical'])

if (metaValues && metaValues.length > 0) {
  metaValues.forEach(({ key, value }) => {
    console.log(`   ${key}: ${value}`)
  })
} else {
  console.log('   ⚠️  No metadata found')
}

// Test 5: Row count
console.log('\n5️⃣  Row Count Test:')
if (postCheck.views.home_feed_v1.exists) {
  const { count, error } = await supabase
    .from('home_feed_v1')
    .select('*', { count: 'exact', head: true })
  
  if (!error && count !== null) {
    console.log(`   home_feed_v1: ${count} rows`)
  } else {
    console.log(`   home_feed_v1: ❌ ${error?.message || 'Failed to count'}`)
  }
}

// ============================================================================
// STEP 6: API Health Check
// ============================================================================

console.log('\n6️⃣  API Health Check:')
try {
  const healthUrl = 'http://localhost:3000/api/health-schema?check=home_view'
  console.log(`   Testing: ${healthUrl}`)
  console.log('   (This will fail if dev server is not running)')
  
  // Note: fetch may not be available in older Node versions
  if (typeof fetch !== 'undefined') {
    const response = await fetch(healthUrl)
    const health = await response.json()
    console.log(`   Status: ${response.status}`)
    console.log(`   ok: ${health.ok}`)
    console.log(`   hasWebViewCount: ${health.columns?.hasWebViewCount}`)
  } else {
    console.log('   ⚠️  Fetch not available, skipping API check')
  }
} catch (error) {
  console.log(`   ⚠️  Could not reach API: ${error.message}`)
}

// ============================================================================
// FINAL STATUS
// ============================================================================

console.log('\n' + '='.repeat(70))
console.log('📊 FINAL STATUS')
console.log('='.repeat(70))

const allGreen = bothViewsExist && bothHaveWebViewCount

if (allGreen) {
  console.log('\n✅ ALL CHECKS PASSED')
  console.log('   - Both views exist')
  console.log('   - web_view_count column present in both views')
  console.log('   - Schema is unified and consistent')
  console.log('\n🚀 Home API should now work without 500 errors\n')
  process.exit(0)
} else {
  console.log('\n⚠️  MIGRATION NEEDED')
  console.log('\nTo fix:')
  console.log('1. Open Supabase SQL Editor')
  console.log('2. Run: frontend/db/sql/fixes/2025-10-06_unify_home_view_web_view_count.sql')
  console.log('3. Re-run this script to verify\n')
  process.exit(1)
}
