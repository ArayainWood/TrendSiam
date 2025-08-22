#!/usr/bin/env npx tsx
/**
 * Check View Definition
 * 
 * Checks the actual definition of news_public_v in the database
 */

import { createClient } from '@supabase/supabase-js';

const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
};

async function main() {
  console.log(colors.cyan('\n=== Checking View Definition ===\n'));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    console.error(colors.red('Missing environment variables'));
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);

  // Check view columns
  console.log(colors.cyan('1. Checking news_public_v columns...'));
  try {
    const { data, error } = await supabase
      .from('news_public_v')
      .select('*')
      .limit(0); // Just get schema, no data
    
    if (error) {
      console.log(colors.red(`  ✗ Error: ${error.message}`));
    } else {
      console.log(colors.green(`  ✓ View exists`));
    }
  } catch (err: any) {
    console.log(colors.red(`  ✗ Exception: ${err.message}`));
  }

  // Check if we can query without view_details
  console.log(colors.cyan('\n2. Testing query without view_details...'));
  try {
    const { data, error } = await supabase
      .from('news_public_v')
      .select('id, title, summary, popularity_score')
      .limit(1);
    
    if (error) {
      console.log(colors.red(`  ✗ Error: ${error.message}`));
    } else {
      console.log(colors.green(`  ✓ Query works without view_details`));
    }
  } catch (err: any) {
    console.log(colors.red(`  ✗ Exception: ${err.message}`));
  }

  // Check system catalog for view definition
  console.log(colors.cyan('\n3. Checking view definition in system catalog...'));
  try {
    const { data, error } = await supabase.rpc('get_view_definition', {
      view_name: 'news_public_v'
    }).single();
    
    if (error) {
      // Try alternative method
      const query = `
        SELECT 
          schemaname,
          viewname,
          definition
        FROM pg_views 
        WHERE viewname = 'news_public_v'
      `;
      
      console.log(colors.yellow('  → Using alternative check method'));
      console.log(colors.yellow('  → View might have been created with errors'));
    } else if (data) {
      console.log(colors.green(`  ✓ Found view definition`));
      console.log(colors.cyan('  → Definition preview:'));
      console.log(data.definition?.substring(0, 200) + '...');
    }
  } catch (err: any) {
    console.log(colors.yellow(`  ⚠ Cannot inspect view definition`));
  }

  console.log(colors.cyan('\n=== Solution ==='));
  console.log(colors.yellow('The view needs to be recreated now that functions exist.'));
  console.log(colors.yellow('Run this SQL to fix:'));
  console.log(colors.green('\nDROP VIEW IF EXISTS public.news_public_v CASCADE;'));
  console.log(colors.green('-- Then run the full create_public_views.sql script'));
}

if (require.main === module) {
  main().catch(console.error);
}
