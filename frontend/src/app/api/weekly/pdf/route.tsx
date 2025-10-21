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
    const url = new URL(request.url);
    const snapshotId = url.searchParams.get('snapshot');
    
    console.log('[weekly-pdf] Generating PDF for snapshot:', snapshotId || 'latest');
    
    const snapshotData = await fetchWeeklySnapshot(snapshotId || undefined);
    
    if (!snapshotData.success) {
      throw new Error(snapshotData.error || 'Failed to load snapshot data');
    }
    
    const data = {
      items: snapshotData.items.slice(0, 20),
      metrics: snapshotData.metrics,
      generatedAt: snapshotData.builtAt,
      source: 'snapshot' as const,
      snapshotId: snapshotData.snapshotId,
      rangeStart: snapshotData.rangeStart,
      rangeEnd: snapshotData.rangeEnd
    };

    registerPDFFonts();
    const fontInfo = getFontRegistrationInfo();
    
    console.log('[weekly-pdf] Font system registered:', {
      universalFamily: fontInfo.universalFamily,
      hyphenationDisabled: fontInfo.hyphenationDisabled,
      registered: fontInfo.registered
    });

    const instance = pdf(<WeeklyDoc {...data} />);
    const pdfResult = await instance.toBuffer();
    
    const buf = pdfResult as unknown as Buffer;
    const uint8Array = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(uint8Array);
        controller.close();
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="TrendSiam-Weekly-Report-${snapshotData.snapshotId.slice(0, 8)}.pdf"`,
        'Cache-Control': 'no-store',
        'X-TS-API': 'weekly-pdf-v2',
        'X-TS-Processing-Time': String(Date.now()-t0),
      },
    });
  } catch (e: unknown) {
    return new Response(JSON.stringify({
      error: 'PDF generation failed',
      details: (e as Error)?.message ?? 'unknown',
      timeElapsed: String(Date.now()-t0),
      timestamp: new Date().toISOString(),
    }), { status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-TS-API': 'weekly-pdf-v2' }});
  }
}