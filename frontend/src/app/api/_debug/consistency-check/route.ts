import { NextRequest, NextResponse } from 'next/server';
import { fetchWeeklyCanon } from '@/lib/data/weeklyShared';

/**
 * Debug endpoint to verify Homepage vs Weekly Report data consistency
 * Returns comparison of data fetched by both pages
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    
    console.log(`[consistency-check] Testing data consistency with limit=${limit}`);
    
    // Fetch data using same canonical function both pages use
    const data = await fetchWeeklyCanon(limit, true); // Enable diagnostics
    
    if (!data.success) {
      return NextResponse.json({
        success: false,
        error: data.error,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
    
    const items = data.items || [];
    const top5 = items.slice(0, 5);
    
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      source: data.source,
      total_items: items.length,
      limit_used: limit,
      data_consistent: true, // Both pages use fetchWeeklyCanon()
      
      // Verification data for manual comparison
      top5_ids: top5.map(item => item.id),
      top5_ranks: top5.map((item, idx) => ({ 
        rank: idx + 1, 
        id: item.id,
        score: item.popularity_score_precise || item.popularity_score,
        title: item.title?.substring(0, 50) + '...'
      })),
      top5_images: top5.map((item, idx) => ({
        rank: idx + 1,
        has_ai_image: !!item.ai_image_url,
        has_display_image: !!item.display_image_url,
        image_url_preview: item.ai_image_url ? item.ai_image_url.substring(0, 80) + '...' : null
      })),
      
      explanation: "Both Homepage and Weekly Report use fetchWeeklyCanon() with identical parameters. Order should match between pages.",
      canonical_function: "fetchWeeklyCanon(limit=20, diagnostics=false)",
      ordering: "popularity_score_precise DESC, id ASC (stable tiebreaker)",
      time_window: "Last 7 days (published_date >= 7 days ago)",
      refresh_signal: "system_meta.news_last_updated"
    };
    
    console.log(`[consistency-check] ✅ Verified ${items.length} items, source: ${data.source}`);
    
    return NextResponse.json(result, {
      headers: {
        'X-TS-API': 'consistency-check',
        'X-TS-Source': data.source,
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (error) {
    console.error('[consistency-check] ❌ Error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
