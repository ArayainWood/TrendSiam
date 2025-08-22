/**
 * Debug API route for weekly data
 * Allows testing the data fetching logic directly
 */

import 'server-only';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getWeeklyData } from '@/lib/weeklyData';
import { testAdminConnection } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  console.log('[weekly/data-api] Debug request received');
  
  try {
    // Test Supabase connectivity first
    const connectionTest = await testAdminConnection();
    console.log('[weekly/data-api] Supabase connection test:', connectionTest);
    
    // Get weekly data
    const data = await getWeeklyData();
    
    // Return debug info + data
    return NextResponse.json({
      success: true,
      source: data.source,
      itemCount: data.items.length,
      metrics: data.metrics,
      supabaseConnected: connectionTest,
      environment: {
        supabaseEnabled: process.env.SUPABASE_ENABLED,
        hasUrl: !!process.env.SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        nodeEnv: process.env.NODE_ENV
      },
      timestamp: new Date().toISOString(),
      // Include first 3 items for debugging
      sampleItems: data.items.slice(0, 3).map(item => ({
        story_id: item.story_id,
        title: item.title.substring(0, 50) + '...',
        category: item.category,
        rank: item.rank,
        source: data.source
      }))
    });
  } catch (error: any) {
    console.error('[weekly/data-api] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: error?.message || 'Unknown error',
      environment: {
        supabaseEnabled: process.env.SUPABASE_ENABLED,
        hasUrl: !!process.env.SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        nodeEnv: process.env.NODE_ENV
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}