/**
 * SECTION F - System Meta API
 * Lightweight endpoint to check system_meta values for auto-refresh
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  
  if (!key) {
    return NextResponse.json(
      { error: 'Key parameter required' },
      { status: 400 }
    );
  }
  
  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('system_meta')
      .select('value, updated_at')
      .eq('key', key)
      .single();
    
    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch system_meta: ${error.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      key,
      value: data?.value || null,
      updated_at: data?.updated_at || null,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'no-store',
        'X-TS-API': 'system-meta'
      }
    });
    
  } catch (error: any) {
    return NextResponse.json(
      { 
        error: 'System meta query failed',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
