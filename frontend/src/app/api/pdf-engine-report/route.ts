/**
 * PDF Engine Report - Admin Monitoring Endpoint
 * 
 * Returns last 100 PDF requests split by engine with pass/fail status
 */

import { NextResponse } from 'next/server';
import { pdfFeatures } from '@/lib/config/featureFlags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Import request log from router (circular dependency handled by Next.js)
async function getRequestLog() {
  try {
    // Read from router's internal state
    const routerModule = await import('../weekly/pdf/route');
    if (typeof routerModule.getRequestLog === 'function') {
      return routerModule.getRequestLog();
    }
  } catch (error) {
    console.warn('[pdf-engine-report] Could not access request log:', error);
  }
  return [];
}

export async function GET() {
  try {
    const requestLog = await getRequestLog();
    
    // Calculate statistics
    const stats = {
      total: requestLog.length,
      chromium: requestLog.filter(r => r.engine === 'chromium').length,
      legacy: requestLog.filter(r => r.engine === 'legacy').length,
      success: requestLog.filter(r => r.success).length,
      failed: requestLog.filter(r => !r.success).length,
      avgDuration: requestLog.length > 0
        ? Math.round(requestLog.reduce((sum, r) => sum + r.duration, 0) / requestLog.length)
        : 0,
    };
    
    const successRate = stats.total > 0 
      ? ((stats.success / stats.total) * 100).toFixed(1)
      : 'N/A';
    
    const chromiumPercent = stats.total > 0
      ? ((stats.chromium / stats.total) * 100).toFixed(1)
      : '0.0';
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      config: {
        chromiumEnabled: pdfFeatures.chromiumEnabled,
        legacyEnabled: pdfFeatures.legacyEnabled,
        chromiumTrafficPercent: pdfFeatures.chromiumTrafficPercent,
      },
      stats: {
        ...stats,
        successRate: `${successRate}%`,
        chromiumPercent: `${chromiumPercent}%`,
      },
      recentRequests: requestLog.slice(0, 20).map(r => ({
        timestamp: r.timestamp,
        engine: r.engine,
        success: r.success,
        duration: `${r.duration}ms`,
        snapshotId: r.snapshotId,
        error: r.error ? r.error.substring(0, 100) : undefined,
      })),
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
    
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to generate report',
      message: error.message
    }, { status: 500 });
  }
}
