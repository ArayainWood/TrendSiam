// Simple ping endpoint for home view health check
import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
  try {
    const supabase = getClient()
    
    // Simple count query on the view
    const { count, error } = await supabase
      .from('public_v_home_news')
      .select('*', { count: 'exact', head: true })
    
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 503 }
      )
    }
    
    return NextResponse.json({
      ok: true,
      rows: count ?? 0,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
