import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import React from 'react';
// ❌ ไม่ต้องใช้ NextResponse
// import { NextResponse } from 'next/server'
import { pdf } from '@react-pdf/renderer';
import MinimalPDF from '@/components/pdf/MinimalPDF';

export async function GET() {
  const startTime = Date.now();

  try {
    // สร้าง stream จาก react-pdf ตามเดิม
    const pdfStream = pdf(<MinimalPDF title="Test PDF" itemCount={5} />);

    // ✅ เก็บเป็น Uint8Array แทน
    const chunks: Uint8Array[] = [];

    const bytes: Uint8Array = await new Promise<Uint8Array>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('PDF timeout after 10 seconds')), 10_000);

      // แปลง data ที่ปล่อยออกมาให้เป็น Uint8Array เสมอ
      (pdfStream as any).on('data', (chunk: Buffer | Uint8Array | ArrayBuffer) => {
        if (chunk instanceof Uint8Array) {
          chunks.push(chunk);
        } else if (typeof Buffer !== 'undefined' && (chunk as any).buffer) {
          // Node Buffer
          chunks.push(new Uint8Array((chunk as any).buffer, (chunk as any).byteOffset ?? 0, (chunk as any).byteLength ?? (chunk as any).length));
        } else if (chunk instanceof ArrayBuffer) {
          chunks.push(new Uint8Array(chunk));
        } else {
          // fallback (ควรไม่เข้าเคสนี้)
          chunks.push(new Uint8Array(chunk as any));
        }
      });

      (pdfStream as any).on('end', () => {
        clearTimeout(timeoutId);
        const total = chunks.reduce((s, c) => s + c.length, 0);
        const all = new Uint8Array(total);
        let off = 0;
        for (const c of chunks) {
          all.set(c, off);
          off += c.length;
        }
        resolve(all);
      });

      (pdfStream as any).on('error', (err: Error) => {
        clearTimeout(timeoutId);
        reject(err);
      });
    });

    const elapsed = Date.now() - startTime;
   // ✅ ใช้ Blob ครอบ bytes
const blob = new Blob([bytes], { type: 'application/pdf' });

return new Response(blob, {
  status: 200,
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'attachment; filename="test.pdf"',
    'Content-Length': String(bytes.byteLength),
    'X-Generation-Time': String(elapsed),
    'Cache-Control': 'no-store',
  },
});


  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Test PDF failed', details: error?.message ?? String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
