#!/usr/bin/env npx tsx
/**
 * Deep Diagnostic for JSON Error
 * 
 * Comprehensive test to find exactly where the error is coming from
 */

import { createClient } from '@supabase/supabase-js';

const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
};

async function main() {
  console.log(colors.cyan('\n=== Deep Diagnostic for JSON Error ===\n'));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    console.error(colors.red('Missing environment variables'));
    process.exit(1);
  }

  const supabase = createClient(url, anonKey);

  // Test 1: Simple query
  console.log(colors.cyan('1. Simple query to news_public_v...'));
  try {
    const { data, error } = await supabase
      .from('news_public_v')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log(colors.red(`  ✗ Error: ${error.message}`));
    } else {
      console.log(colors.green(`  ✓ Simple query works`));
    }
  } catch (err: any) {
    console.log(colors.red(`  ✗ Exception: ${err.message}`));
  }

  // Test 2: Query with view_details
  console.log(colors.cyan('\n2. Query including view_details...'));
  try {
    const { data, error } = await supabase
      .from('news_public_v')
      .select('id, title, view_details')
      .limit(1);
    
    if (error) {
      console.log(colors.red(`  ✗ Error: ${error.message}`));
      console.log(colors.yellow(`  → This might be where the JSON error comes from!`));
    } else {
      console.log(colors.green(`  ✓ view_details query works`));
      if (data && data[0]) {
        console.log(`  - view_details type: ${typeof data[0].view_details}`);
        console.log(`  - view_details value: ${JSON.stringify(data[0].view_details)}`);
      }
    }
  } catch (err: any) {
    console.log(colors.red(`  ✗ Exception: ${err.message}`));
  }

  // Test 3: Query all columns (what newsRepo does)
  console.log(colors.cyan('\n3. Query with * (all columns)...'));
  try {
    const { data, error } = await supabase
      .from('news_public_v')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(colors.red(`  ✗ Error: ${error.message}`));
      console.log(colors.yellow(`  → THIS IS THE ERROR YOUR APP IS SEEING!`));
    } else {
      console.log(colors.green(`  ✓ Full query works`));
    }
  } catch (err: any) {
    console.log(colors.red(`  ✗ Exception: ${err.message}`));
  }

  // Test 4: Check specific problematic columns
  console.log(colors.cyan('\n4. Testing specific columns...'));
  const columns = ['score_details', 'keywords', 'analysis', 'ai_opinion'];
  
  for (const col of columns) {
    try {
      const { data, error } = await supabase
        .from('news_public_v')
        .select(`id, ${col}`)
        .limit(1);
      
      if (error) {
        console.log(colors.red(`  ✗ ${col}: ${error.message}`));
      } else {
        console.log(colors.green(`  ✓ ${col} works`));
        if (data && data[0] && data[0][col] !== undefined) {
          console.log(`    Type: ${typeof data[0][col]}`);
        }
      }
    } catch (err: any) {
      console.log(colors.red(`  ✗ ${col}: ${err.message}`));
    }
  }

  // Test 5: Check if helper functions exist
  console.log(colors.cyan('\n5. Checking helper functions...'));
  try {
    const { data, error } = await supabase.rpc('safe_to_jsonb', { src: 'test' });
    
    if (error) {
      console.log(colors.red(`  ✗ safe_to_jsonb not found`));
      console.log(colors.yellow(`  → The view might be trying to use non-existent functions!`));
    } else {
      console.log(colors.green(`  ✓ safe_to_jsonb exists`));
    }
  } catch (err: any) {
    console.log(colors.red(`  ✗ safe_to_jsonb error: ${err.message}`));
  }
}

if (require.main === module) {
  main().catch(console.error);
}
