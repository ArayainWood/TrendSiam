export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const envOk = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }
    const supabase = createClient()

    const hv = await supabase.from('public_v_home_news').select('id').limit(1)
    const ws = await supabase.from('public_v_weekly_stats').select('week').limit(1)
    const sn = await supabase.from('public_v_weekly_snapshots').select('snapshot_id,items_count,updated_at').limit(1)

    const ok =
      envOk.NEXT_PUBLIC_SUPABASE_URL &&
      envOk.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      !hv.error && !ws.error && !sn.error

    return NextResponse.json({
      ok,
      envOk,
      home: { error: hv.error ?? null, count: hv.data?.length ?? 0 },
      weekly: { error: ws.error ?? null, count: ws.data?.length ?? 0 },
      snapshots: { error: sn.error ?? null, count: sn.data?.length ?? 0 },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, fatal: String(e?.message ?? e) }, { status: 500 })
  }
}
