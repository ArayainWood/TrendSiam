/**
 * Data Consistency Debug Endpoint
 * 
 * Compares Homepage vs Weekly Report data sources to identify discrepancies
 */

import { fetchWeeklyCanon } from '@/lib/data/weeklyShared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') ?? 10);
  
  try {
    console.log(`[data-consistency] Fetching data with limit=${limit}`);
    
    // Fetch data using the same function both pages use
    const data = await fetchWeeklyCanon(limit, true); // Enable diagnostics
    
    if (!data.success || !data.items || data.items.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No data available',
        data_source: data.source,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Analyze data consistency
    const analysis = {
      total_items: data.items.length,
      source: data.source,
      timestamp: new Date().toISOString(),
      
      // Top 3 analysis
      top_3: data.items.slice(0, 3).map((item: any, index: number) => ({
        rank: index + 1,
        id: item.id,
        title: item.title?.substring(0, 50) + '...',
        popularity_score: item.popularity_score_precise || item.score,
        has_ai_image: !!item.ai_image_url,
        has_display_image: !!item.display_image_url,
        ai_image_url: item.ai_image_url?.substring(0, 80) + '...' || null,
        display_image_url: item.display_image_url?.substring(0, 80) + '...' || null,
        published_date: item.published_date,
        image_source: item.ai_image_url ? 'ai' : (item.display_image_url ? 'display' : 'none')
      })),
      
      // Image coverage
      image_stats: {
        total_with_ai_images: data.items.filter((item: any) => item.ai_image_url).length,
        total_with_display_images: data.items.filter((item: any) => item.display_image_url).length,
        top_3_with_ai_images: data.items.slice(0, 3).filter((item: any) => item.ai_image_url).length,
        top_3_with_display_images: data.items.slice(0, 3).filter((item: any) => item.display_image_url).length
      },
      
      // Date range analysis
      date_range: {
        earliest: data.items.reduce((earliest: string, item: any) => {
          const date = item.published_date || item.created_at;
          return !earliest || date < earliest ? date : earliest;
        }, ''),
        latest: data.items.reduce((latest: string, item: any) => {
          const date = item.published_date || item.created_at;
          return !latest || date > latest ? date : latest;
        }, '')
      },
      
      // Score distribution
      score_stats: {
        max_score: Math.max(...data.items.map((item: any) => item.popularity_score_precise || item.score || 0)),
        min_score: Math.min(...data.items.map((item: any) => item.popularity_score_precise || item.score || 0)),
        avg_score: data.items.reduce((sum: number, item: any) => sum + (item.popularity_score_precise || item.score || 0), 0) / data.items.length
      },
      
      // Field consistency check
      field_consistency: {
        all_have_titles: data.items.every((item: any) => item.title),
        all_have_scores: data.items.every((item: any) => item.popularity_score_precise || item.score),
        all_have_dates: data.items.every((item: any) => item.published_date || item.created_at),
        all_have_ids: data.items.every((item: any) => item.id)
      },
      
      // Ordering verification
      ordering_check: {
        is_sorted_by_score: data.items.every((item: any, index: number) => {
          if (index === 0) return true;
          const currentScore = item.popularity_score_precise || item.score || 0;
          const previousScore = data.items[index - 1].popularity_score_precise || data.items[index - 1].score || 0;
          return currentScore <= previousScore;
        }),
        score_sequence: data.items.slice(0, 5).map((item: any) => item.popularity_score_precise || item.score)
      }
    };
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Data consistency analysis complete',
      analysis,
      raw_diagnostics: data.diagnostics,
      data_version: data.generatedAt
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-TS-API': 'data-consistency-debug',
        'X-TS-Source': data.source
      }
    });
    
  } catch (error: any) {
    console.error('[data-consistency] Analysis failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Analysis failed',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
