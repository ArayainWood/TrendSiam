/**
 * Smart PDF Router - Feature-Flagged Unified Endpoint
 * 
 * Routes requests to Chromium or Legacy engine based on traffic percentage
 * Provides seamless rollout without UI changes
 */

import { NextRequest, NextResponse } from 'next/server';
import { pdfFeatures, shouldUseChromium } from '@/lib/config/featureFlags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Track requests for monitoring
const requestLog: Array<{
  timestamp: string;
  engine: 'chromium' | 'legacy';
  success: boolean;
  duration: number;
  snapshotId?: string;
  error?: string;
}> = [];

const MAX_LOG_SIZE = 100;

function logRequest(entry: typeof requestLog[0]) {
  requestLog.unshift(entry);
  if (requestLog.length > MAX_LOG_SIZE) {
    requestLog.pop();
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(request.url);
  const snapshotId = url.searchParams.get('snapshot') || undefined;
  
  // Determine which engine to use
  const useChromium = shouldUseChromium();
  const targetEngine = useChromium ? 'chromium' : 'legacy';
  
  console.log('[pdf-router] Routing request', {
    engine: targetEngine,
    chromiumEnabled: pdfFeatures.chromiumEnabled,
    legacyEnabled: pdfFeatures.legacyEnabled,
    trafficPercent: pdfFeatures.chromiumTrafficPercent,
    snapshotId
  });
  
  try {
    // Build target URL
    const targetPath = useChromium ? '/api/weekly/pdf-chromium' : '/api/weekly/pdf-legacy';
    const targetUrl = new URL(targetPath, request.url);
    
    // Copy query params
    url.searchParams.forEach((value, key) => {
      targetUrl.searchParams.set(key, value);
    });
    
    // Forward request to target engine
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf',
      },
    });
    
    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      const error = await response.text();
      logRequest({
        timestamp: new Date().toISOString(),
        engine: targetEngine,
        success: false,
        duration,
        snapshotId,
        error: error.substring(0, 200)
      });
      
      // If Chromium fails, try fallback to legacy
      if (useChromium && pdfFeatures.legacyEnabled) {
        console.warn('[pdf-router] Chromium failed, falling back to legacy');
        const fallbackUrl = new URL('/api/weekly/pdf-legacy', request.url);
        url.searchParams.forEach((value, key) => {
          fallbackUrl.searchParams.set(key, value);
        });
        
        const fallbackResponse = await fetch(fallbackUrl.toString(), {
          method: 'GET',
          headers: { 'Accept': 'application/pdf' },
        });
        
        if (fallbackResponse.ok) {
          logRequest({
            timestamp: new Date().toISOString(),
            engine: 'legacy',
            success: true,
            duration: Date.now() - startTime,
            snapshotId
          });
          
          // Clone response with updated headers
          const pdfBuffer = await fallbackResponse.arrayBuffer();
          return new Response(pdfBuffer, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': fallbackResponse.headers.get('Content-Disposition') || '',
              'Content-Length': pdfBuffer.byteLength.toString(),
              'X-PDF-Engine': 'legacy',
              'X-PDF-Fallback': 'true',
              'X-PDF-Original-Engine': 'chromium',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            }
          });
        }
      }
      
      return NextResponse.json({
        error: 'PDF generation failed',
        engine: targetEngine,
        code: 'E_PDF'
      }, { status: 500 });
    }
    
    // Success - forward the response
    const pdfBuffer = await response.arrayBuffer();
    logRequest({
      timestamp: new Date().toISOString(),
      engine: targetEngine,
      success: true,
      duration,
      snapshotId
    });
    
    console.log(`[pdf-router] ✅ PDF generated via ${targetEngine}: ${pdfBuffer.byteLength} bytes in ${duration}ms`);
    
    // Forward response with routing metadata
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': response.headers.get('Content-Disposition') || '',
        'Content-Length': pdfBuffer.byteLength.toString(),
        'X-PDF-Engine': targetEngine,
        'X-PDF-Router': 'smart-router-v1',
        'X-PDF-Traffic-Percent': pdfFeatures.chromiumTrafficPercent.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[pdf-router] ❌ Routing failed:', error);
    
    logRequest({
      timestamp: new Date().toISOString(),
      engine: targetEngine,
      success: false,
      duration,
      snapshotId,
      error: error.message
    });
    
    return NextResponse.json({
      error: 'PDF router failed',
      code: 'E_ROUTER',
      engine: targetEngine,
      message: error.message
    }, { status: 500 });
  }
}

// Export request log for monitoring endpoint
export function getRequestLog() {
  return [...requestLog];
}
