
  import React from 'react';
  import { pdf } from '@react-pdf/renderer';
  import MinimalPDF from '@/components/pdf/MinimalPDF';

  export const runtime = 'nodejs';
  export const dynamic = 'force-dynamic';

  export async function GET() {

    try {
      // สร้าง stream จาก react-pdf
      const pdfStream = pdf(<MinimalPDF title="Test PDF" itemCount={5} />);

      // ✅ เก็บชิ้นส่วนเป็น Uint8Array เสมอ (เลี่ยง Buffer)
      const bytes: Uint8Array = await new Promise<Uint8Array>((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        const timeoutId = setTimeout(() => reject(new Error('PDF timeout after 10 seconds')), 10_000);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pdfStream as any).on('data', (chunk: Uint8Array | ArrayBuffer | Buffer) => {
          if (chunk instanceof Uint8Array) {
            chunks.push(chunk);
          } else if (typeof Buffer !== 'undefined' && (chunk as unknown as Buffer).buffer) {
            const b = chunk as unknown as Buffer;
            chunks.push(new Uint8Array(b.buffer, b.byteOffset, b.byteLength));
          } else {
            chunks.push(new Uint8Array(chunk as ArrayBuffer));
          }
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pdfStream as any).on('end', () => {
          clearTimeout(timeoutId);
          const total = chunks.reduce((s, c) => s + c.length, 0);
          const all = new Uint8Array(total);
          let off = 0;
          for (const c of chunks) { all.set(c, off); off += c.length; }
          resolve(all);
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pdfStream as any).on('error', (err: Error) => {
          clearTimeout(timeoutId);
          reject(err);
        });
      });

      // ✅ ส่งออกแบบ ReadableStream (กัน type issue 100%)
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        }
      });
      
      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="test.pdf"',
          'Cache-Control': 'no-store',
        },
      });
    } catch (error: unknown) {
      return new Response(JSON.stringify({ error: 'Test PDF failed', details: (error as Error)?.message ?? String(error) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
