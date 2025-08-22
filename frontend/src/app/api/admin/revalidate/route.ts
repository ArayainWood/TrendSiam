/**
 * Admin Revalidation API
 * 
 * Secure endpoint to trigger revalidation of specific paths
 * Protected by secret header
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

// Secret for authentication (should match REVALIDATE_SECRET env var)
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET;

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('x-revalidate-secret');
    
    if (!REVALIDATE_SECRET || !authHeader || authHeader !== REVALIDATE_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get path to revalidate from request body
    const body = await request.json();
    const { path } = body;
    
    if (!path || typeof path !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: path is required' },
        { status: 400 }
      );
    }
    
    // Validate path format
    if (!path.startsWith('/')) {
      return NextResponse.json(
        { error: 'Invalid path: must start with /' },
        { status: 400 }
      );
    }
    
    // Perform revalidation
    console.log(`[revalidate] Revalidating path: ${path}`);
    revalidatePath(path);
    
    // Special handling for weekly report
    if (path === '/weekly-report' || path === '/weekly') {
      // Also revalidate the API routes
      revalidatePath('/api/weekly');
      revalidatePath('/api/weekly/data');
      console.log('[revalidate] Also revalidated weekly API routes');
    }
    
    return NextResponse.json({
      success: true,
      revalidated: path,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[revalidate] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Also support GET for testing (with query params)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const secret = searchParams.get('secret');
  const path = searchParams.get('path');
  
  if (!REVALIDATE_SECRET || !secret || secret !== REVALIDATE_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  if (!path) {
    return NextResponse.json(
      { error: 'Path parameter is required' },
      { status: 400 }
    );
  }
  
  // Delegate to POST handler
  const mockRequest = new NextRequest(request.url, {
    method: 'POST',
    headers: {
      'x-revalidate-secret': secret,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ path })
  });
  
  return POST(mockRequest);
}
