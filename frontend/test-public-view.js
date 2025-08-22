#!/usr/bin/env node

/**
 * Verification test for weekly_public_view connection
 * 
 * Tests the Supabase public view integration using environment variables.
 * Must be run from the frontend directory.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function testPublicView() {
  console.log('🔍 Testing weekly_public_view connection...');
  
  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  console.log('Environment check:', {
    hasUrl: !!supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    urlPreview: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'missing'
  });
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Environment variables not found. Please ensure .env.local exists with:');
    console.error('NEXT_PUBLIC_SUPABASE_URL=your_supabase_url');
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key');
    process.exit(1);
  }
  
  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
  });
  
  try {
    // Test query to weekly_public_view
    console.log('📊 Querying weekly_public_view...');
    
    const { data, error, count } = await supabase
      .from('weekly_public_view')
      .select('*', { count: 'exact' })
      .limit(1);
    
    if (error) {
      console.error('❌ Query failed:', error);
      console.log('{ ok: false, error: "' + error.message + '" }');
      process.exit(1);
    }
    
    console.log('✅ Query successful!');
    console.log(`{ ok: true, rows: ${count || 0} }`);
    
    if (data && data.length > 0) {
      console.log('\n📝 Sample row structure:');
      console.log(JSON.stringify(data[0], null, 2));
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    console.log('{ ok: false, error: "' + error.message + '" }');
    process.exit(1);
  }
}

// Check if running as main script
if (require.main === module) {
  testPublicView();
}

module.exports = { testPublicView };
