/**
 * Home Data API v5
 * 
 * Home-specific endpoint that shows only today's batch (Asia/Bangkok timezone)
 * No longer shares data logic with Weekly Report
 */

import { fetchHomeData } from '@/lib/data/homeDataSecure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') ?? 20);
  const diag = url.searchParams.get('diagnostics') === '1';
  const t0 = Date.now();
  
  // Use home-specific fetcher for today's data only
  const data = await fetchHomeData(limit, diag);
  
  if (diag) {
    console.log(`[Home API] source=${data.source} limit=${limit} date=${data.metrics?.date}`);
    if (data.items && data.items.length >= 3) {
      console.log('[Home API] top3', data.items.slice(0, 3).map((item: any) => ({
        id: item.id,
        score: item.popularity_score_precise,
        hasImage: !!item.display_image_url
      })));
    }
  }
  
  // Transform for Home API response format
  const homeResponse = {
    success: data.success,
    data: data.items, // Home API uses 'data' instead of 'items'
    source: data.source,
    generatedAt: data.generatedAt,
    metrics: data.metrics,
    error: data.error,
    diagnostics: data.diagnostics
  };
  
  return new Response(JSON.stringify(homeResponse), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-TS-API': 'home-v5',
      'X-TS-Source': data.source,
      'X-TS-Date': data.metrics?.date || 'unknown',
      'X-TS-Processing-Time': String(Date.now()-t0),
    },
  });
}