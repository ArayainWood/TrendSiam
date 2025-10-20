/**
 * Weekly PDF Generation API v8
 * 
 * Uses snapshot system to ensure PDF matches the displayed report
 * Hardened with robust Buffer handling and structured error codes
 */

import { pdf } from '@react-pdf/renderer';
import WeeklyDoc from '@/lib/pdf/WeeklyDoc';
import { registerMultilingualFontsForPDF, getUniversalFontFamily } from '@/lib/pdf/pdfFontsMultilingual';
import { fetchWeeklySnapshot } from '@/lib/data/weeklySnapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Robust PDF buffer renderer for @react-pdf/renderer v4
 * 
 * @react-pdf/renderer v4 API:
 * - toBlob() returns a Blob (available in Node.js)
 * - toBuffer() does NOT exist in v4
 */
async function renderPdfBuffer(doc: JSX.Element): Promise<Buffer> {
  const instance = pdf(doc);
  
  // Use toBlob() for @react-pdf/renderer v4 (correct API)
  const blob = await instance.toBlob();
  
  // Convert Blob to Buffer
  const arrayBuffer = await blob.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  
  if (!buf || buf.length === 0) {
    throw new Error('E_BUFFER_EMPTY');
  }
  
  // Quick signature check: "%PDF"
  const sig = buf.subarray(0, 4).toString('utf8');
  if (sig !== '%PDF') {
    throw new Error('E_BUFFER_SIGNATURE');
  }
  
  console.log('[weekly-pdf/renderPdfBuffer] PDF buffer created:', buf.length, 'bytes');
  
  return buf;
}

/**
 * Convert ReadableStream to Node Buffer (fallback for some environments)
 */
function webStreamToNodeBuffer(stream: ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    
    const pump = () => {
      reader.read().then(({ value, done }) => {
        if (done) {
          resolve(Buffer.concat(chunks.map(c => Buffer.from(c))));
          return;
        }
        if (value) chunks.push(value);
        pump();
      }).catch(reject);
    };
    
    pump();
  });
}

export async function GET(request: Request): Promise<Response> {
  const t0 = Date.now();
  let errorCode = 'E_OK';
  
  try {
    const url = new URL(request.url);
    const snapshotId = url.searchParams.get('snapshot');
    const cacheBuster = url.searchParams.get('ts'); // Fresh data flag
    
    console.log('[weekly-pdf] Generating PDF for snapshot:', snapshotId || 'latest', cacheBuster ? '(fresh data)' : '(cached)');
    
    // Fetch snapshot data
    errorCode = 'E_DATA';
    const snapshotData = await fetchWeeklySnapshot(snapshotId || undefined);
    
    if (!snapshotData.success) {
      throw new Error(snapshotData.error || 'Failed to load snapshot data');
    }
    
    // Prepare data for PDF generation
    const data = {
      items: snapshotData.items.slice(0, 20),
      metrics: snapshotData.metrics,
      generatedAt: snapshotData.builtAt,
      source: 'snapshot' as const,
      snapshotId: snapshotData.snapshotId,
      rangeStart: snapshotData.rangeStart,
      rangeEnd: snapshotData.rangeEnd
    };

    // Generate filename with Asia/Bangkok date
    const bangkokDate = new Date().toLocaleDateString('sv-SE', { 
      timeZone: 'Asia/Bangkok' 
    }); // YYYY-MM-DD format

    // Register fonts (multilingual, script-aware)
    errorCode = 'E_FONT';
    const fontReport = registerMultilingualFontsForPDF(data.items);
    
    console.log('[weekly-pdf] Font system registered:', {
      success: fontReport.success,
      primaryFamily: fontReport.primaryFamily,
      loadedFamilies: fontReport.loadedFamilies,
      detectedScripts: fontReport.detectedScripts,
      fallbackMode: fontReport.fallbackMode,
      message: fontReport.message
    });

    // Generate PDF
    errorCode = 'E_PDF';
    const buf = await renderPdfBuffer(<WeeklyDoc {...data} />);

    console.log(`[weekly-pdf] ✅ PDF generated successfully: ${buf.length} bytes`);

    // Return PDF with proper headers (cast Buffer to Uint8Array for Response)
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="trendsiam_weekly_${bangkokDate}.pdf"`,
        'Content-Length': String(buf.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-TS-API': 'weekly-pdf-v8',
        'X-TS-Processing-Time': String(Date.now()-t0),
        'X-TS-Data-Source': data.source,
        'X-TS-Items-Count': String(data.items.length),
      },
    });
    
  } catch (err: any) {
    errorCode = (err?.message || '').startsWith('E_') ? err.message : 'E_PDF';
    console.error(`[weekly-pdf] ${errorCode}:`, err?.message || err);
    
    return new Response(JSON.stringify({ 
      ok: false, 
      error: errorCode,
      details: err?.message || 'Unknown error',
      timeElapsed: String(Date.now()-t0),
      timestamp: new Date().toISOString(),
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-TS-API': 'weekly-pdf-v8',
        'X-TS-Error-Code': errorCode
      }
    });
  }
}