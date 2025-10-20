// Simple diagnostics for Home API - uses only public views
import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { HOME_VIEW, HOME_COLUMNS } from '@/lib/db/schema-constants'

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

    // Sample row to infer available columns
    const sample = await supabase
      .from(HOME_VIEW)
      .select(HOME_COLUMNS.join(','))
      .limit(1)

    const sampleRow = sample.data?.[0] ?? {}
    const columnsFromView = Object.keys(sampleRow)
    const missingColumns = HOME_COLUMNS.filter(c => !columnsFromView.includes(c))
    const unexpectedColumns = columnsFromView.filter(c => !HOME_COLUMNS.includes(c as any))

    // Meta keys via public view (including freshness policy)
    const metaRes = await supabase
      .from('public_v_system_meta')
      .select('key, value, updated_at')
      .in('key', ['home_limit', 'top3_max', 'news_last_updated', 'home_freshness_policy', 'home_columns_hash'])

    const meta: Record<string, unknown> = {}
    if (metaRes.data && Array.isArray(metaRes.data)) {
      for (const row of metaRes.data) {
        meta[row.key] = row.value
      }
    }

    // Fetch some data to analyze
    const { data, error } = await supabase
      .from(HOME_VIEW)
      .select(HOME_COLUMNS.join(','))
      .order('rank', { ascending: true })
      .limit(10)

    if (error) {
      return NextResponse.json({
        success: false,
        fetchedCount: 0,
        error: error.message,
        missingColumns,
        unexpectedColumns
      }, { status: 200 })
    }

    const items = data || []
    
    // Sample titles
    const sampleTitles = items.slice(0, 3).map((item: any) => 
      item.title ? String(item.title).substring(0, 50) + '...' : '(no title)'
    )

    return NextResponse.json({
      success: true,
      fetchedCount: items.length,
      columnsFromView,
      missingColumns,
      unexpectedColumns,
      meta,
      sampleTitles,
      top3Count: items.filter((item: any) => item.is_top3).length,
      withImages: items.filter((item: any) => item.image_url).length,
      withPrompts: items.filter((item: any) => item.ai_prompt).length
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    })

  } catch (error) {
    console.error('[Home Diagnostics] Error:', error)
    return NextResponse.json({
      success: false,
      fetchedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}