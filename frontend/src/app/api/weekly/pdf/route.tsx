/**
 * Weekly PDF Generation API v7
 * 
 * Uses snapshot system to ensure PDF matches the displayed report
 */

import { pdf } from '@react-pdf/renderer';
import WeeklyDoc from '@/lib/pdf/WeeklyDoc';
import { registerPDFFonts, getFontRegistrationInfo } from '@/lib/pdf/pdfFonts';
import { fetchWeeklySnapshot } from '@/lib/data/weeklySnapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const t0 = Date.now();
  try {
    // Get snapshot ID from query params
    const url = new URL(request.url);
    const snapshotId = url.searchParams.get('snapshot');
    
    console.log('[weekly-pdf] Generating PDF for snapshot:', snapshotId || 'latest');
    
    // Fetch snapshot data
    const snapshotData = await fetchWeeklySnapshot(snapshotId || undefined);
    
    if (!snapshotData.success) {
      throw new Error(snapshotData.error || 'Failed to load snapshot data');
    }
    
    // Transform snapshot data to match WeeklyDoc expectations
    const data = {
      items: snapshotData.items.slice(0, 20), // Top 20 items
      metrics: snapshotData.metrics,
      generatedAt: snapshotData.builtAt,
      source: 'snapshot' as const,
      snapshotId: snapshotData.snapshotId,
      rangeStart: snapshotData.rangeStart,
      rangeEnd: snapshotData.rangeEnd
    };

    // Register universal PDF font system
    registerPDFFonts();
    const fontInfo = getFontRegistrationInfo();
    
    console.log('[weekly-pdf] Font system registered:', {
      universalFamily: fontInfo.universalFamily,
      hyphenationDisabled: fontInfo.hyphenationDisabled,
      registered: fontInfo.registered
    });

    const instance = pdf(<WeeklyDoc {...data} />);
    const pdfResult = await instance.toBuffer();
    
    // Handle potential ReadableStream from React-PDF
    let buf: Buffer;
    if (pdfResult instanceof ReadableStream) {
      // Convert ReadableStream to Buffer
      const reader = pdfResult.getReader();
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      buf = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)), totalLength);
    } else {
      buf = pdfResult as unknown as Buffer;
    }

    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="TrendSiam-Weekly-Report-${snapshotData.snapshotId.slice(0, 8)}.pdf"`,
        'Cache-Control': 'no-store',
        'X-TS-API': 'weekly-pdf-v2',
        'X-TS-Processing-Time': String(Date.now()-t0),
      },
    });
  } catch (e:any) {
    return new Response(JSON.stringify({
      error: 'PDF generation failed',
      details: e?.message ?? 'unknown',
      timeElapsed: String(Date.now()-t0),
      timestamp: new Date().toISOString(),
    }), { status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-TS-API': 'weekly-pdf-v2' }});
  }
}