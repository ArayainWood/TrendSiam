/**
 * [weekly-db-fix] Temporary health route for debugging DB connectivity
 * Can be deleted after verification
 */

import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs'; // [weekly-db-fix] Force nodejs runtime for DB operations
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // [weekly-db-fix] Use admin client for health check
    const supa = getSupabaseAdmin();
    
    // [weekly-db-fix] Run minimal count query on main weekly table
    console.log('[db-health] Testing news_trends table connectivity...');
    const { count, error } = await supa
      .from('public_v_home_news')
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.error('[db-health] Query failed:', error.message);
      return new Response(JSON.stringify({
        ok: false,
        message: `Database query failed: ${error.message}`,
        table: 'news_trends',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store' // [weekly-db-fix] No caching for health checks
        }
      });
    }

    console.log(`[db-health] Success: ${count} rows available`);
    return new Response(JSON.stringify({
      ok: true,
      count: count || 0,
      table: 'news_trends',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store' // [weekly-db-fix] No caching for health checks
      }
    });

  } catch (error: any) {
    console.error('[db-health] Health check failed:', error?.message || error);
    return new Response(JSON.stringify({
      ok: false,
      message: `Health check failed: ${error?.message || 'Unknown error'}`,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store' // [weekly-db-fix] No caching for health checks
      }
    });
  }
}
