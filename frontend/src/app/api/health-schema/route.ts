/**
 * Schema Health Check Endpoint
 * 
 * Verifies expected database views and columns exist
 * Part of Chromium PDF migration - ensures data contract stability
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Expected schema for weekly snapshots view
const EXPECTED_SCHEMA = {
  public_v_weekly_snapshots: {
    columns: [
      'snapshot_id',
      'status', 
      'built_at',
      'created_at',
      'range_start',
      'range_end',
      'items',
      'meta'
    ],
    critical: true
  },
  public_v_weekly_stats: {
    columns: [
      'week',
      'news_count',
      'total_stories',
      'stories_with_images',
      'avg_popularity_score',
      'last_updated'
    ],
    critical: false
  }
};

async function checkViewSchema(supabase: any, viewName: string, expectedColumns: string[]) {
  try {
    // Query to get column names for a view
    const { data, error } = await supabase
      .from(viewName)
      .select('*')
      .limit(0); // We only need column info, not data

    if (error) {
      return {
        view: viewName,
        exists: false,
        error: error.message,
        columns: []
      };
    }

    // Get columns from a dummy query
    const { data: sample, error: sampleError } = await supabase
      .from(viewName)
      .select('*')
      .limit(1)
      .single();

    const actualColumns = sample ? Object.keys(sample) : [];
    const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
    const extraColumns = actualColumns.filter(col => !expectedColumns.includes(col));

    return {
      view: viewName,
      exists: true,
      error: null,
      columns: actualColumns,
      expectedColumns,
      missingColumns,
      extraColumns,
      healthy: missingColumns.length === 0
    };
  } catch (error: any) {
    return {
      view: viewName,
      exists: false,
      error: error.message || 'Unknown error',
      columns: []
    };
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Create Supabase client
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Check which specific view to test
    const url = new URL(request.url);
    const checkView = url.searchParams.get('check');
    
    const results: any = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      checks: {}
    };

    // Check specific view or all
    const viewsToCheck = checkView 
      ? { [checkView]: EXPECTED_SCHEMA[checkView as keyof typeof EXPECTED_SCHEMA] }
      : EXPECTED_SCHEMA;

    for (const [viewName, config] of Object.entries(viewsToCheck)) {
      if (!config) continue;
      
      results.checks[viewName] = await checkViewSchema(
        supabase, 
        viewName, 
        config.columns
      );
      results.checks[viewName].critical = config.critical;
    }

    // Overall health status
    const criticalViews = Object.entries(results.checks)
      .filter(([_, check]: [string, any]) => check.critical && !check.healthy);
    
    results.healthy = criticalViews.length === 0;
    results.duration = Date.now() - startTime;

    // Special check for home_view
    if (checkView === 'home_view') {
      // Check both canonical and alias
      const homeViewChecks = await Promise.all([
        checkViewSchema(supabase, 'home_feed_v1', [
          'id', 'rank', 'title', 'platform', 'category',
          'channel', 'published_at', 'popularity_score'
        ]),
        checkViewSchema(supabase, 'public_v_home_news', [
          'id', 'rank', 'title', 'platform', 'category',
          'channel', 'published_at', 'score'
        ])
      ]);

      results.checks = {
        home_feed_v1: homeViewChecks[0],
        public_v_home_news: homeViewChecks[1]
      };
      results.healthy = homeViewChecks.every(check => check.healthy);
    }

    return NextResponse.json(results, {
      status: results.healthy ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error: any) {
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      healthy: false,
      error: error.message || 'Unknown error',
      duration: Date.now() - startTime
    }, {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }
}