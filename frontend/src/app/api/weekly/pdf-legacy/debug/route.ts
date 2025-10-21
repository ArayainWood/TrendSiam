/**
 * Weekly PDF Debug Endpoint
 * 
 * Provides diagnostic information about snapshot availability for PDF generation
 */

import { fetchWeeklySnapshot } from '@/lib/data/weeklySnapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const snapshotId = url.searchParams.get('snapshot');
  
  try {
    console.log('[weekly-pdf-debug] Checking snapshot:', snapshotId || 'latest');
    
    const snapshotData = await fetchWeeklySnapshot(snapshotId || undefined);
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      requestedSnapshot: snapshotId || 'latest',
      snapshotFound: snapshotData.success,
      snapshotId: snapshotData.snapshotId,
      itemsCount: snapshotData.items?.length || 0,
      hasItems: (snapshotData.items?.length || 0) > 0,
      builtAt: snapshotData.builtAt,
      rangeStart: snapshotData.rangeStart,
      rangeEnd: snapshotData.rangeEnd,
      error: snapshotData.error,
      metrics: snapshotData.metrics,
      canGeneratePDF: snapshotData.success && (snapshotData.items?.length || 0) > 0
    };
    
    return new Response(JSON.stringify(diagnostics, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-TS-API': 'weekly-pdf-debug-v1'
      }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      timestamp: new Date().toISOString(),
      requestedSnapshot: snapshotId || 'latest',
      error: 'Debug check failed',
      details: error instanceof Error ? error.message : String(error)
    }, null, 2), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-TS-API': 'weekly-pdf-debug-v1'
      }
    });
  }
}
