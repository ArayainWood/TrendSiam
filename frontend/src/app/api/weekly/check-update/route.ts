/**
 * Check for newer weekly snapshots
 * 
 * Used by the client to poll for updates
 */

import { hasNewerSnapshot } from '@/lib/data/weeklySnapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const currentSnapshotId = url.searchParams.get('current');
    
    if (!currentSnapshotId) {
      return new Response(
        JSON.stringify({ error: 'Missing current snapshot ID' }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    const hasNewer = await hasNewerSnapshot(currentSnapshotId);
    
    return new Response(
      JSON.stringify({ hasNewer }), 
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
    
  } catch (error) {
    console.error('[check-update] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to check for updates',
        hasNewer: false 
      }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
