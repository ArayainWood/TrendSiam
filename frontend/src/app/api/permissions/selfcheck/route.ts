/**
 * Permissions Self-Check API
 * 
 * Lightweight health probe to verify Plan-B security model:
 * - anon can access public_v_* views
 * - anon cannot access base tables
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PermissionCheck {
  table: string;
  expected: 'allowed' | 'denied';
  actual: 'allowed' | 'denied';
  passed: boolean;
  error?: string;
}

interface SelfCheckResult {
  views_ok: boolean;
  base_tables_denied: boolean;
  details: PermissionCheck[];
  timestamp: string;
  environment: 'development' | 'production';
}

function getAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createClient(url, anon, {
    auth: { persistSession: false },
  });
}

export async function GET() {
  const supabase = getAnonClient();
  const checks: PermissionCheck[] = [];
  const isDev = process.env.NODE_ENV === 'development';
  
  // Define what to check
  const viewsToCheck = [
    'public_v_system_meta',
    'public_v_home_news',
    'public_v_ai_images_latest'
  ];
  
  const tablesToCheck = [
    'system_meta',
    'news_trends',
    'ai_images',
    'snapshots',
    'stories'
  ];
  
  // Additional test: Check if public_v_home_news can read config
  let homeViewCanReadConfig = false;
  try {
    const { data, error } = await supabase
      .from('public_v_home_news')
      .select('id, title')
      .limit(1);
    
    if (!error) {
      homeViewCanReadConfig = true;
    }
  } catch (e) {
    // Expected to work if view is properly configured
  }
  
  // Check views (should be accessible)
  for (const viewName of viewsToCheck) {
    try {
      const { error } = await supabase
        .from(viewName)
        .select('*')
        .limit(1);
      
      checks.push({
        table: viewName,
        expected: 'allowed',
        actual: error ? 'denied' : 'allowed',
        passed: !error,
        error: error?.message
      });
    } catch (e) {
      checks.push({
        table: viewName,
        expected: 'allowed',
        actual: 'denied',
        passed: false,
        error: e instanceof Error ? e.message : 'Unknown error'
      });
    }
  }
  
  // Check base tables (should be denied)
  for (const tableName of tablesToCheck) {
    try {
      const { error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      // For base tables, we expect an error (permission denied)
      const wasAllowed = !error;
      
      checks.push({
        table: tableName,
        expected: 'denied',
        actual: wasAllowed ? 'allowed' : 'denied',
        passed: !wasAllowed, // Pass if access was denied
        error: error?.message
      });
    } catch (e) {
      // Exception also counts as denied (which is good for base tables)
      checks.push({
        table: tableName,
        expected: 'denied',
        actual: 'denied',
        passed: true,
        error: e instanceof Error ? e.message : 'Unknown error'
      });
    }
  }
  
  // Calculate summary
  const viewChecks = checks.filter(c => c.table.startsWith('public_v_'));
  const tableChecks = checks.filter(c => !c.table.startsWith('public_v_'));
  
  const views_ok = viewChecks.every(c => c.passed);
  const base_tables_denied = tableChecks.every(c => c.passed);
  
  const result: SelfCheckResult = {
    views_ok,
    base_tables_denied,
    details: isDev ? checks : checks.filter(c => !c.passed), // In prod, only show failures
    timestamp: new Date().toISOString(),
    environment: isDev ? 'development' : 'production',
    // Add extra diagnostic info
    home_view_status: homeViewCanReadConfig ? 'ok' : 'config_read_failed'
  } as SelfCheckResult & { home_view_status: string };
  
  // Log issues if any
  if (!views_ok || !base_tables_denied) {
    console.error('[permissions/selfcheck] Security issues detected:', {
      views_ok,
      base_tables_denied,
      failures: checks.filter(c => !c.passed).map(c => ({
        table: c.table,
        issue: c.expected === 'allowed' ? 'should be accessible' : 'should be denied'
      }))
    });
  }
  
  return NextResponse.json(result, {
    status: views_ok && base_tables_denied ? 200 : 500,
    headers: {
      'Cache-Control': 'no-store',
      'X-Security-Check': views_ok && base_tables_denied ? 'passed' : 'failed'
    }
  });
}
