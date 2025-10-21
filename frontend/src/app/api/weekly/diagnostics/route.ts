/**
 * Weekly Snapshot Diagnostics API
 * 
 * Provides read-only diagnostics for the snapshot system
 */

import { NextResponse } from 'next/server';
import { extractProjectRef } from '@/utils/envProjectRef';
import { 
  fetchLatestWeekly, 
  getDiagnosticCounts, 
  fetchDiagnosticData 
} from '@/lib/weekly/weeklyRepo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Extract project ref from environment
    const projectRef = extractProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
    
    // Get diagnostic data
    const [counts, diagnosticData, latestSnapshot] = await Promise.all([
      getDiagnosticCounts(),
      fetchDiagnosticData(),
      fetchLatestWeekly()
    ]);
    
    // Build notes array
    const notes: string[] = [];
    
    if (counts.viewPublishedCount === 0) {
      notes.push('No published snapshots in view; check if snapshots are being published');
    }
    
    if (counts.viewCount === 0 && counts.viewPublishedCount > 0) {
      notes.push('View has data but published count is higher; possible filter mismatch');
    }
    
    if (!latestSnapshot && counts.viewPublishedCount > 0) {
      notes.push('Cannot fetch snapshots despite published count > 0; possible permission issue or env mismatch');
    }
    
    if (!diagnosticData.latestFromView) {
      notes.push('View returned no data; check if public_v_weekly_snapshots exists and has data');
    }
    
    // Check for potential env mismatch
    if (!projectRef) {
      notes.push('Could not extract project ref from SUPABASE_URL');
    } else if (counts.viewPublishedCount > 0 && !latestSnapshot) {
      notes.push(`Web points to project '${projectRef}' but cannot read snapshots; check if builder uses same project`);
    }
    
    const response = {
      env: {
        projectRef: projectRef || 'unknown',
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      },
      latestFromView: diagnosticData.latestFromView,
      counts: {
        viewCount: counts.viewCount,
        viewPublishedCount: counts.viewPublishedCount
      },
      diagnostics: {
        totalCount: diagnosticData.totalCount,
        publishedCount: diagnosticData.publishedCount
      },
      notes: notes.length > 0 ? notes : undefined,
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
    
  } catch (error) {
    console.error('[diagnostics] Error:', error);
    
    return NextResponse.json({
      env: {
        projectRef: extractProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL) || 'error',
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      },
      error: error instanceof Error ? error.message : 'Unknown error',
      notes: ['Diagnostics endpoint encountered an error'],
      timestamp: new Date().toISOString()
    }, {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }
}