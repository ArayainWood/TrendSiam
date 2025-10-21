/**
 * Telemetry API - View Count Increment
 * POST /api/telemetry/view
 * 
 * Increments view count atomically when user clicks card or opens modal.
 * Uses service_role key (server-side only) for write access.
 * Rate limiting: Max 100 requests per IP per hour (prevents abuse).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================================================
// RATE LIMITING: In-memory IP tracker (resets on server restart)
// ============================================================================

interface RateLimitEntry {
  count: number
  resetAt: number // Unix timestamp
}

const rateLimitMap = new Map<string, RateLimitEntry>()
const RATE_LIMIT_MAX = 100 // Max requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  
  // No entry or expired → create new
  if (!entry || now >= entry.resetAt) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    }
    rateLimitMap.set(ip, newEntry)
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
      resetAt: newEntry.resetAt
    }
  }
  
  // Entry exists and valid
  if (entry.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt
    }
  }
  
  // Increment count
  entry.count += 1
  rateLimitMap.set(ip, entry)
  
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX - entry.count,
    resetAt: entry.resetAt
  }
}

// Cleanup expired entries every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [ip, entry] of rateLimitMap.entries()) {
      if (now >= entry.resetAt) {
        rateLimitMap.delete(ip)
      }
    }
  }, 10 * 60 * 1000)
}

// Create admin client with service_role key (server-side only)
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  })
}

interface ViewRequest {
  story_id?: string
  video_id?: string
}

export async function POST(req: NextRequest) {
  try {
    // ========================================================================
    // RATE LIMITING: Check IP-based throttle
    // ========================================================================
    const forwarded = req.headers.get('x-forwarded-for')
    const realIp = req.headers.get('x-real-ip')
    const ip = forwarded ? forwarded.split(',')[0]?.trim() || 'unknown' : (realIp || 'unknown')
    
    const rateLimit = checkRateLimit(ip)
    
    if (!rateLimit.allowed) {
      const resetInSeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      console.warn('[telemetry/view] 🚫 Rate limit exceeded:', {
        ip: ip.substring(0, 12) + '...',
        resetInSeconds
      })
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Rate limit exceeded',
          retryAfter: resetInSeconds
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(resetInSeconds),
            'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString()
          }
        }
      )
    }
    
    const body: ViewRequest = await req.json()
    const { video_id, story_id } = body
    
    console.log('[telemetry/view] 📥 Received:', { video_id: video_id ? '✓' : '✗', story_id: story_id ? '✓' : '✗', ip: ip.substring(0, 12) + '...' })
    
    // Validate: need at least one identifier
    if (!video_id && !story_id) {
      console.error('[telemetry/view] ❌ Missing both video_id and story_id')
      return NextResponse.json(
        { success: false, error: 'Missing video_id or story_id' },
        { status: 400 }
      )
    }
    
    const supabase = getAdminClient()
    
    // Find the news item by story_id (primary) or video_id/external_id (fallback)
    let newsItem
    let findError
    
    if (story_id) {
      // Try by story ID first
      const result = await supabase
        .from('news_trends')
        .select('id, view_count, site_click_count, video_id, external_id')
        .eq('id', story_id)
        .single()
      
      newsItem = result.data
      findError = result.error
    }
    
    if (!newsItem && video_id) {
      // Fallback: try by video_id or external_id
      const result = await supabase
        .from('news_trends')
        .select('id, view_count, site_click_count, video_id, external_id')
        .or(`video_id.eq.${video_id},external_id.eq.${video_id}`)
        .single()
      
      newsItem = result.data
      findError = result.error
    }
    
    if (findError || !newsItem) {
      console.error('[telemetry/view] ❌ Item not found:', {
        story_id,
        video_id,
        error: findError?.message || 'No matching record'
      })
      
      // Fail gracefully - don't block UI if item not found
      return NextResponse.json(
        { success: false, error: 'Item not found', views: 0 },
        { status: 404 }
      )
    }
    
    console.log('[telemetry/view] ✓ Found item:', { 
      id: newsItem.id, 
      currentSiteClicks: newsItem.site_click_count 
    })
    
    // Atomically increment SITE CLICK COUNTER ONLY (not platform views)
    const currentSiteClicks = parseInt(String(newsItem.site_click_count || '0'), 10) || 0
    const newSiteClicks = currentSiteClicks + 1
    
    const { error: updateError } = await supabase
      .from('news_trends')
      .update({ 
        site_click_count: newSiteClicks // INTEGER column for site-specific clicks
      })
      .eq('id', newsItem.id)
    
    if (updateError) {
      console.error('[telemetry/view] Failed to increment site clicks:', {
        id: newsItem.id,
        video_id,
        error: updateError.message
      })
      
      return NextResponse.json(
        { success: false, error: 'Failed to update site click count' },
        { status: 500 }
      )
    }
    
    console.log('[telemetry/view] ✅ Site click incremented:', {
      story_id: newsItem.id,
      video_id: newsItem.video_id || newsItem.external_id,
      siteClicks: `${currentSiteClicks} → ${newSiteClicks}`,
      ip: ip.substring(0, 12) + '...',
      remaining: rateLimit.remaining
    })
    
    return NextResponse.json({
      success: true,
      site_click_count: newSiteClicks,  // Return new site clicks total
      previous_site_clicks: currentSiteClicks,  // Return previous value for logging
      incremented_by: 1
    }, {
      headers: {
        'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
        'X-RateLimit-Remaining': String(rateLimit.remaining),
        'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString()
      }
    })
    
  } catch (error: any) {
    console.error('[telemetry/view] Exception:', error.message)
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Only POST allowed
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}
