#!/usr/bin/env npx tsx

/**
 * Update v_home_news view to include AI prompt fallback chain
 * 
 * This script updates the v_home_news view to implement the fallback chain:
 * stories.ai_image_prompt -> news_trends.ai_image_prompt -> image_files.reason -> snapshots.reason
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateView() {
  try {
    console.log('🔄 Updating v_home_news view with AI prompt fallback chain...');
    
    // Read the SQL file
    const sqlPath = join(process.cwd(), 'db', 'sql', 'views', 'v_home_news.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    
    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('❌ Failed to update view:', error);
      process.exit(1);
    }
    
    console.log('✅ Successfully updated v_home_news view');
    
    // Test the view
    console.log('🔍 Testing updated view...');
    const { data: testData, error: testError } = await supabase
      .from('v_home_news')
      .select('id, title, ai_image_prompt')
      .not('ai_image_prompt', 'is', null)
      .limit(5);
    
    if (testError) {
      console.error('❌ Failed to test view:', testError);
      process.exit(1);
    }
    
    console.log(`✅ View test successful. Found ${testData?.length || 0} items with AI prompts`);
    
    if (testData && testData.length > 0) {
      console.log('📝 Sample AI prompts:');
      testData.forEach((item, index) => {
        const prompt = item.ai_image_prompt as string;
        console.log(`  ${index + 1}. ${item.title}: "${prompt.substring(0, 80)}..."`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error updating view:', error);
    process.exit(1);
  }
}

// Check if we can execute SQL directly or need to use a different approach
async function checkSqlExecution() {
  try {
    // Try to execute a simple query first
    const { data, error } = await supabase
      .from('v_home_news')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('ℹ️ Current view may not exist or needs update');
    }
    
    // For now, just show the SQL that needs to be executed
    console.log('📋 SQL to execute in Supabase SQL Editor:');
    console.log('=' * 50);
    
    const sqlPath = join(process.cwd(), 'db', 'sql', 'views', 'v_home_news.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    console.log(sql);
    
    console.log('=' * 50);
    console.log('ℹ️ Please execute the above SQL in your Supabase SQL Editor');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the check
checkSqlExecution();
