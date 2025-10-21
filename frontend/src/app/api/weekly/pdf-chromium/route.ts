/**
 * Chromium PDF Generation API
 * 
 * New PDF endpoint using Playwright/Chromium for accurate rendering
 * Supports proper Thai/CJK/Emoji rendering with HarfBuzz
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWeeklySnapshot } from '@/lib/data/weeklySnapshot';
import { generatePDFWithChromium } from '@/lib/pdf/chromiumEngine';
import { pdfFeatures, logPDFFeatureFlags } from '@/lib/config/featureFlags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Allow up to 30 seconds for PDF generation

export async function GET(request: NextRequest): Promise<Response> {
  const startTime = Date.now();
  
  try {
    // Check if Chromium engine is enabled
    if (!pdfFeatures.chromiumEnabled) {
      return NextResponse.json({
        error: 'Chromium PDF engine is disabled',
        code: 'E_FEATURE_DISABLED'
      }, { status: 503 });
    }
    
    // Log feature flags
    logPDFFeatureFlags();
    
    // Parse parameters
    const url = new URL(request.url);
    const snapshotId = url.searchParams.get('snapshot');
    const format = url.searchParams.get('format'); // 'pdf' or 'html' for debugging
    const testSet = url.searchParams.get('test'); // For verification testing
    
    console.log('[pdf-chromium] Starting PDF generation', {
      snapshotId: snapshotId || 'latest',
      format: format || 'pdf',
      engine: 'chromium',
      testSet: testSet || 'none'
    });
    
    // Fetch snapshot data (same as legacy route)
    let snapshotData;
    
    if (testSet) {
      // Use test data for verification
      console.log('[pdf-chromium] Fetching test data...');
      const testRes = await fetch(`http://localhost:3000/api/test/pdf-cases?set=${testSet}`);
      if (!testRes.ok) {
        return NextResponse.json({
          error: 'Failed to load test data',
          code: 'E_TEST_DATA'
        }, { status: 500 });
      }
      snapshotData = await testRes.json();
    } else {
      // Use real snapshot data
      console.log('[pdf-chromium] Fetching snapshot data...');
      snapshotData = await fetchWeeklySnapshot(snapshotId || undefined);
    }
    
    if (!snapshotData.success) {
      return NextResponse.json({
        error: snapshotData.error || 'Failed to load snapshot data',
        code: 'E_DATA'
      }, { status: 500 });
    }
    
    // Prepare data for template
    const templateData = {
      items: snapshotData.items.slice(0, 20),
      metrics: snapshotData.metrics,
      generatedAt: snapshotData.builtAt,
      source: 'snapshot' as const,
      snapshotId: snapshotData.snapshotId,
      rangeStart: snapshotData.rangeStart,
      rangeEnd: snapshotData.rangeEnd
    };
    
    // Generate PDF using Chromium
    console.log('[pdf-chromium] Generating PDF with Chromium...');
    const pdfBuffer = await generatePDFWithChromium(templateData);
    
    // Generate filename
    const bangkokDate = new Date().toLocaleDateString('sv-SE', { 
      timeZone: 'Asia/Bangkok' 
    });
    const filename = `trendsiam-weekly-${bangkokDate}-chromium.pdf`;
    
    const duration = Date.now() - startTime;
    
    // Add metadata stamp for engine provenance
    const engineMetadata = {
      engine: 'chromium',
      renderer: 'Playwright/Chromium',
      timestamp: new Date().toISOString(),
      snapshotId: templateData.snapshotId || 'unknown',
      buildTag: process.env.BUILD_TAG || 'dev',
      duration: `${duration}ms`
    };
    console.log('[pdf-chromium] Engine metadata:', engineMetadata);
    console.log(`[pdf-chromium] ✅ PDF generated successfully: ${pdfBuffer.length} bytes in ${duration}ms`);
    
    // Return PDF with proper headers
    // Convert Buffer to Uint8Array for Response constructor compatibility
    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
        'X-PDF-Engine': 'chromium',
        'X-PDF-Renderer': 'Playwright/Chromium',
        'X-PDF-Generation-Time': duration.toString(),
        'X-PDF-Timestamp': new Date().toISOString(),
        'X-PDF-Snapshot': templateData.snapshotId || 'unknown',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[pdf-chromium] ❌ PDF generation failed:', error);
    
    return NextResponse.json({
      error: error.message || 'PDF generation failed',
      code: 'E_PDF',
      engine: 'chromium',
      duration
    }, { 
      status: 500,
      headers: {
        'X-PDF-Engine': 'chromium',
        'X-PDF-Error': 'true'
      }
    });
  }
}
