#!/usr/bin/env npx tsx
/**
 * Debug JSON Error Script
 * 
 * Diagnoses the "invalid input syntax for type json" error
 */

import { createClient } from '@supabase/supabase-js';

const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
};

async function main() {
  console.log(colors.cyan('\n=== JSON Error Debugging ===\n'));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    console.error(colors.red('Missing environment variables'));
    process.exit(1);
  }

  const supabase = createClient(url, anonKey);

  // Test 1: Check if views exist
  console.log(colors.cyan('1. Checking if safe views exist...'));
  try {
    const { count: newsViewCount } = await supabase
      .from('news_public_v')
      .select('*', { count: 'exact', head: true });
    
    console.log(colors.green(`  ✓ news_public_v exists (${newsViewCount} rows)`));
  } catch (err: any) {
    console.log(colors.red(`  ✗ news_public_v not found: ${err.message}`));
    console.log(colors.yellow('  → Run the SQL script in create_public_views.sql'));
  }

  // Test 2: Direct table query (this might fail)
  console.log(colors.cyan('\n2. Testing direct table query...'));
  try {
    const { data, error } = await supabase
      .from('news_trends')
      .select('id, title, keywords, score_details')
      .limit(5);
    
    if (error) throw error;
    
    console.log(colors.green('  ✓ Direct query succeeded'));
    
    // Check data types
    if (data && data.length > 0) {
      const sample = data[0];
      console.log(`  - keywords type: ${typeof sample.keywords}`);
      console.log(`  - score_details type: ${typeof sample.score_details}`);
      
      // Try to parse as JSON
      try {
        if (sample.keywords) {
          const parsed = JSON.parse(sample.keywords);
          console.log(colors.green(`  ✓ keywords is valid JSON`));
        }
      } catch {
        console.log(colors.yellow(`  ⚠ keywords is not valid JSON: "${sample.keywords}"`));
      }
    }
  } catch (err: any) {
    console.log(colors.red(`  ✗ Direct query failed: ${err.message}`));
  }

  // Test 3: Check problematic records
  console.log(colors.cyan('\n3. Finding problematic records...'));
  try {
    // Query records with potentially invalid JSON
    const { data: badRecords } = await supabase
      .from('news_trends')
      .select('id, video_id, keywords, score_details')
      .or('keywords.is.null,keywords.eq.,keywords.eq.{}')
      .limit(10);
    
    if (badRecords && badRecords.length > 0) {
      console.log(colors.yellow(`  Found ${badRecords.length} records with empty/null keywords`));
      badRecords.forEach((rec, i) => {
        console.log(`    ${i+1}. ${rec.video_id}: keywords="${rec.keywords}"`);
      });
    } else {
      console.log(colors.green('  ✓ No obviously problematic records found'));
    }
  } catch (err: any) {
    console.log(colors.red(`  ✗ Query failed: ${err.message}`));
  }

  // Test 4: Test if helper functions exist
  console.log(colors.cyan('\n4. Testing helper functions...'));
  try {
    const { data, error } = await supabase.rpc('safe_to_jsonb', { src: 'invalid json' });
    
    if (error) {
      console.log(colors.yellow('  ⚠ Helper functions not found'));
      console.log('  → Need to run the full create_public_views.sql script');
    } else {
      console.log(colors.green('  ✓ Helper functions exist'));
    }
  } catch (err: any) {
    console.log(colors.yellow(`  ⚠ RPC test failed: ${err.message}`));
  }

  // Summary
  console.log(colors.cyan('\n=== Summary ==='));
  console.log('\nTo fix the JSON error:');
  console.log('1. Run the SQL script: frontend/db/sql/security/create_public_views.sql');
  console.log('2. This will create safe views and helper functions');
  console.log('3. The app will then use these views instead of direct queries');
  console.log('\nThe error occurs because:');
  console.log('- keywords and score_details are TEXT columns');
  console.log('- Some queries try to cast them with ::json');
  console.log('- If the TEXT contains invalid JSON, the cast fails');
  console.log('- Our safe views handle this with try/catch functions');
}

if (require.main === module) {
  main().catch(console.error);
}
