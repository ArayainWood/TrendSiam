#!/usr/bin/env npx tsx
/**
 * Inspect news_trends table
 * 
 * Check actual columns and data types
 */

import { createClient } from '@supabase/supabase-js';

const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
};

async function main() {
  console.log(colors.cyan('\n=== Inspecting news_trends Table ===\n'));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    console.error(colors.red('Missing environment variables'));
    process.exit(1);
  }

  const supabase = createClient(url, anonKey);

  // Get one row to see structure
  console.log(colors.cyan('1. Getting sample row from news_trends...'));
  try {
    const { data, error } = await supabase
      .from('news_trends')
      .select('*')
      .limit(1)
      .single();
    
    if (error) {
      console.log(colors.red(`  ✗ Error: ${error.message}`));
    } else if (data) {
      console.log(colors.green(`  ✓ Found sample row`));
      console.log(colors.cyan('\n  Column list:'));
      
      const columns = Object.keys(data).sort();
      for (const col of columns) {
        const value = data[col];
        const type = value === null ? 'null' : typeof value;
        console.log(`    - ${col}: ${type}`);
        
        // Show sample for interesting columns
        if (['score_details', 'keywords', 'ai_opinion'].includes(col)) {
          if (value !== null) {
            const preview = String(value).substring(0, 50);
            console.log(`      Sample: "${preview}${String(value).length > 50 ? '...' : ''}"`);
          }
        }
      }
    }
  } catch (err: any) {
    console.log(colors.red(`  ✗ Exception: ${err.message}`));
  }

  // Check specific problematic values
  console.log(colors.cyan('\n2. Checking for problematic score_details...'));
  try {
    const { data, error } = await supabase
      .from('news_trends')
      .select('id, score_details')
      .or('score_details.is.null,score_details.eq.')
      .limit(5);
    
    if (error) {
      console.log(colors.red(`  ✗ Error: ${error.message}`));
    } else if (data && data.length > 0) {
      console.log(colors.yellow(`  ⚠ Found ${data.length} rows with null/empty score_details`));
      for (const row of data) {
        console.log(`    - ${row.id}: score_details = ${JSON.stringify(row.score_details)}`);
      }
    } else {
      console.log(colors.green(`  ✓ No null/empty score_details found`));
    }
  } catch (err: any) {
    console.log(colors.red(`  ✗ Exception: ${err.message}`));
  }

  // Check for non-JSON strings
  console.log(colors.cyan('\n3. Checking for invalid JSON in keywords...'));
  try {
    const { data, error } = await supabase
      .from('news_trends')
      .select('id, keywords')
      .eq('keywords', 'null')
      .limit(5);
    
    if (error) {
      console.log(colors.red(`  ✗ Error: ${error.message}`));
    } else if (data && data.length > 0) {
      console.log(colors.yellow(`  ⚠ Found ${data.length} rows with string "null" in keywords`));
    } else {
      console.log(colors.green(`  ✓ No string "null" found in keywords`));
    }
  } catch (err: any) {
    console.log(colors.red(`  ✗ Exception: ${err.message}`));
  }
}

if (require.main === module) {
  main().catch(console.error);
}
