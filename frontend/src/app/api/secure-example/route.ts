import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateRequest, sanitizeString } from '@/lib/validation/schemas';

// Define request schema
const requestSchema = z.object({
  query: z.string().min(1).max(100),
  category: z.enum(['all', 'news', 'entertainment', 'sports']).optional(),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

// Example of a secure API endpoint with proper validation
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    
    // Validate request
    const validation = validateRequest(requestSchema, searchParams);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error },
        { status: 400 }
      );
    }
    
    const { query, category, limit } = validation.data;
    
    // Sanitize query string
    const sanitizedQuery = sanitizeString(query);
    
    // TODO: Implement actual search logic here
    // This is just an example response
    const results = {
      query: sanitizedQuery,
      category: category || 'all',
      limit,
      results: [],
      timestamp: new Date().toISOString(),
    };
    
    // Return with cache headers
    return NextResponse.json(results, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    });
    
  } catch (error) {
    console.error('[API] Search error:', error);
    
    // Don't leak internal errors
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Example POST endpoint with body validation
export async function POST(request: NextRequest) {
  try {
    // Check content type
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 400 }
      );
    }
    
    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }
    
    // Validate body
    const validation = validateRequest(requestSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error },
        { status: 400 }
      );
    }
    
    // Process request...
    
    return NextResponse.json(
      { success: true, data: validation.data },
      { status: 201 }
    );
    
  } catch (error) {
    console.error('[API] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Disable body size limit for this route
export const maxDuration = 30; // 30 second timeout
export const dynamic = 'force-dynamic'; // Disable static optimization
