/**
 * Database Health Check API (Alternative without underscore)
 * 
 * Verifies Supabase connection and weekly_public_view accessibility
 */

import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { HealthCheckResponse } from '@/types/weekly';

export async function GET() {
  const startTime = Date.now();
  console.log('[health/db] 🔍 Database health check started');
  
  let response: HealthCheckResponse = {
    ok: false,
    timestamp: new Date().toISOString()
  };

  try {
    const supabase = getSupabaseAdmin();
    
    // Test 1: Basic connection
    console.log('[health/db] Testing basic connection...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('weekly_public_view')
      .select('count', { count: 'exact', head: true });

    if (connectionError) {
      throw new Error(`Connection failed: ${connectionError.message}`);
    }

    // Test 2: Check if view exists and has data
    console.log('[health/db] Testing weekly_public_view...');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { count: rowCount, error: countError } = await supabase
      .from('weekly_public_view')
      .select('*', { count: 'exact', head: true })
      .gte('published_at', sevenDaysAgo.toISOString());

    if (countError) {
      throw new Error(`View query failed: ${countError.message}`);
    }

    response = {
      ok: true,
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        viewExists: true,
        rowCount: rowCount || 0
      }
    };

    const elapsedTime = Date.now() - startTime;
    console.log(`[health/db] ✅ Health check passed: ${rowCount || 0} rows available (${elapsedTime}ms)`);

  } catch (error: any) {
    const elapsedTime = Date.now() - startTime;
    console.error(`[health/db] ❌ Health check failed: ${error.message} (${elapsedTime}ms)`);
    
    response = {
      ok: false,
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        viewExists: false
      },
      error: error.message
    };
  }

  const status = response.ok ? 200 : 503;
  
  return NextResponse.json(response, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-TS-API': 'health-db-v1'
    }
  });
}
