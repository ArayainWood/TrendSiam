/**
 * Revalidation API Route for Cache Busting
 * 
 * Allows Python pipeline to trigger UI cache refresh after DB updates
 * Supports tag-based revalidation for Next.js cache invalidation
 */

import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tag = searchParams.get('tag');
    const token = searchParams.get('token');
    
    // [data-freshness] Verify revalidation token
    const revalidateSecret = process.env.REVALIDATE_SECRET;
    if (!revalidateSecret) {
      console.error('[data-freshness] REVALIDATE_SECRET not configured');
      return NextResponse.json(
        { ok: false, error: 'Revalidation not configured' },
        { status: 500 }
      );
    }
    
    if (!token || token !== revalidateSecret) {
      console.warn('[data-freshness] Invalid revalidation token attempt');
      return NextResponse.json(
        { ok: false, error: 'Invalid token' },
        { status: 401 }
      );
    }
    
    if (!tag) {
      return NextResponse.json(
        { ok: false, error: 'Tag parameter required' },
        { status: 400 }
      );
    }
    
    // [data-freshness] Revalidate specific tag
    console.log(`[data-freshness] Revalidating cache tag: ${tag}`);
    revalidateTag(tag);
    
    const response = {
      ok: true,
      tag,
      timestamp: new Date().toISOString(),
      revalidated: true
    };
    
    console.log(`[data-freshness] Cache revalidation successful: ${tag}`);
    
    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'X-TS-Revalidate': 'success',
      }
    });
    
  } catch (error: any) {
    console.error('[data-freshness] Revalidation error:', error);
    
    return NextResponse.json(
      { 
        ok: false, 
        error: error?.message || 'Revalidation failed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Support POST method as well for flexibility
export async function POST(request: NextRequest) {
  return GET(request);
}