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
    
    let pdfUint8Array;
    
    // ตรวจสอบว่าเป็น ReadableStream หรือไม่
    if (pdfResult instanceof ReadableStream) {
      const reader = pdfResult.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      pdfUint8Array = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        pdfUint8Array.set(new Uint8Array(chunk), offset);
        offset += chunk.length;
      }
    } else {
      // แปลง Buffer ที่ได้ให้เป็น Uint8Array
      pdfUint8Array = new Uint8Array(pdfResult as unknown as Buffer);
    }
    
    const blob = new Blob([pdfUint8Array], { type: 'application/pdf' });
    


    return new Response(blob, {
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