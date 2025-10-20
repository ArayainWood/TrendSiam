export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function ok<T>(data: T) { return NextResponse.json({ success: true, data }) }
function fail(message: string, extra?: any) {
  console.error('[API /weekly] error:', message, extra ?? '')
  return NextResponse.json({ success: false, data: [], error: message })
}

export async function GET() {
  try {
    const supabase = createClient()
    const q = await supabase
      .from('public_v_weekly_stats')
      .select(`
        week,
        news_count,
        total_stories,
        stories_with_images,
        avg_popularity_score,
        last_updated,
        total_views,
        total_likes
      `)
      .order('week', { ascending: false })

    if (q.error) return fail(q.error.message, q.error)
    return ok(q.data ?? [])
  } catch (e: any) {
    return fail(String(e?.message ?? e))
  }
}