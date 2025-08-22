/**
 * Views Diagnostics API
 * 
 * Server-only diagnostics endpoint to inspect public views
 * Protected by secret header for security
 */

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Valid view names
const VALID_VIEWS = [
  'news_public_v',
  'weekly_report_public_v',
  'stories_public_v',
  'snapshots_public_v',
  'weekly_public_view'
] as const;

type ViewName = typeof VALID_VIEWS[number];

// Create admin Supabase client for diagnostics
function getAdminSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

export async function GET(request: NextRequest) {
  try {
    // Check for admin secret header
    const adminSecret = request.headers.get('x-admin-secret');
    const expectedSecret = process.env.ADMIN_SECRET || 'trendsiam-secure-2025';
    
    if (adminSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get view parameter
    const { searchParams } = new URL(request.url);
    const viewName = searchParams.get('view') as ViewName | null;
    const sample = searchParams.get('sample') === 'true';
    
    // If no view specified, return summary
    if (!viewName) {
      return await getDiagnosticsSummary();
    }
    
    // Validate view name
    if (!VALID_VIEWS.includes(viewName)) {
      return NextResponse.json(
        { error: `Invalid view name. Valid views: ${VALID_VIEWS.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Get view diagnostics
    return await getViewDiagnostics(viewName, sample);
    
  } catch (error) {
    console.error('[diagnostics/views] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get summary of all views
async function getDiagnosticsSummary() {
  const supabase = getAdminSupabase();
  const summary: Record<string, any> = {};
  
  for (const viewName of VALID_VIEWS) {
    try {
      // Get count and basic info
      const { count, error } = await supabase
        .from(viewName)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        summary[viewName] = {
          exists: false,
          error: error.message
        };
      } else {
        summary[viewName] = {
          exists: true,
          totalRows: count || 0
        };
        
        // Get date range if possible
        if (viewName === 'news_public_v' || viewName === 'weekly_public_view') {
          const { data: dateRange } = await supabase
            .from(viewName)
            .select('created_at')
            .order('created_at', { ascending: true })
            .limit(1);
          
          const { data: latestDate } = await supabase
            .from(viewName)
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (dateRange && dateRange[0] && latestDate && latestDate[0]) {
            summary[viewName].dateRange = {
              oldest: dateRange[0].created_at,
              newest: latestDate[0].created_at
            };
          }
        }
      }
    } catch (err) {
      summary[viewName] = {
        exists: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    views: summary,
    environment: {
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasPublicUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    }
  });
}

// Get detailed diagnostics for a specific view
async function getViewDiagnostics(viewName: ViewName, includeSample: boolean) {
  const supabase = getAdminSupabase();
  
  try {
    // Get total count
    const { count, error: countError } = await supabase
      .from(viewName)
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      throw countError;
    }
    
    const diagnostics: any = {
      view: viewName,
      exists: true,
      totalRows: count || 0,
      timestamp: new Date().toISOString()
    };
    
    // Get column information by fetching one row
    const { data: schemaRow, error: schemaError } = await supabase
      .from(viewName)
      .select('*')
      .limit(1)
      .single();
    
    if (!schemaError && schemaRow) {
      diagnostics.columns = Object.keys(schemaRow).sort();
      diagnostics.columnCount = diagnostics.columns.length;
    }
    
    // Get sample data if requested
    if (includeSample && count && count > 0) {
      const limit = Math.min(5, count);
      const { data: sampleData, error: sampleError } = await supabase
        .from(viewName)
        .select('*')
        .limit(limit);
      
      if (!sampleError && sampleData) {
        // Sanitize sample data (remove any sensitive fields)
        diagnostics.sample = sampleData.map((row: any) => {
          const sanitized = { ...row };
          // Remove any potential sensitive fields
          delete sanitized.ai_image_prompt;
          delete sanitized.extra;
          delete sanitized.debug;
          return sanitized;
        });
      }
    }
    
    // View-specific diagnostics
    if (viewName === 'news_public_v' || viewName === 'weekly_public_view') {
      // Get score distribution
      const { data: scoreData } = await supabase
        .from(viewName)
        .select('popularity_score_precise');
      
      if (scoreData && scoreData.length > 0) {
        const scores = scoreData
          .map(row => row.popularity_score_precise)
          .filter(score => score != null)
          .map(score => Number(score));
        
        diagnostics.scoreStats = {
          min: Math.min(...scores),
          max: Math.max(...scores),
          avg: scores.reduce((a, b) => a + b, 0) / scores.length,
          count: scores.length
        };
      }
      
      // Get platform distribution
      const { data: platforms } = await supabase
        .from(viewName)
        .select('platform');
      
      if (platforms) {
        const platformCounts: Record<string, number> = {};
        platforms.forEach(row => {
          const platform = row.platform || 'unknown';
          platformCounts[platform] = (platformCounts[platform] || 0) + 1;
        });
        diagnostics.platformDistribution = platformCounts;
      }
    }
    
    if (viewName === 'weekly_report_public_v') {
      // Get latest snapshot info
      const { data: latest } = await supabase
        .from(viewName)
        .select('snapshot_id, built_at, range_start, range_end')
        .order('built_at', { ascending: false })
        .limit(1)
        .single();
      
      if (latest) {
        diagnostics.latestSnapshot = latest;
      }
    }
    
    return NextResponse.json(diagnostics);
    
  } catch (error) {
    return NextResponse.json({
      view: viewName,
      exists: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}
