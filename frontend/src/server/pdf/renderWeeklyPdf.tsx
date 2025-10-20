import { pdf } from '@react-pdf/renderer';
import { registerPdfFonts } from './fonts';

// Minimal typed shape for snapshot content the renderer expects.
// Do NOT import client components here.
export interface WeeklyPdfInput {
  title: string;
  rangeStart: string; // ISO
  rangeEnd: string;   // ISO
  items: Array<{
    rank: number;
    title: string;
    platform: string;
    score: number;
  }>;
}

// Environment-driven configuration (server-side only)
const ITEM_LIMIT = Number(process.env.WEEKLY_PDF_ITEM_LIMIT ?? 50);
const RENDER_TIMEOUT_MS = Number(process.env.WEEKLY_PDF_RENDER_TIMEOUT_MS ?? 20000);

// Render to Uint8Array with strong guards and predictable timing.
export async function renderWeeklyPdf(
  input: WeeklyPdfInput, 
  opts?: { limit?: number }
): Promise<Uint8Array> {
  registerPdfFonts(); // idempotent font registration

  const itemLimit = opts?.limit ?? ITEM_LIMIT;
  
  // Build a minimal, server-safe React-PDF document to avoid client-only imports.
  // Keep it simple and deterministic for speed.
  const { default: React } = await import('react');
  const { Document, Page, Text, View, StyleSheet } = await import('@react-pdf/renderer');

  const styles = StyleSheet.create({
    page: { 
      padding: 24, 
      fontSize: 11, 
      fontFamily: 'NotoSansThai',
      lineHeight: 1.4
    },
    h1: { 
      fontSize: 20, 
      marginBottom: 8, 
      fontFamily: 'NotoSansThai-Bold',
      textAlign: 'center'
    },
    meta: { 
      marginBottom: 16,
      fontSize: 10,
      color: '#666',
      textAlign: 'center'
    },
    item: { 
      marginBottom: 6,
      paddingBottom: 4,
      borderBottom: '1px solid #eee',
      flexDirection: 'row',
      justifyContent: 'space-between'
    },
    itemLeft: {
      flex: 1,
      paddingRight: 8
    },
    itemRight: {
      width: 80,
      textAlign: 'right',
      fontSize: 10,
      color: '#666'
    },
    rank: {
      fontFamily: 'NotoSansThai-Bold',
      color: '#333'
    }
  });

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return isoString;
    }
  };

  const Doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>{input.title}</Text>
        <Text style={styles.meta}>
          {formatDate(input.rangeStart)} – {formatDate(input.rangeEnd)} • {input.items.length} เรื่อง
        </Text>
        <View>
          {input.items.slice(0, itemLimit).map((it) => (
            <View key={it.rank} style={styles.item}>
              <View style={styles.itemLeft}>
                <Text>
                  <Text style={styles.rank}>#{it.rank}</Text> {it.title}
                </Text>
                <Text style={{ fontSize: 9, color: '#888', marginTop: 2 }}>
                  {it.platform}
                </Text>
              </View>
              <View style={styles.itemRight}>
                <Text>{typeof it.score === 'number' ? it.score.toFixed(1) : it.score}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={{ 
          position: 'absolute', 
          bottom: 20, 
          right: 24, 
          fontSize: 8, 
          color: '#ccc' 
        }}>
          TrendSiam.com
        </Text>
      </Page>
    </Document>
  );

  const instance = pdf(Doc);
  
  // Convert stream to buffer properly with timeout protection
  return renderToBytesWithTimeout(instance as any, RENDER_TIMEOUT_MS);
}

// Helper function for robust stream→buffer conversion with timeout + signature check
async function renderToBytesWithTimeout(
  reactPdfStream: any,
  timeoutMs: number
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    const timer = setTimeout(() => {
      reject(new Error(`PDF generation timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    
    reactPdfStream.on('data', (chunk: any) => {
      if (chunk instanceof Uint8Array) {
        chunks.push(chunk);
      } else if (typeof Buffer !== 'undefined' && chunk instanceof Buffer) {
        chunks.push(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
      } else if (chunk instanceof ArrayBuffer) {
        chunks.push(new Uint8Array(chunk));
      } else {
        // Fallback for unknown chunk types
        chunks.push(new Uint8Array(chunk));
      }
    });

    reactPdfStream.on('end', () => {
      clearTimeout(timer);
      const total = chunks.reduce((n, c) => n + c.byteLength, 0);
      if (total === 0) {
        return reject(new Error('PDF generation returned 0 bytes'));
      }
      
      const out = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { 
        out.set(c, off); 
        off += c.byteLength; 
      }

      // Quick PDF signature sanity check: %PDF
      if (out.byteLength < 4 || out[0] !== 0x25 || out[1] !== 0x50 || out[2] !== 0x44 || out[3] !== 0x46) {
        return reject(new Error('Generated content is not a valid PDF'));
      }
      resolve(out);
    });

    reactPdfStream.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
