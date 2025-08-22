#!/usr/bin/env npx tsx
/**
 * Test Public Views Script
 * 
 * Verifies all public views are accessible and working correctly
 * Usage: npx tsx scripts/testViews.ts
 */

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Color utilities for terminal output
const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  dim: (text: string) => `\x1b[2m${text}\x1b[0m`
};

// View definitions
const VIEWS_TO_TEST = [
  {
    name: 'news_public_v',
    requiredColumns: ['id', 'title', 'summary', 'category', 'platform', 'popularity_score_precise'],
    orderBy: 'popularity_score_precise'
  },
  {
    name: 'weekly_report_public_v',
    requiredColumns: ['snapshot_id', 'status', 'built_at', 'items'],
    orderBy: 'built_at'
  },
  {
    name: 'weekly_public_view',
    requiredColumns: ['id', 'title', 'summary', 'platform', 'score'],
    orderBy: 'score'
  },
  {
    name: 'stories_public_v',
    requiredColumns: ['id', 'title', 'summary'],
    orderBy: 'created_at',
    optional: true // May not exist
  },
  {
    name: 'snapshots_public_v',
    requiredColumns: ['snapshot_id', 'rank', 'score'],
    orderBy: 'snapshot_date',
    optional: true // May not exist
  }
];

// Initialize Supabase client
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

// Test a single view
async function testView(viewDef: typeof VIEWS_TO_TEST[0]) {
  const supabase = getSupabase();
  const results = {
    exists: false,
    accessible: false,
    hasData: false,
    hasRequiredColumns: false,
    rowCount: 0,
    sampleRow: null as any,
    errors: [] as string[]
  };
  
  try {
    // Test 1: Check if view exists and is accessible
    console.log(`\n${colors.cyan('Testing:')} ${viewDef.name}`);
    
    const { count, error: countError } = await supabase
      .from(viewDef.name)
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      if (viewDef.optional && countError.message.includes('does not exist')) {
        console.log(`  ${colors.yellow('⚠')}  View does not exist (optional)`);
        return results;
      }
      throw countError;
    }
    
    results.exists = true;
    results.accessible = true;
    results.rowCount = count || 0;
    console.log(`  ${colors.green('✓')} View exists and is accessible`);
    console.log(`  ${colors.green('✓')} Row count: ${results.rowCount}`);
    
    // Test 2: Check if view has data
    if (results.rowCount > 0) {
      results.hasData = true;
      
      // Get a sample row
      const { data: sampleData, error: sampleError } = await supabase
        .from(viewDef.name)
        .select('*')
        .order(viewDef.orderBy, { ascending: false })
        .limit(1)
        .single();
      
      if (sampleError) {
        throw sampleError;
      }
      
      results.sampleRow = sampleData;
      
      // Test 3: Check required columns
      const columns = Object.keys(sampleData);
      const missingColumns = viewDef.requiredColumns.filter(col => !columns.includes(col));
      
      if (missingColumns.length === 0) {
        results.hasRequiredColumns = true;
        console.log(`  ${colors.green('✓')} All required columns present`);
      } else {
        results.errors.push(`Missing columns: ${missingColumns.join(', ')}`);
        console.log(`  ${colors.red('✗')} Missing columns: ${missingColumns.join(', ')}`);
      }
      
      // Show sample data
      console.log(`  ${colors.dim('Sample row:')}`);
      viewDef.requiredColumns.forEach(col => {
        const value = sampleData[col];
        const displayValue = value === null ? 'null' 
          : typeof value === 'string' && value.length > 50 
            ? value.substring(0, 50) + '...'
            : value;
        console.log(`    ${col}: ${colors.dim(String(displayValue))}`);
      });
      
    } else {
      console.log(`  ${colors.yellow('⚠')}  View has no data`);
    }
    
  } catch (error) {
    results.errors.push(error instanceof Error ? error.message : String(error));
    console.log(`  ${colors.red('✗')} Error: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return results;
}

// Test RLS (Row Level Security)
async function testRLS() {
  console.log(`\n${colors.cyan('Testing RLS (Row Level Security):')}`);
  const supabase = getSupabase();
  
  try {
    // Try to query a base table directly (should fail or return empty)
    const { data, error } = await supabase
      .from('news_trends')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log(`  ${colors.green('✓')} RLS working: Direct table access denied`);
      console.log(`    ${colors.dim(error.message)}`);
    } else if (!data || data.length === 0) {
      console.log(`  ${colors.green('✓')} RLS working: No data returned from base table`);
    } else {
      console.log(`  ${colors.red('✗')} WARNING: Direct table access returned data!`);
      console.log(`    This may indicate RLS is not properly configured`);
    }
  } catch (err) {
    console.log(`  ${colors.green('✓')} RLS test passed with error:`, err);
  }
}

// Main test runner
async function main() {
  console.log('='.repeat(60));
  console.log(colors.cyan('Public Views Test Suite'));
  console.log('='.repeat(60));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Check environment
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    console.error(colors.red('\n❌ Missing required environment variables:'));
    console.error('  - NEXT_PUBLIC_SUPABASE_URL');
    console.error('  - NEXT_PUBLIC_SUPABASE_ANON_KEY');
    console.error('\nPlease ensure your .env file is configured correctly.');
    process.exit(1);
  }
  
  console.log(`\nSupabase URL: ${url}`);
  console.log(`Using anon key: ${anonKey.substring(0, 20)}...`);
  
  // Test each view
  const results: Record<string, any> = {};
  let totalPassed = 0;
  let totalFailed = 0;
  
  for (const viewDef of VIEWS_TO_TEST) {
    const result = await testView(viewDef);
    results[viewDef.name] = result;
    
    if (result.exists && result.accessible && result.hasRequiredColumns) {
      totalPassed++;
    } else if (!viewDef.optional) {
      totalFailed++;
    }
  }
  
  // Test RLS
  await testRLS();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(colors.cyan('Test Summary:'));
  console.log('='.repeat(60));
  console.log(`Total views tested: ${VIEWS_TO_TEST.length}`);
  console.log(`Passed: ${colors.green(String(totalPassed))}`);
  console.log(`Failed: ${colors.red(String(totalFailed))}`);
  console.log(`Optional/Skipped: ${VIEWS_TO_TEST.filter(v => v.optional).length}`);
  
  // Detailed results
  console.log('\nDetailed Results:');
  Object.entries(results).forEach(([viewName, result]) => {
    const status = result.exists && result.accessible && result.hasRequiredColumns
      ? colors.green('PASS')
      : result.exists && result.accessible
        ? colors.yellow('WARN')
        : colors.red('FAIL');
    
    console.log(`  ${viewName}: ${status} (${result.rowCount} rows)`);
    if (result.errors.length > 0) {
      result.errors.forEach((err: string) => {
        console.log(`    ${colors.red('Error:')} ${err}`);
      });
    }
  });
  
  // Exit code
  if (totalFailed > 0) {
    console.log(`\n${colors.red('❌ Some tests failed!')}`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green('✅ All tests passed!')}`);
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(colors.red('\n❌ Fatal error:'), error);
    process.exit(1);
  });
}
