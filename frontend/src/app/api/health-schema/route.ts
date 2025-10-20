/**
 * Health Check: Home View Schema
 * 
 * Purpose: Quick diagnostic endpoint to verify column availability
 * Usage: GET /api/health-schema?check=home_view
 * 
 * Returns:
 * - ok: true if view exists and has required columns
 * - viewName: canonical view name
 * - hasWebViewCount: whether web_view_count column exists
 * - version: current home_view_version from system_meta
 */

import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { HOME_SCHEMA, HOME_VIEW, HOME_COLUMNS } from '@/lib/db/schema-constants'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  return createClient(url, anon, {
    auth: { persistSession: false },
  })
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const check = searchParams.get('check') || 'home_view'
  
  if (check !== 'home_view') {
    return NextResponse.json({
      ok: false,
      error: `Unknown check: ${check}. Valid: home_view`
    }, { status: 400 })
  }
  
  try {
    const supabase = getClient()
    
    // Use RPC function to check column existence (avoids PostgREST info_schema issues)
    const { data: hasWebViewCount, error: rpcError } = await supabase.rpc('util_has_column', {
      view_name: HOME_VIEW,
      col_name: 'web_view_count'
    })
    
    if (rpcError) {
      return NextResponse.json({
        ok: false,
        viewName: HOME_VIEW,
        error: 'RPC check failed: ' + rpcError.message,
        checkedAt: new Date().toISOString()
      }, { status: 500 })
    }
    
    // Try to get column count via a sample query
    const { data: sampleData, error: sampleError } = await supabase
      .from(HOME_VIEW)
      .select('*')
      .limit(1)
      .single()
    
    const columnCount = sampleData ? Object.keys(sampleData).length : 0
    
    // Get system meta version
    const { data: metaData } = await supabase
      .from('public_v_system_meta' as any)
      .select('key, value')
      .in('key', ['home_view_version', 'home_view_canonical'])
    
    const version = metaData?.find((m: any) => m.key === 'home_view_version')?.value || 'unknown'
    const canonical = metaData?.find((m: any) => m.key === 'home_view_canonical')?.value || HOME_VIEW
    
    // Determine if view is healthy
    const ok = columnCount >= 26 && hasWebViewCount
    
    return NextResponse.json({
      ok,
      viewName: HOME_VIEW,
      canonicalView: canonical,
      schema: HOME_SCHEMA,
      columns: {
        total: columnCount,
        expected: HOME_COLUMNS.length,
        hasWebViewCount: hasWebViewCount === true,
        sampleKeys: sampleData ? Object.keys(sampleData).slice(0, 10) : []
      },
      version,
      checkedAt: new Date().toISOString(),
      message: ok 
        ? 'Schema healthy: all required columns present'
        : hasWebViewCount 
          ? 'Schema issue: column count mismatch'
          : 'Schema issue: web_view_count column missing'
    }, { 
      status: ok ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
    
  } catch (error: any) {
    console.error('[health-schema] Error:', error)
    return NextResponse.json({
      ok: false,
      viewName: HOME_VIEW,
      error: error.message || 'Health check failed',
      checkedAt: new Date().toISOString()
    }, { status: 500 })
  }
}
