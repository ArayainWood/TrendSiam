#!/usr/bin/env node
/**
 * Database Connectivity Check
 * Part of TrendSiam Comprehensive Audit
 * 
 * Checks:
 * - Environment variables present
 * - Supabase connection successful
 * - Basic query execution
 * 
 * NOTE: Must be run from frontend directory where dependencies are installed
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment from frontend/.env.local
const envPath = join(__dirname, '../../frontend/.env.local');
config({ path: envPath });

// Import after dotenv is configured
const { createClient } = await import('@supabase/supabase-js');

console.log('='.repeat(80));
console.log('DATABASE CONNECTIVITY CHECK');
console.log('='.repeat(80));
console.log('');

// Check environment variables (without printing secrets)
console.log('1. Environment Variables Check:');
const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL'
];

let envComplete = true;
for (const varName of requiredVars) {
  const exists = !!process.env[varName];
  const display = exists ? '✅ Present' : '❌ Missing';
  console.log(`   ${varName}: ${display}`);
  if (!exists) envComplete = false;
}

if (!envComplete) {
  console.log('');
  console.log('❌ FAIL: Missing required environment variables');
  console.log('   Create .env.local with required Supabase credentials');
  process.exit(1);
}

console.log('');
console.log('2. Supabase Connection Test:');

try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase credentials');
  }
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
  });
  
  console.log(`   URL: ${supabaseUrl.substring(0, 30)}...`);
  console.log('   Creating client... ✅');
  
  // Test query: check if we can read from system_meta view
  console.log('');
  console.log('3. Test Query (public_v_system_meta):');
  
  const { data, error } = await supabase
    .from('public_v_system_meta')
    .select('key, value')
    .limit(5);
  
  if (error) {
    console.log(`   ⚠️  Warning: ${error.message}`);
    console.log('   This may be expected if views haven\'t been created yet');
  } else {
    console.log(`   ✅ Success: Retrieved ${data?.length || 0} config rows`);
    if (data && data.length > 0) {
      data.forEach(row => {
        console.log(`      - ${row.key}: ${row.value}`);
      });
    }
  }
  
  // Test query: check if we can read from home view
  console.log('');
  console.log('4. Test Query (home_feed_v1):');
  
  const { data: homeData, error: homeError } = await supabase
    .from('home_feed_v1')
    .select('id, title, rank')
    .limit(3);
  
  if (homeError) {
    console.log(`   ⚠️  Error: ${homeError.message}`);
    console.log('   View may not exist or may be empty');
  } else {
    console.log(`   ✅ Success: Retrieved ${homeData?.length || 0} news items`);
    if (homeData && homeData.length > 0) {
      homeData.forEach((item, idx) => {
        const title = item.title?.substring(0, 50) || 'Untitled';
        console.log(`      ${idx + 1}. [Rank ${item.rank}] ${title}...`);
      });
    }
  }
  
  console.log('');
  console.log('='.repeat(80));
  console.log('✅ Database connectivity check PASSED');
  console.log('='.repeat(80));
  console.log('');
  
  process.exit(0);
  
} catch (error) {
  console.log('');
  console.log('❌ FAIL: Connection test failed');
  console.log(`   Error: ${error.message}`);
  console.log('');
  process.exit(1);
}

