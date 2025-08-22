import 'server-only'
import { NextResponse } from 'next/server'
import { getPublicSupabase } from '@/lib/supabasePublic'
import { NewsPublicViewSchema } from '@/lib/db/types/views'
import { fetchRecentNews, fetchNewsByDateRange } from '@/lib/db/repos/newsRepo'
import { getRecentDateRange } from '@/lib/utils/dateHelpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    stages: {}
  }
  
  const supabase = getPublicSupabase()
  
  try {
    // Stage 1: Raw count from view
    const { count: totalViewRows } = await supabase
      .from('news_public_v')
      .select('*', { count: 'exact', head: true })
    
    diagnostics.stages.total_view_rows = totalViewRows || 0
    
    // Stage 2: Check after time window filters
    const today = getRecentDateRange(24)
    const { data: todayData, count: todayCount } = await supabase
      .from('news_public_v')
      .select('*', { count: 'exact' })
      .gte('published_date', today.start.toISOString())
      .lte('published_date', today.end.toISOString())
      .limit(5)
    
    diagnostics.stages.after_time_window_24h = todayCount || 0
    
    // Stage 3: Check 7 day window
    const week = getRecentDateRange(7 * 24)
    const { count: weekCount } = await supabase
      .from('news_public_v')
      .select('*', { count: 'exact', head: true })
      .gte('published_date', week.start.toISOString())
      .lte('published_date', week.end.toISOString())
    
    diagnostics.stages.after_time_window_7d = weekCount || 0
    
    // Stage 4: Check validation
    const { data: rawData } = await supabase
      .from('news_public_v')
      .select('*')
      .order('popularity_score_precise', { ascending: false })
      .limit(20)
    
    let validCount = 0
    let invalidItems: any[] = []
    
    if (rawData) {
      for (const row of rawData) {
        try {
          NewsPublicViewSchema.parse(row)
          validCount++
        } catch (err: any) {
          invalidItems.push({
            id: row.id,
            title: row.title?.substring(0, 50),
            error: err.errors?.[0]?.message || err.message
          })
        }
      }
    }
    
    diagnostics.stages.after_validation = validCount
    diagnostics.stages.validation_errors = invalidItems
    
    // Stage 5: Check repo functions
    const recentResult = await fetchRecentNews(20)
    diagnostics.stages.repo_fetchRecentNews = {
      items: recentResult.items.length,
      totalCount: recentResult.totalCount,
      error: recentResult.error
    }
    
    // Stage 6: Check date range function
    const dateRangeResult = await fetchNewsByDateRange(today.start, today.end, 20)
    diagnostics.stages.repo_fetchNewsByDateRange_24h = {
      items: dateRangeResult.items.length,
      totalCount: dateRangeResult.totalCount,
      error: dateRangeResult.error
    }
    
    // Stage 7: Sample data
    if (rawData && rawData.length > 0) {
      diagnostics.sample_data = rawData.slice(0, 3).map(row => ({
        id: row.id,
        title: row.title,
        published_date: row.published_date,
        view_count: row.view_count,
        view_count_type: typeof row.view_count,
        like_count: row.like_count,
        like_count_type: typeof row.like_count,
        comment_count: row.comment_count,
        comment_count_type: typeof row.comment_count,
        popularity_score: row.popularity_score
      }))
    }
    
    // Stage 8: Check for required fields
    const { data: requiredFieldsData } = await supabase
      .from('news_public_v')
      .select('*')
      .not('title', 'is', null)
      .not('video_id', 'is', null)
      .limit(20)
    
    diagnostics.stages.after_required_fields = requiredFieldsData?.length || 0
    
    return NextResponse.json(diagnostics)
    
  } catch (error: any) {
    diagnostics.error = error.message
    return NextResponse.json(diagnostics, { status: 500 })
  }
}
