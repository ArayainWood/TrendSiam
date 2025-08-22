/**
 * Build Weekly Snapshot API
 * 
 * Protected endpoint to trigger snapshot builds
 * Can be called by cron jobs or admin tools
 */

import { buildWeeklySnapshot } from '@/lib/data/snapshotBuilder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Simple auth check - enhance as needed
function isAuthorized(request: Request): boolean {
  // Check for build token in header
  const buildToken = request.headers.get('X-Build-Token');
  const expectedToken = process.env.SNAPSHOT_BUILD_TOKEN;
  
  // If no token is configured, allow from localhost only (dev mode)
  if (!expectedToken) {
    const host = request.headers.get('host') || '';
    return host.includes('localhost') || host.includes('127.0.0.1');
  }
  
  return buildToken === expectedToken;
}

export async function POST(request: Request) {
  // Check authorization
  if (!isAuthorized(request)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  try {
    // Parse options
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun === true;
    
    console.log('[build-snapshot] API triggered:', { dryRun });
    
    // Build snapshot
    const result = await buildWeeklySnapshot(dryRun);
    
    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('[build-snapshot] API error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Build failed'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// GET method returns build status/info
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  return new Response(
    JSON.stringify({
      endpoint: '/api/weekly/build-snapshot',
      method: 'POST',
      description: 'Trigger a new weekly snapshot build',
      options: {
        dryRun: 'boolean - If true, simulate build without saving'
      },
      authorization: 'Required: X-Build-Token header'
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
