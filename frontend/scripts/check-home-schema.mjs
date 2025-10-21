#!/usr/bin/env node

/**
 * CLI Schema Health Check
 * 
 * Verifies database schema for PDF generation
 * Usage: node scripts/check-home-schema.mjs [--view <viewname>]
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// Expected schemas
const SCHEMAS = {
  public_v_weekly_snapshots: [
    'snapshot_id',
    'status',
    'built_at',
    'created_at',
    'range_start',
    'range_end',
    'items',
    'meta'
  ],
  home_feed_v1: [
    'id',
    'rank',
    'title',
    'platform',
    'category',
    'channel',
    'published_at',
    'popularity_score'
  ],
  public_v_home_news: [
    'id',
    'rank',
    'title',
    'platform',
    'category',
    'channel',
    'published_at',
    'score'
  ]
};

async function checkView(viewName, expectedColumns) {
  console.log(`\n📋 Checking view: ${viewName}`);
  
  try {
    // Try to query the view
    const { data, error } = await supabase
      .from(viewName)
      .select('*')
      .limit(1)
      .single();

    if (error && error.code === 'PGRST200') {
      // No rows but view exists
      console.log(`✅ View exists (no data)`);
      return { exists: true, hasData: false };
    }

    if (error) {
      console.error(`❌ Error: ${error.message}`);
      return { exists: false, error: error.message };
    }

    const actualColumns = data ? Object.keys(data) : [];
    const missing = expectedColumns.filter(col => !actualColumns.includes(col));
    const extra = actualColumns.filter(col => !expectedColumns.includes(col));

    console.log(`✅ View exists with ${actualColumns.length} columns`);
    
    if (missing.length > 0) {
      console.log(`⚠️  Missing columns: ${missing.join(', ')}`);
    }
    
    if (extra.length > 0) {
      console.log(`ℹ️  Extra columns: ${extra.join(', ')}`);
    }

    if (missing.length === 0) {
      console.log(`✅ All expected columns present`);
    }

    return {
      exists: true,
      hasData: !!data,
      columns: actualColumns,
      missing,
      extra,
      healthy: missing.length === 0
    };

  } catch (error) {
    console.error(`❌ Unexpected error: ${error.message}`);
    return { exists: false, error: error.message };
  }
}

async function main() {
  console.log('🔍 TrendSiam Schema Health Check');
  console.log('================================');
  console.log(`📍 Supabase URL: ${SUPABASE_URL}`);
  console.log(`🕐 Timestamp: ${new Date().toISOString()}`);

  // Parse command line arguments
  const args = process.argv.slice(2);
  const viewIndex = args.indexOf('--view');
  const specificView = viewIndex !== -1 ? args[viewIndex + 1] : null;

  let overallHealth = true;
  const results = {};

  // Check specific view or all
  const viewsToCheck = specificView 
    ? { [specificView]: SCHEMAS[specificView] || [] }
    : SCHEMAS;

  for (const [viewName, expectedColumns] of Object.entries(viewsToCheck)) {
    const result = await checkView(viewName, expectedColumns);
    results[viewName] = result;
    
    if (!result.exists || !result.healthy) {
      overallHealth = false;
    }
  }

  // Summary
  console.log('\n📊 Summary');
  console.log('==========');
  console.log(`Overall health: ${overallHealth ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
  console.log(`Views checked: ${Object.keys(results).length}`);
  console.log(`Healthy views: ${Object.values(results).filter(r => r.healthy).length}`);

  // Exit code
  process.exit(overallHealth ? 0 : 1);
}

// Run the check
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});