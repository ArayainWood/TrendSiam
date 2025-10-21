/**
 * PDF Engine Health Check
 * 
 * Verifies PDF generation capability for both engines
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkChromiumHealth } from '@/lib/pdf/chromiumEngine';
import { pdfFeatures } from '@/lib/config/featureFlags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const engine = url.searchParams.get('engine') || 'all';
  
  const results: any = {
    timestamp: new Date().toISOString(),
    engines: {}
  };
  
  try {
    // Check legacy engine
    if (engine === 'all' || engine === 'legacy') {
      results.engines.legacy = {
        enabled: pdfFeatures.legacyEnabled,
        healthy: pdfFeatures.legacyEnabled, // Assume healthy if enabled
        endpoint: '/api/weekly/pdf'
      };
    }
    
    // Check Chromium engine
    if (engine === 'all' || engine === 'chromium') {
      if (pdfFeatures.chromiumEnabled) {
        console.log('[health-pdf] Testing Chromium engine...');
        const chromiumHealth = await checkChromiumHealth();
        results.engines.chromium = {
          enabled: true,
          ...chromiumHealth,
          endpoint: '/api/weekly/pdf-chromium'
        };
      } else {
        results.engines.chromium = {
          enabled: false,
          healthy: false,
          reason: 'Feature disabled'
        };
      }
    }
    
    // Overall health
    const enabledEngines = Object.values(results.engines).filter((e: any) => e.enabled);
    const healthyEngines = enabledEngines.filter((e: any) => e.healthy);
    
    results.summary = {
      totalEngines: Object.keys(results.engines).length,
      enabledEngines: enabledEngines.length,
      healthyEngines: healthyEngines.length,
      healthy: healthyEngines.length > 0,
      trafficSplit: {
        chromium: pdfFeatures.chromiumTrafficPercent,
        legacy: 100 - pdfFeatures.chromiumTrafficPercent
      }
    };
    
    return NextResponse.json(results, {
      status: results.summary.healthy ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
    
  } catch (error: any) {
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      error: error.message || 'Health check failed',
      healthy: false
    }, {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }
}
