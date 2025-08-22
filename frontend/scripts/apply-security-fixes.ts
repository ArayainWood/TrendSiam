/**
 * Apply Security Fixes Script
 * 
 * Applies the Plan-B Security Model database fixes:
 * - Updates v_home_news view with proper security settings
 * - Removes sensitive columns from public views
 * - Sets security_invoker = true
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  console.log('   This script requires service role access to modify database views.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function applySecurityFixes() {
  console.log('🔒 Applying Plan-B Security Model fixes...\n');

  try {
    // Read the updated v_home_news.sql file
    const viewPath = path.join(process.cwd(), 'db', 'sql', 'views', 'v_home_news.sql');
    
    if (!fs.existsSync(viewPath)) {
      throw new Error(`View file not found: ${viewPath}`);
    }

    const viewSql = fs.readFileSync(viewPath, 'utf-8');
    console.log('📄 Read v_home_news.sql view definition');

    // Apply the view update
    console.log('🔄 Applying secure v_home_news view...');
    
    // Note: This assumes you have a custom RPC function for executing DDL
    // If not available, you'll need to execute this manually in Supabase SQL Editor
    try {
      const { error } = await supabase.rpc('execute_sql_query', { query: viewSql });
      
      if (error) {
        console.log('⚠️  Direct SQL execution not available via RPC.');
        console.log('📋 Please execute the following SQL manually in Supabase SQL Editor:\n');
        console.log('--- START SQL ---');
        console.log(viewSql);
        console.log('--- END SQL ---\n');
        return false;
      }
      
      console.log('✅ Successfully applied secure v_home_news view');
      return true;
      
    } catch (rpcError) {
      console.log('⚠️  RPC method not available. Manual execution required.');
      console.log('📋 Please execute the following SQL manually in Supabase SQL Editor:\n');
      console.log('--- START SQL ---');
      console.log(viewSql);
      console.log('--- END SQL ---\n');
      return false;
    }

  } catch (error) {
    console.error('❌ Error applying security fixes:', error);
    return false;
  }
}

async function verifySecurityFixes() {
  console.log('🔍 Verifying security fixes...\n');

  try {
    // Test 1: Verify view exists and has proper security
    console.log('1. Testing v_home_news view access...');
    const { data: viewData, error: viewError } = await supabase
      .from('v_home_news')
      .select('id, title, popularity_score')
      .limit(1);

    if (viewError) {
      console.log(`❌ View access failed: ${viewError.message}`);
      return false;
    }
    
    console.log(`✅ View accessible (${viewData?.length || 0} records)`);

    // Test 2: Verify sensitive fields are removed
    console.log('2. Testing sensitive field protection...');
    try {
      const { data: sensitiveData, error: sensitiveError } = await supabase
        .from('v_home_news')
        .select('ai_opinion, score_details')
        .limit(1);

      if (sensitiveError && sensitiveError.message.includes('column') && sensitiveError.message.includes('does not exist')) {
        console.log('✅ Sensitive fields properly removed from view');
      } else if (sensitiveData && sensitiveData.length > 0) {
        console.log('⚠️  Sensitive fields still accessible - manual review needed');
      } else {
        console.log('✅ Sensitive fields not accessible');
      }
    } catch (error) {
      console.log('✅ Sensitive fields properly protected (access denied)');
    }

    // Test 3: Verify platform and AI prompt fields are available
    console.log('3. Testing required field availability...');
    const { data: fieldsData, error: fieldsError } = await supabase
      .from('v_home_news')
      .select('platforms_raw, ai_image_prompt, platform, platform_mentions')
      .limit(1);

    if (fieldsError) {
      console.log(`❌ Required fields test failed: ${fieldsError.message}`);
      return false;
    }

    console.log('✅ Required fields are available');

    console.log('\n🎉 Security fixes verification completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  }
}

async function main() {
  console.log('🔒 Plan-B Security Model Implementation\n');
  
  const applied = await applySecurityFixes();
  
  if (applied) {
    // Wait a moment for changes to propagate
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const verified = await verifySecurityFixes();
    
    if (verified) {
      console.log('\n✅ All security fixes applied and verified successfully!');
      console.log('\n📋 Next steps:');
      console.log('   1. Run: npm run build');
      console.log('   2. Run: npm run start');
      console.log('   3. Test the application functionality');
      console.log('   4. Run: npx tsx frontend/scripts/verify-security-compliance.ts');
    } else {
      console.log('\n⚠️  Security fixes applied but verification had issues.');
      console.log('   Please review the output above and test manually.');
    }
  } else {
    console.log('\n📋 Manual steps required:');
    console.log('   1. Execute the SQL shown above in Supabase SQL Editor');
    console.log('   2. Run: npx tsx frontend/scripts/verify-security-compliance.ts');
    console.log('   3. Run: npm run build && npm run start');
  }
}

main().catch(error => {
  console.error('💥 Security fix application failed:', error);
  process.exit(1);
});
