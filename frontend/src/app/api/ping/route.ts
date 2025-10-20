export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() })
}
