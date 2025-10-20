export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

function reqEnv(n: string) { const v = process.env[n]; if (!v) throw new Error(`Missing env: ${n}`); return v }

export async function GET() {
  try {
    const base = reqEnv('NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
    const anon = reqEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    const url = `${base}/rest/v1/public_v_home_news?select=*&order=published_date.desc&order=created_at.desc&limit=20`
    const res = await fetch(url, { headers: { apikey: anon, Authorization: `Bearer ${anon}` }, cache: 'no-store' })
    const body = await res.json()
    if (!res.ok) return NextResponse.json({ data: [], error: body?.message ?? 'REST error' })
    return NextResponse.json({ data: Array.isArray(body) ? body : [] })
  } catch (e: any) {
    return NextResponse.json({ data: [], error: String(e?.message ?? e) })
  }
}
