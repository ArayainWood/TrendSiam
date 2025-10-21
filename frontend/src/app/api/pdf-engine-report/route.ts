/**
 * PDF Engine Report - Admin Monitoring Endpoint
 * 
 * Returns PDF engine configuration and basic stats
 * 
 * NOTE: Request logging was removed from the pdf router to fix Next.js type errors.
 * This endpoint now shows configuration only. For detailed monitoring, use external
 * observability tools (e.g., Vercel Analytics, CloudWatch).
 */

import { NextResponse } from 'next/server';
import { pdfFeatures } from '@/lib/config/featureFlags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      config: {
        chromiumEnabled: pdfFeatures.chromiumEnabled,
        legacyEnabled: pdfFeatures.legacyEnabled,
        chromiumTrafficPercent: pdfFeatures.chromiumTrafficPercent,
      },
      notice: 'Request logging unavailable. Internal logs removed to fix Next.js type errors. Use external observability for detailed monitoring.',
      endpoints: {
        chromium: '/api/weekly/pdf-chromium',
        legacy: '/api/weekly/pdf-legacy',
        router: '/api/weekly/pdf',
      },
      recommendation: 'Use Vercel Analytics, CloudWatch, or your preferred APM for request tracking.',
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
