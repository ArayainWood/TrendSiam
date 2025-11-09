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
    
    if (counts.tablePublishedCount === 0) {
      notes.push('No published snapshots in table; check if snapshots are being published');
    }
    
    if (counts.viewCount === 0 && counts.tablePublishedCount > 0) {
      notes.push('View has no data but table has published snapshots; check if view exists or has proper permissions');
    }
    
    if (!latestSnapshot && counts.tablePublishedCount > 0) {
      notes.push('Cannot fetch snapshots despite published count > 0; possible permission issue or env mismatch');
    }
    
    if (diagnosticData.latestPublishedFromTable && !diagnosticData.latestFromView) {
      notes.push('Table has data but view is empty; view might not exist or might filter differently');
    }
    
    // Check for potential env mismatch
    if (!projectRef) {
      notes.push('Could not extract project ref from SUPABASE_URL');
    } else if (counts.tablePublishedCount > 0 && !latestSnapshot) {
      notes.push(`Web points to project '${projectRef}' but cannot read snapshots; check if builder uses same project`);
    }
    
    const response = {
      env: {
        projectRef: projectRef || 'unknown',
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      },
      latestFromView: diagnosticData.latestFromView,
      latestPublishedFromTable: diagnosticData.latestPublishedFromTable,
      counts: {
        viewCount: counts.viewCount,
        tablePublishedCount: counts.tablePublishedCount,
        tableTotalCount: counts.tableTotalCount
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