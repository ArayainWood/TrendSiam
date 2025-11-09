/**
 * Health Check API
 * 
 * Provides system diagnostics including:
 * - Database connectivity
 * - Table counts
 * - Latest snapshot info
 * - Server time and timezone
 */

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { withErrorHandler, createErrorResponse } from '@/lib/api/errorHandler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const t0 = Date.now();
  const diagnostics: any = {
    status: 'checking',
    timestamp: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    database: {
      connected: false,
      news_trends: { count: 0, recent: 0 },
      weekly_report_snapshots: { exists: false, count: 0, latest: null }
    },
    errors: []
  };

  try {
    const supa = getSupabaseAdmin();
    
    // Test basic connectivity
    const { error: pingError } = await supa
      .from('news_trends')
      .select('id', { count: 'exact', head: true });
    
    if (!pingError) {
      diagnostics.database.connected = true;
    } else {
      diagnostics.errors.push(`Database connection error: ${pingError.message}`);
    }
    
    // Get news_trends count and recent items
    if (diagnostics.database.connected) {
      const { count: totalCount } = await supa
        .from('news_trends')
        .select('*', { count: 'exact', head: true });
      
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 7);
      
      const { count: recentCount } = await supa
        .from('news_trends')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', recentDate.toISOString());
      
      diagnostics.database.news_trends = {
        count: totalCount || 0,
        recent: recentCount || 0
      };
    }
    
    // Check weekly_report_snapshots table
    try {
      const { data: snapshotCheck, error: snapshotError } = await supa
        .from('weekly_report_snapshots')
        .select('snapshot_id', { count: 'exact', head: true });
      
      if (!snapshotError) {
        diagnostics.database.weekly_report_snapshots.exists = true;
        
        // Get count
        const { count } = await supa
          .from('weekly_report_snapshots')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'published');
        
        diagnostics.database.weekly_report_snapshots.count = count || 0;
        
        // Get latest snapshot info
        const { data: latest } = await supa
          .from('weekly_report_snapshots')
          .select('snapshot_id, built_at, range_start, range_end, item_count')
          .eq('status', 'published')
          .order('built_at', { ascending: false })
          .limit(1)
          .single();
        
        if (latest) {
          diagnostics.database.weekly_report_snapshots.latest = {
            id: latest.snapshot_id,
            built_at: latest.built_at,
            range: `${latest.range_start} to ${latest.range_end}`,
            items: latest.item_count || 0
          };
        }
      } else {
        diagnostics.database.weekly_report_snapshots.exists = false;
        diagnostics.errors.push(`Snapshots table error: ${snapshotError.message}`);
      }
    } catch (e: any) {
      diagnostics.database.weekly_report_snapshots.exists = false;
      diagnostics.errors.push(`Snapshots table check failed: ${e.message}`);
    }
    
    // Check date formatting
    const now = new Date();
    const bangkokTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(now);
    
    diagnostics.dates = {
      server: now.toISOString(),
      bangkok: bangkokTime,
      utcOffset: -now.getTimezoneOffset() / 60
    };
    
    // Overall status
    diagnostics.status = diagnostics.errors.length === 0 ? 'healthy' : 'degraded';
    diagnostics.processingTime = Date.now() - t0;
    
    return new Response(JSON.stringify(diagnostics, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
    
  } catch (error: any) {
    diagnostics.status = 'error';
    diagnostics.errors.push(process.env.NODE_ENV === 'production' ? 'Fatal error' : `Fatal error: ${error.message}`);
    diagnostics.processingTime = Date.now() - t0;
    
    return new Response(JSON.stringify(diagnostics, null, 2), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }
}
