#!/usr/bin/env npx tsx
/**
 * Test Direct Query
 * 
 * Tests what happens when we query news_public_v directly
 */

import { createClient } from '@supabase/supabase-js';

const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
};

async function main() {
  console.log(colors.cyan('\n=== Testing Direct Query ===\n'));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    console.error(colors.red('Missing environment variables'));
    process.exit(1);
  }

  const supabase = createClient(url, anonKey);

  // Test 1: Query news_public_v
  console.log(colors.cyan('1. Querying news_public_v...'));
  try {
    const { data, error } = await supabase
      .from('news_public_v')
      .select('id, title')
      .limit(1);
    
    if (error) {
      console.log(colors.red(`  ✗ Error: ${error.message}`));
      console.log(colors.yellow(`  → This is the error your app is seeing!`));
    } else {
      console.log(colors.green(`  ✓ Success! Found ${data?.length || 0} items`));
    }
  } catch (err: any) {
    console.log(colors.red(`  ✗ Exception: ${err.message}`));
  }

  // Test 2: Check if view exists in schema
  console.log(colors.cyan('\n2. Checking if view exists in database...'));
  try {
    const { data, error } = await supabase.rpc('to_regclass', { 
      relation: 'public.news_public_v' 
    });
    
    if (error) {
      console.log(colors.yellow(`  ⚠ Cannot check: ${error.message}`));
    } else if (data === null) {
      console.log(colors.red(`  ✗ View does NOT exist`));
      console.log(colors.yellow(`  → This is why you're getting the error!`));
    } else {
      console.log(colors.green(`  ✓ View exists`));
    }
  } catch (err: any) {
    // Try alternative check
    const { data, error } = await supabase
      .from('news_public_v')
      .select('*', { count: 'exact', head: true });
    
    if (error && error.message.includes('not found')) {
      console.log(colors.red(`  ✗ View does NOT exist`));
    } else if (!error) {
      console.log(colors.green(`  ✓ View exists`));
    }
  }

  // Test 3: Try the fallback table
  console.log(colors.cyan('\n3. Testing news_trends table (fallback)...'));
  try {
    const { data, error } = await supabase
      .from('news_trends')
      .select('id, title, keywords, score_details')
      .limit(1);
    
    if (error) {
      console.log(colors.red(`  ✗ Error: ${error.message}`));
    } else {
      console.log(colors.green(`  ✓ Table accessible`));
      if (data && data[0]) {
        console.log(`  - keywords type: ${typeof data[0].keywords}`);
        console.log(`  - score_details type: ${typeof data[0].score_details}`);
      }
    }
  } catch (err: any) {
    console.log(colors.red(`  ✗ Exception: ${err.message}`));
  }
}

if (require.main === module) {
  main().catch(console.error);
}
