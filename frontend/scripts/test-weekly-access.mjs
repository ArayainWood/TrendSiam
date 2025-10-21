/**
 * Test Weekly Snapshots Access
 * 
 * Diagnose exactly what's failing with weekly snapshots
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local from frontend directory
dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 Testing Weekly Snapshots Access');
console.log('=' .repeat(60));

async function testAccess(name, from) {
  console.log(`\n📋 Testing: ${name}`);
  console.log(`   From: ${from}`);
  
  try {
    const { data, error, count } = await supabase
      .from(from)
      .select('*', { count: 'exact' })
      .limit(1);
    
    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
      console.log(`   Code: ${error.code}`);
      console.log(`   Details: ${JSON.stringify(error.details)}`);
      console.log(`   Hint: ${error.hint}`);
      return { success: false, error };
    }
    
    console.log(`   ✅ Success! Row count: ${count || 0}`);
    if (data && data.length > 0) {
      console.log(`   Columns: ${Object.keys(data[0]).join(', ')}`);
    }
    return { success: true, count, data };
    
  } catch (err) {
    console.log(`   ❌ Exception: ${err.message}`);
    return { success: false, error: err };
  }
}

async function main() {
  // Test all possible names
  await testAccess('Base table', 'weekly_report_snapshots');
  await testAccess('View weekly_report_public_v', 'weekly_report_public_v');
  await testAccess('View public_v_weekly_snapshots', 'public_v_weekly_snapshots');
  await testAccess('View v_weekly_snapshots', 'v_weekly_snapshots');
  
  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log('If anon cannot read any of these, we need to:');
  console.log('1. Create a public view for weekly_report_snapshots');
  console.log('2. Grant SELECT to anon/authenticated');
  console.log('3. Update code to use the correct view name');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

