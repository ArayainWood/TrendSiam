export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function ok<T>(data: T) { return NextResponse.json({ success: true, data }) }
function fail(message: string, extra?: any) {
  console.error('[API /snapshots] error:', message, extra ?? '')
  return NextResponse.json({ success: false, data: [], error: message })
}

export async function GET() {
  try {
    const supabase = createClient()
    const q = await supabase
      .from('public_v_weekly_snapshots')
      .select(`
        snapshot_id,
        status,
        range_start,
        range_end,
        created_at,
        built_at,
        updated_at,
        items_count,
        items,
        meta,
        is_ready
      `)
      .order('created_at', { ascending: false })
      .limit(20)

    if (q.error) return fail(q.error.message, q.error)

    const rows = (q.data ?? []).map((x: any) => ({
      ...x,
      items_count: typeof x.items_count === 'number' ? x.items_count : 0,
      updated_at: x.updated_at ?? x.created_at,
    }))
    return ok(rows)
  } catch (e: any) {
    return fail(String(e?.message ?? e))
  }
}
