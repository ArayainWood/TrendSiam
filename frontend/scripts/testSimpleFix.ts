#!/usr/bin/env npx tsx
/**
 * Test Simple Fix
 * 
 * Verify the simple view works after applying SIMPLE_FIX_VIEW.sql
 */

import { createClient } from '@supabase/supabase-js';

const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
};

async function main() {
  console.log(colors.cyan('\n=== Testing Simple Fix ===\n'));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    console.error(colors.red('Missing environment variables'));
    process.exit(1);
  }

  const supabase = createClient(url, anonKey);

  let allPassed = true;

  // Test 1: Basic query
  console.log(colors.cyan('1. Testing basic query...'));
  try {
    const { data, error } = await supabase
      .from('news_public_v')
      .select('id, title')
      .limit(1);
    
    if (error) {
      console.log(colors.red(`  ✗ Error: ${error.message}`));
      allPassed = false;
    } else {
      console.log(colors.green(`  ✓ Basic query works`));
    }
  } catch (err: any) {
    console.log(colors.red(`  ✗ Exception: ${err.message}`));
    allPassed = false;
  }

  // Test 2: Query with view_details
  console.log(colors.cyan('\n2. Testing view_details...'));
  try {
    const { data, error } = await supabase
      .from('news_public_v')
      .select('id, title, view_details')
      .limit(1);
    
    if (error) {
      console.log(colors.red(`  ✗ Error: ${error.message}`));
      allPassed = false;
    } else {
      console.log(colors.green(`  ✓ view_details works!`));
      if (data && data[0] && data[0].view_details) {
        const vd = data[0].view_details;
        console.log(colors.cyan('  Sample view_details:'));
        console.log(`    - views: ${vd.views}`);
        console.log(`    - growth_rate: ${vd.growth_rate}`);
        console.log(`    - platform_mentions: ${vd.platform_mentions}`);
      }
    }
  } catch (err: any) {
    console.log(colors.red(`  ✗ Exception: ${err.message}`));
    allPassed = false;
  }

  // Test 3: Full query (what the app does)
  console.log(colors.cyan('\n3. Testing full query (*)...'));
  try {
    const { data, error } = await supabase
      .from('news_public_v')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(colors.red(`  ✗ Error: ${error.message}`));
      console.log(colors.red(`  THIS IS THE ERROR YOUR APP SEES!`));
      allPassed = false;
    } else {
      console.log(colors.green(`  ✓ Full query works! The app will load!`));
    }
  } catch (err: any) {
    console.log(colors.red(`  ✗ Exception: ${err.message}`));
    allPassed = false;
  }

  // Summary
  console.log(colors.cyan('\n=== Summary ==='));
  if (allPassed) {
    console.log(colors.green('✅ All tests passed! The fix is working!'));
    console.log(colors.green('You can now refresh http://localhost:3000'));
  } else {
    console.log(colors.red('❌ Some tests failed.'));
    console.log(colors.yellow('Make sure you ran SIMPLE_FIX_VIEW.sql in Supabase'));
  }
}

if (require.main === module) {
  main().catch(console.error);
}
