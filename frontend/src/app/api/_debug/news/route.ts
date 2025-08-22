/**
 * SECTION D - Debug route for development only
 * Shows Supabase counts and last updated timestamp
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Debug route not available in production' },
      { status: 404 }
    );
  }
  
  try {
    const supabase = getSupabaseAdmin();
    
    // Get counts from Supabase
    const newsCount = await supabase
      .from('news_trends')
      .select('*', { count: 'exact', head: true });
    
    const aiImagesCount = await supabase
      .from('ai_images')
      .select('*', { count: 'exact', head: true });
    
    const systemMetaCount = await supabase
      .from('system_meta')
      .select('*', { count: 'exact', head: true });
    
    // Get last updated timestamp
    const lastUpdatedResult = await supabase
      .from('system_meta')
      .select('value')
      .eq('key', 'news_last_updated')
      .single();
    
    // Get recent news sample
    const recentNews = await supabase
      .from('news_trends')
      .select('id, title, published_at, popularity_score, created_at')
      .order('published_at', { ascending: false })
      .limit(5);
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      database: 'supabase',
      counts: {
        news_trends: newsCount.count || 0,
        ai_images: aiImagesCount.count || 0,
        system_meta: systemMetaCount.count || 0
      },
      last_updated: lastUpdatedResult.data?.value || 'Not set',
      recent_sample: recentNews.data || [],
      environment: {
        node_env: process.env.NODE_ENV,
        supabase_url: process.env.SUPABASE_URL ? 'Set' : 'Not set',
        service_key: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Not set',
        json_fallback_allowed: process.env.NEXT_PUBLIC_ALLOW_JSON_FALLBACK === 'true'
      }
    };
    
    return NextResponse.json(debugInfo, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Debug-Route': 'true'
      }
    });
    
  } catch (error: any) {
    return NextResponse.json(
      { 
        error: 'Debug query failed',
        details: error?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
