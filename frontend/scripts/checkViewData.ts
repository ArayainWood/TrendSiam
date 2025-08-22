#!/usr/bin/env npx tsx
/**
 * Check What Data the View Returns
 * 
 * See why the website might show "No Trending Stories"
 */

import { createClient } from '@supabase/supabase-js';

const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
};

async function main() {
  console.log(colors.cyan('\n=== Checking View Data ===\n'));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    console.error(colors.red('Missing environment variables'));
    process.exit(1);
  }

  const supabase = createClient(url, anonKey);

  // Check how many rows the view returns
  console.log(colors.cyan('1. Counting rows in news_public_v...'));
  try {
    const { count, error } = await supabase
      .from('news_public_v')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(colors.red(`  ✗ Error: ${error.message}`));
    } else {
      console.log(colors.green(`  ✓ Total rows in view: ${count}`));
    }
  } catch (err: any) {
    console.log(colors.red(`  ✗ Exception: ${err.message}`));
  }

  // Get sample data to see what's there
  console.log(colors.cyan('\n2. Getting sample data...'));
  try {
    const { data, error } = await supabase
      .from('news_public_v')
      .select('id, title, published_date, published_at, created_at, popularity_score_precise')
      .order('popularity_score_precise', { ascending: false })
      .limit(5);
    
    if (error) {
      console.log(colors.red(`  ✗ Error: ${error.message}`));
    } else if (data && data.length > 0) {
      console.log(colors.green(`  ✓ Found ${data.length} rows`));
      data.forEach((row, i) => {
        console.log(colors.cyan(`\n  Row ${i + 1}:`));
        console.log(`    Title: ${row.title?.substring(0, 50)}...`);
        console.log(`    Score: ${row.popularity_score_precise}`);
        console.log(`    Published Date: ${row.published_date}`);
        console.log(`    Published At: ${row.published_at}`);
        console.log(`    Created At: ${row.created_at}`);
      });
    } else {
      console.log(colors.yellow('  ⚠ No data returned from view'));
    }
  } catch (err: any) {
    console.log(colors.red(`  ✗ Exception: ${err.message}`));
  }

  // Check the raw table data
  console.log(colors.cyan('\n3. Checking raw news_trends table...'));
  try {
    const { data, error } = await supabase
      .from('news_trends')
      .select('id, title, published_date, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.log(colors.red(`  ✗ Error: ${error.message}`));
    } else if (data && data.length > 0) {
      console.log(colors.green(`  ✓ Found ${data.length} rows in base table`));
      data.forEach((row, i) => {
        console.log(`    ${i + 1}. ${row.title?.substring(0, 40)}... (published: ${row.published_date})`);
      });
    }
  } catch (err: any) {
    console.log(colors.red(`  ✗ Exception: ${err.message}`));
  }

  // Check view filter criteria
  console.log(colors.cyan('\n4. View Filter Analysis...'));
  console.log(colors.yellow('  The view shows rows where:'));
  console.log('  - published_date IS NOT NULL, OR');
  console.log('  - created_at >= CURRENT_TIMESTAMP - INTERVAL \'7 days\'');
  console.log(colors.cyan('\n  This means:'));
  console.log('  - If published_date is NULL, the row must be created within 7 days');
}

if (require.main === module) {
  main().catch(console.error);
}
