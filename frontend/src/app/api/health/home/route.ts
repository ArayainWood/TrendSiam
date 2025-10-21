// Health check endpoint for Home feed
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

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

export async function GET() {
  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    checks: {}
  }
  
  try {
    const supabase = getClient()
    
    // Check 1: Can we query the view?
    const viewCheck = await supabase
      .from('home_feed_v1')
      .select('id')
      .limit(1)
    
    checks.checks.view_accessible = {
      success: !viewCheck.error,
      error: viewCheck.error?.message || null
    }
    
    // Check 2: Count total rows
    const countCheck = await supabase
      .from('home_feed_v1')
      .select('id', { count: 'exact', head: true })
    
    checks.checks.row_count = {
      success: !countCheck.error,
      count: countCheck.count || 0,
      error: countCheck.error?.message || null
    }
    
    // Check 3: Verify score_details format (sample check)
    const scoreCheck = await supabase
      .from('home_feed_v1')
      .select('id, score_details')
      .not('score_details', 'is', null)
      .limit(5)
    
    if (scoreCheck.data && scoreCheck.data.length > 0) {
      const invalidScoreDetails = scoreCheck.data.filter(row => {
        // Check if score_details looks like JSON
        if (typeof row.score_details === 'string') {
          const trimmed = row.score_details.trim()
          return !(trimmed.startsWith('{') || trimmed.startsWith('['))
        }
        return false
      })
      
      checks.checks.score_details_format = {
        success: true,
        sample_count: scoreCheck.data.length,
        text_format_count: invalidScoreDetails.length,
        note: 'score_details is stored as text descriptions, not JSON'
      }
    }
    
    // Check 4: Verify Top-3 policy
    const top3Check = await supabase
      .from('home_feed_v1')
      .select('rank, is_top3, image_url, ai_prompt')
      .order('rank')
      .limit(10)
    
    if (top3Check.data) {
      const violations = top3Check.data.filter(row => {
        if (row.is_top3 && row.rank > 3) return true
        if (!row.is_top3 && row.rank <= 3) return true
        if (!row.is_top3 && (row.image_url || row.ai_prompt)) return true
        return false
      })
      
      checks.checks.top3_policy = {
        success: violations.length === 0,
        violations: violations.length,
        sample_size: top3Check.data.length
      }
    }
    
    // Check 5: Source URL validation
    const urlCheck = await supabase
      .from('home_feed_v1')
      .select('id, source_url, platform')
      .is('source_url', null)
      .or('source_url.eq.')
      .limit(5)
    
    checks.checks.source_urls = {
      success: true,
      empty_urls: urlCheck.data?.length || 0,
      note: urlCheck.data?.length ? 'Some items missing source URLs' : 'All checked items have source URLs'
    }
    
    // Overall health
    const allChecksPass = Object.values(checks.checks).every((check: any) => 
      check.success !== false
    )
    
    checks.healthy = allChecksPass && (checks.checks.row_count?.count || 0) > 0
    checks.status = checks.healthy ? 'healthy' : 'unhealthy'
    
    return NextResponse.json(checks, { 
      status: checks.healthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
    
  } catch (error: any) {
    checks.checks.error = {
      success: false,
      message: error?.message || 'Unknown error'
    }
    checks.healthy = false
    checks.status = 'error'
    
    return NextResponse.json(checks, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
  }
}
