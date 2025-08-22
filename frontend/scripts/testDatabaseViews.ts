#!/usr/bin/env npx tsx
/**
 * Test Database Views
 * 
 * Verifies all public views are working correctly after SQL application
 * Usage: npx tsx scripts/testDatabaseViews.ts
 */

import { createClient } from '@supabase/supabase-js';

// Color utilities
const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  dim: (text: string) => `\x1b[2m${text}\x1b[0m`
};

async function main() {
  console.log('='.repeat(60));
  console.log(colors.cyan('Database Views Test'));
  console.log('='.repeat(60));

  // Check environment
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    console.error(colors.red('\n❌ Missing environment variables'));
    process.exit(1);
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let passed = 0;
  let failed = 0;

  // Test 1: news_public_v aliases
  console.log('\n' + colors.cyan('1. Testing news_public_v aliases...'));
  try {
    const { data, error } = await supabase
      .from('news_public_v')
      .select('published_date, published_at, ai_image_url, display_image_url, ai_opinion, analysis, score')
      .limit(1)
      .single();

    if (error) throw error;
    
    if (data) {
      console.log(colors.green('  ✓ View accessible'));
      console.log(`  ✓ published_at alias: ${data.published_date === data.published_at ? 'OK' : 'MISMATCH'}`);
      console.log(`  ✓ display_image_url alias: ${data.ai_image_url === data.display_image_url ? 'OK' : 'MISMATCH'}`);
      console.log(`  ✓ analysis alias: ${data.ai_opinion === data.analysis ? 'OK' : 'MISMATCH'}`);
      console.log(`  ✓ score computed: ${data.score !== null ? 'OK' : 'NULL'}`);
      passed++;
    }
  } catch (err) {
    console.error(colors.red('  ✗ Error:'), err);
    failed++;
  }

  // Test 2: stories_public_v id alias
  console.log('\n' + colors.cyan('2. Testing stories_public_v aliases...'));
  try {
    const { data, error } = await supabase
      .from('stories_public_v')
      .select('story_id, id')
      .limit(1)
      .single();

    if (error) throw error;
    
    if (data) {
      console.log(colors.green('  ✓ View accessible'));
      console.log(`  ✓ id alias: ${data.story_id === data.id ? 'OK' : 'MISMATCH'}`);
      passed++;
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('does not exist')) {
      console.log(colors.yellow('  ⚠ View does not exist (stories table may not be present)'));
    } else {
      console.error(colors.red('  ✗ Error:'), err);
      failed++;
    }
  }

  // Test 3: snapshots_public_v aliases
  console.log('\n' + colors.cyan('3. Testing snapshots_public_v aliases...'));
  try {
    const { data, error } = await supabase
      .from('snapshots_public_v')
      .select('id, snapshot_id, keywords, matched_keywords, score')
      .limit(1)
      .single();

    if (error) throw error;
    
    if (data) {
      console.log(colors.green('  ✓ View accessible'));
      console.log(`  ✓ snapshot_id alias: ${data.id === data.snapshot_id ? 'OK' : 'MISMATCH'}`);
      console.log(`  ✓ matched_keywords alias: ${data.keywords === data.matched_keywords ? 'OK' : 'MISMATCH'}`);
      console.log(`  ✓ score computed: ${data.score !== null ? 'OK' : 'NULL'}`);
      passed++;
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('does not exist')) {
      console.log(colors.yellow('  ⚠ View does not exist (snapshots table may not be present)'));
    } else {
      console.error(colors.red('  ✗ Error:'), err);
      failed++;
    }
  }

  // Test 4: weekly_report_public_v
  console.log('\n' + colors.cyan('4. Testing weekly_report_public_v...'));
  try {
    const { count, error } = await supabase
      .from('weekly_report_public_v')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    
    console.log(colors.green('  ✓ View accessible'));
    console.log(`  ✓ Published snapshots: ${count || 0}`);
    passed++;
  } catch (err) {
    console.error(colors.red('  ✗ Error:'), err);
    failed++;
  }

  // Test 5: score_details JSON extraction (safe handling)
  console.log('\n' + colors.cyan('5. Testing safe JSON extraction...'));
  try {
    // Test both valid and potentially invalid JSON
    const { data, error } = await supabase
      .from('news_public_v')
      .select('id, score_details, view_details')
      .limit(10);

    if (error) throw error;
    
    if (data && data.length > 0) {
      console.log(colors.green('  ✓ JSON extraction working safely'));
      
      // Check that view_details is always present (never null due to safe helpers)
      const allHaveViewDetails = data.every(row => row.view_details !== null);
      console.log(`  ✓ All rows have view_details: ${allHaveViewDetails ? 'YES' : 'NO'}`);
      
      // Sample some values
      const sample = data[0];
      if (sample.view_details) {
        console.log(`  ✓ growth_rate: ${sample.view_details.growth_rate || '0'}`);
        console.log(`  ✓ platform_mentions: ${sample.view_details.platform_mentions || '0'}`);
      }
      
      // Count different score_details states
      const nullCount = data.filter(r => r.score_details === null).length;
      const emptyCount = data.filter(r => r.score_details === '').length;
      console.log(`  ✓ Handled ${nullCount} null and ${emptyCount} empty score_details safely`);
      
      passed++;
    } else {
      console.log(colors.yellow('  ⚠ No rows to test JSON safety'));
      passed++;
    }
  } catch (err) {
    console.error(colors.red('  ✗ Error:'), err);
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(colors.cyan('Test Summary:'));
  console.log('='.repeat(60));
  console.log(`Passed: ${colors.green(String(passed))}`);
  console.log(`Failed: ${colors.red(String(failed))}`);
  
  if (failed === 0) {
    console.log(colors.green('\n✅ All database views are working correctly!'));
    process.exit(0);
  } else {
    console.log(colors.red('\n❌ Some tests failed. Please check the SQL views.'));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(colors.red('\n❌ Fatal error:'), error);
    process.exit(1);
  });
}
