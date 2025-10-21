/**
 * Weekly Report Data API v5
 * 
 * Returns data from the snapshot system
 */

import { fetchWeeklySnapshot } from '@/lib/data/weeklySnapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0; // [rank-img-investigation] Disable stale cache

export async function GET(req: Request) {
  const url = new URL(req.url);
  const snapshotId = url.searchParams.get('snapshot');
  const t0 = Date.now();
  
  // Fetch from snapshot system
  const snapshotData = await fetchWeeklySnapshot(snapshotId || undefined);
  
  // Transform to API response format for backward compatibility
  const responseData = {
    items: snapshotData.items,
    metrics: snapshotData.metrics,
    generatedAt: snapshotData.builtAt,
    source: snapshotData.source,
    success: snapshotData.success,
    error: snapshotData.error,
    // Additional snapshot info
    snapshotId: snapshotData.snapshotId,
    rangeStart: snapshotData.rangeStart,
    rangeEnd: snapshotData.rangeEnd
  };

  return new Response(JSON.stringify(responseData), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-TS-API': 'weekly-v6-snapshot',
      'X-TS-Source': snapshotData.source,
      'X-TS-Snapshot-ID': snapshotData.snapshotId,
      'X-TS-Processing-Time': String(Date.now()-t0),
    },
  });
}