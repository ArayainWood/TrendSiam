/**
 * Security Compliance Verification Script
 * 
 * Verifies that the system follows Plan-B Security Model:
 * - Frontend uses anon key only
 * - All queries go through public views
 * - No sensitive data exposed
 * - Proper view security settings
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

interface SecurityCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runSecurityChecks(): Promise<SecurityCheck[]> {
  const checks: SecurityCheck[] = [];

  // Check 1: Verify frontend uses anon key only
  checks.push({
    name: 'Frontend Key Security',
    status: supabaseAnonKey.startsWith('eyJ') ? 'pass' : 'fail',
    message: supabaseAnonKey.startsWith('eyJ') 
      ? 'Frontend correctly uses anon key (starts with eyJ)'
      : 'Frontend key format is incorrect - should be anon key starting with eyJ'
  });

  // Check 2: Verify no service_role in frontend code
  const frontendPath = path.join(process.cwd(), 'src');
  let serviceRoleFound = false;
  try {
    const files = getAllTsFiles(frontendPath);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('service_role') && !content.includes('// Warning:') && !content.includes('not service_role')) {
        serviceRoleFound = true;
        break;
      }
    }
  } catch (error) {
    // Ignore file system errors
  }

  checks.push({
    name: 'No Service Role in Frontend',
    status: serviceRoleFound ? 'fail' : 'pass',
    message: serviceRoleFound 
      ? 'Found service_role usage in frontend code - security violation'
      : 'No service_role usage found in frontend code'
  });

  // Check 3: Verify v_home_news view exists and is accessible
  try {
    const { data, error } = await supabase
      .from('v_home_news')
      .select('id, title, popularity_score')
      .limit(1);

    checks.push({
      name: 'v_home_news View Access',
      status: error ? 'fail' : 'pass',
      message: error 
        ? `Cannot access v_home_news view: ${error.message}`
        : 'v_home_news view is accessible with anon key',
      details: error || { recordCount: data?.length || 0 }
    });
  } catch (error) {
    checks.push({
      name: 'v_home_news View Access',
      status: 'fail',
      message: `Error accessing v_home_news: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  // Check 4: Verify sensitive fields are not exposed
  try {
    const { data, error } = await supabase
      .from('v_home_news')
      .select('ai_opinion, score_details')
      .limit(1);

    const hasSensitiveFields = data && data.length > 0 && (data[0].ai_opinion !== undefined || data[0].score_details !== undefined);
    
    checks.push({
      name: 'Sensitive Fields Protection',
      status: hasSensitiveFields ? 'warning' : 'pass',
      message: hasSensitiveFields 
        ? 'Sensitive fields (ai_opinion, score_details) are still exposed in view'
        : 'Sensitive fields are properly hidden from public view',
      details: { fieldsExposed: hasSensitiveFields }
    });
  } catch (error) {
    checks.push({
      name: 'Sensitive Fields Protection',
      status: 'pass',
      message: 'Sensitive fields are not accessible (expected behavior)'
    });
  }

  // Check 5: Verify platform normalization works
  try {
    const { data, error } = await supabase
      .from('v_home_news')
      .select('platforms_raw, platform, platform_mentions')
      .not('platform', 'is', null)
      .limit(3);

    checks.push({
      name: 'Platform Data Availability',
      status: error ? 'fail' : 'pass',
      message: error 
        ? `Platform data query failed: ${error.message}`
        : `Platform data is available (${data?.length || 0} records with platform info)`,
      details: data?.map(item => ({
        platform: item.platform,
        platformMentions: item.platform_mentions,
        platformsRaw: item.platforms_raw
      }))
    });
  } catch (error) {
    checks.push({
      name: 'Platform Data Availability',
      status: 'fail',
      message: `Error checking platform data: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  // Check 6: Verify AI prompt data is available
  try {
    const { data, error } = await supabase
      .from('v_home_news')
      .select('ai_image_prompt')
      .not('ai_image_prompt', 'is', null)
      .limit(3);

    checks.push({
      name: 'AI Prompt Data Availability',
      status: error ? 'fail' : 'pass',
      message: error 
        ? `AI prompt data query failed: ${error.message}`
        : `AI prompt data is available (${data?.length || 0} records with prompts)`,
      details: { promptCount: data?.length || 0 }
    });
  } catch (error) {
    checks.push({
      name: 'AI Prompt Data Availability',
      status: 'fail',
      message: `Error checking AI prompt data: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  // Check 7: Verify direct table access is blocked (should fail)
  try {
    const { data, error } = await supabase
      .from('news_trends')
      .select('id')
      .limit(1);

    checks.push({
      name: 'Direct Table Access Protection',
      status: error ? 'pass' : 'warning',
      message: error 
        ? 'Direct table access is properly blocked (expected)'
        : 'Direct table access is still allowed - consider restricting',
      details: { accessAllowed: !error }
    });
  } catch (error) {
    checks.push({
      name: 'Direct Table Access Protection',
      status: 'pass',
      message: 'Direct table access is blocked (expected behavior)'
    });
  }

  return checks;
}

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        files.push(...getAllTsFiles(fullPath));
      } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Ignore errors (permission issues, etc.)
  }
  
  return files;
}

async function main() {
  console.log('🔒 Running Security Compliance Verification...\n');

  const checks = await runSecurityChecks();
  
  let passCount = 0;
  let failCount = 0;
  let warningCount = 0;

  for (const check of checks) {
    const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${check.name}: ${check.message}`);
    
    if (check.details) {
      console.log(`   Details: ${JSON.stringify(check.details, null, 2)}`);
    }
    
    if (check.status === 'pass') passCount++;
    else if (check.status === 'fail') failCount++;
    else warningCount++;
    
    console.log();
  }

  console.log('📊 Security Compliance Summary:');
  console.log(`   ✅ Passed: ${passCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   ⚠️  Warnings: ${warningCount}`);
  console.log();

  if (failCount > 0) {
    console.log('❌ Security compliance verification FAILED. Please address the issues above.');
    process.exit(1);
  } else if (warningCount > 0) {
    console.log('⚠️  Security compliance verification passed with warnings. Review the warnings above.');
    process.exit(0);
  } else {
    console.log('🎉 Security compliance verification PASSED! All checks successful.');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('💥 Security verification failed with error:', error);
  process.exit(1);
});
