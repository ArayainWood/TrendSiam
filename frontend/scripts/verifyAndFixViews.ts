#!/usr/bin/env npx tsx
/**
 * Verify and Fix Public Views
 * 
 * Checks if helper functions and views are properly created
 * Provides SQL to fix if missing
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
};

async function main() {
  console.log(colors.cyan('\n=== Verifying Public Views and Helper Functions ===\n'));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    console.error(colors.red('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'));
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);

  // Test 1: Check helper functions
  console.log(colors.cyan('1. Checking helper functions...'));
  const functions = ['safe_to_jsonb', 'safe_json_text'];
  let functionsExist = true;
  
  for (const func of functions) {
    try {
      const { data, error } = await supabase.rpc(func, 
        func === 'safe_to_jsonb' ? { src: 'test' } : { obj: {}, key: 'test', default_val: 'default' }
      );
      
      if (error) {
        console.log(colors.red(`  ✗ ${func} not found`));
        functionsExist = false;
      } else {
        console.log(colors.green(`  ✓ ${func} exists`));
      }
    } catch (err) {
      console.log(colors.red(`  ✗ ${func} not found`));
      functionsExist = false;
    }
  }

  // Test 2: Check views
  console.log(colors.cyan('\n2. Checking public views...'));
  const views = ['news_public_v', 'stories_public_v', 'snapshots_public_v', 'weekly_report_public_v'];
  let viewsExist = true;
  
  for (const view of views) {
    try {
      const { count, error } = await supabase
        .from(view)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(colors.red(`  ✗ ${view} not found`));
        viewsExist = false;
      } else {
        console.log(colors.green(`  ✓ ${view} exists (${count || 0} rows)`));
      }
    } catch (err) {
      console.log(colors.red(`  ✗ ${view} not found`));
      viewsExist = false;
    }
  }

  // Test 3: Test a view with JSON handling
  if (viewsExist && functionsExist) {
    console.log(colors.cyan('\n3. Testing JSON handling in views...'));
    try {
      const { data, error } = await supabase
        .from('news_public_v')
        .select('id, title, view_details')
        .limit(1);
      
      if (error) {
        console.log(colors.red(`  ✗ View query failed: ${error.message}`));
      } else {
        console.log(colors.green(`  ✓ View query succeeded`));
        if (data && data[0] && data[0].view_details) {
          console.log(colors.green(`  ✓ view_details is properly formatted`));
        }
      }
    } catch (err: any) {
      console.log(colors.red(`  ✗ View query failed: ${err.message}`));
    }
  }

  // Generate fix if needed
  if (!functionsExist || !viewsExist) {
    console.log(colors.yellow('\n=== Fix Required ===\n'));
    
    const sqlPath = path.join(process.cwd(), 'db', 'sql', 'security', 'create_public_views.sql');
    
    if (fs.existsSync(sqlPath)) {
      console.log(colors.yellow('To fix the issues:'));
      console.log('1. Copy the entire contents of:');
      console.log(colors.cyan(`   ${sqlPath}`));
      console.log('2. Paste into Supabase SQL Editor');
      console.log('3. Run the script');
      console.log('4. Re-run this verification');
      
      // Also output just the helper functions for quick fix
      if (!functionsExist) {
        console.log(colors.yellow('\nOr for a quick fix, just run these helper functions:\n'));
        console.log(`-- Safe TEXT -> JSONB converter
CREATE OR REPLACE FUNCTION public.safe_to_jsonb(src text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF src IS NULL OR btrim(src) = '' THEN
    RETURN '{}'::jsonb;
  END IF;
  BEGIN
    RETURN src::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN '{}'::jsonb;
  END;
END;
$$;

-- Safe JSON property extractor
CREATE OR REPLACE FUNCTION public.safe_json_text(obj jsonb, key text, default_val text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(jsonb_extract_path_text(obj, key), default_val);
$$;`);
      }
    } else {
      console.log(colors.red('SQL file not found at expected location'));
    }
  } else {
    console.log(colors.green('\n✅ All views and helper functions are properly set up!'));
  }
}

if (require.main === module) {
  main().catch(console.error);
}
