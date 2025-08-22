/**
 * Test PDF Route - Minimal Implementation
 */

import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import React from 'react';
import { NextResponse } from 'next/server';
import { pdf } from '@react-pdf/renderer';
import MinimalPDF from '@/components/pdf/MinimalPDF';

export async function GET() {
  console.log('[test-pdf] 🧪 Testing minimal PDF generation...');
  
  try {
    const startTime = Date.now();
    
    // Generate minimal PDF
    const pdfStream = pdf(<MinimalPDF title="Test PDF" itemCount={5} />);
    const chunks: Uint8Array[] = [];

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('PDF timeout after 10 seconds'));
      }, 10000);

      (pdfStream as any).on('data', (chunk: any) => {
        chunks.push(chunk);
      });

      (pdfStream as any).on('end', () => {
        clearTimeout(timeoutId);
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const buffer = Buffer.allocUnsafe(totalLength);
        let offset = 0;
        
        for (const chunk of chunks) {
          buffer.set(chunk, offset);
          offset += chunk.length;
        }
        
        resolve(buffer);
      });

      (pdfStream as any).on('error', (error: Error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });

    const elapsedTime = Date.now() - startTime;
    console.log(`[test-pdf] ✅ PDF generated in ${elapsedTime}ms (${buffer.length} bytes)`);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="test.pdf"',
        'X-Generation-Time': String(elapsedTime),
      },
    });

  } catch (error: any) {
    console.error('[test-pdf] ❌ Error:', error);
    return NextResponse.json({
      error: 'Test PDF failed',
      details: error.message
    }, { status: 500 });
  }
}
