/**
 * Weekly Report API Route
 * 
 * Returns weekly report data from Supabase with JSON fallback.
 * Uses server-side service role for secure database access.
 */

import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getWeeklyData } from '@/lib/weeklyData';

export async function GET() {
  console.log('[weekly-report] API request received');
  
  try {
    // Get weekly data (handles Supabase + fallback internally)
    const data = await getWeeklyData();
    
    console.log(`[weekly-report] ✅ Data fetched: ${data.items.length} items from ${data.source}`);
    
    // Return structured response matching frontend expectations
    const response = {
      success: true,
      source: data.source,
      data: {
        items: data.items,
        metrics: data.metrics,
        generatedAt: data.generatedAt,
        dataVersion: data.dataVersion,
        source: data.source
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json'
      }
    });
  } catch (error: any) {
    console.error('[weekly-report] ❌ Error fetching weekly data:', error?.message || error);
    
    return NextResponse.json({
      success: false,
      source: 'error',
      error: error?.message || 'Failed to fetch weekly data',
      timestamp: new Date().toISOString()
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json'
      }
    });
  }
}
