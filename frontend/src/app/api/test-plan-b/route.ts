/**
 * Plan-B Security Test API
 * 
 * Validates that anon users can only access public views, not base tables
 * Used for security compliance testing
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PlanBTestResult {
  ok: boolean;
  summary: string;
  tests: {
    name: string;
    expected: 'success' | 'failure';
    actual: 'success' | 'failure';
    passed: boolean;
    details: string;
  }[];
  security_score: number;
}

export async function GET(): Promise<NextResponse<PlanBTestResult>> {
  const result: PlanBTestResult = {
    ok: true,
    summary: '',
    tests: [],
    security_score: 0
  };

  // Create anon client (what frontend uses)
  const anonSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const tests = [
    // These should SUCCEED (anon can access views)
    {
      name: 'Access public_v_home_news view',
      expected: 'success' as const,
      query: () => anonSupabase.from('public_v_home_news').select('count', { count: 'exact', head: true })
    },
    {
      name: 'Access public_v_weekly_stats view',
      expected: 'success' as const,
      query: () => anonSupabase.from('public_v_weekly_stats').select('total_stories').limit(1)
    },
    {
      name: 'Access public_v_weekly_snapshots view',
      expected: 'success' as const,
      query: () => anonSupabase.from('public_v_weekly_snapshots').select('count', { count: 'exact', head: true })
    },
    {
      name: 'Access public_v_system_meta view',
      expected: 'success' as const,
      query: () => anonSupabase.from('public_v_system_meta').select('key, value').eq('key', 'news_last_updated')
    },

    // These should FAIL (anon blocked from base tables)
    {
      name: 'Access news_trends base table',
      expected: 'failure' as const,
      query: () => anonSupabase.from('news_trends').select('count', { count: 'exact', head: true })
    },
    {
      name: 'Access stories base table',
      expected: 'failure' as const,
      query: () => anonSupabase.from('stories').select('count', { count: 'exact', head: true })
    },
    {
      name: 'Access snapshots base table',
      expected: 'failure' as const,
      query: () => anonSupabase.from('snapshots').select('count', { count: 'exact', head: true })
    },
    {
      name: 'Access weekly_report_snapshots base table',
      expected: 'failure' as const,
      query: () => anonSupabase.from('weekly_report_snapshots').select('count', { count: 'exact', head: true })
    },
    {
      name: 'Access image_files base table',
      expected: 'failure' as const,
      query: () => anonSupabase.from('image_files').select('count', { count: 'exact', head: true })
    },
    {
      name: 'Access ai_images base table',
      expected: 'failure' as const,
      query: () => anonSupabase.from('ai_images').select('count', { count: 'exact', head: true })
    },
    {
      name: 'Access system_meta base table',
      expected: 'failure' as const,
      query: () => anonSupabase.from('system_meta').select('count', { count: 'exact', head: true })
    }
  ];

  let passedTests = 0;

  for (const test of tests) {
    try {
      const { error } = await test.query();
      const actual = error ? 'failure' : 'success';
      const passed = actual === test.expected;
      
      if (passed) passedTests++;

      result.tests.push({
        name: test.name,
        expected: test.expected,
        actual,
        passed,
        details: error ? `Error: ${error.message}` : 'Query succeeded'
      });

    } catch (err) {
      const passed = test.expected === 'failure';
      if (passed) passedTests++;

      result.tests.push({
        name: test.name,
        expected: test.expected,
        actual: 'failure',
        passed,
        details: `Exception: ${err instanceof Error ? err.message : 'Unknown error'}`
      });
    }
  }

  result.security_score = Math.round((passedTests / tests.length) * 100);
  result.ok = result.security_score >= 90; // 90% pass rate required

  if (result.ok) {
    result.summary = `✅ Plan-B Security Model compliant (${result.security_score}% pass rate)`;
  } else {
    result.summary = `❌ Plan-B Security Model violations detected (${result.security_score}% pass rate)`;
  }

  return NextResponse.json(result);
}
