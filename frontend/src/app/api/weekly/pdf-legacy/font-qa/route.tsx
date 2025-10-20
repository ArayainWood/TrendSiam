/**
 * Font QA Test PDF — Multilingual Rendering Test
 * 
 * Generates a test PDF with samples from all supported scripts to verify:
 * - Thai diacritics (tone marks, vowels, stacking)
 * - Korean Hangul (precomposed syllables)
 * - Chinese/Japanese CJK
 * - Arabic/Hebrew RTL scripts
 * - Emoji and symbols
 * 
 * Usage: GET /api/weekly/pdf/font-qa
 */

import { pdf } from '@react-pdf/renderer';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { registerMultilingualFontsForPDF } from '@/lib/pdf/pdfFontsMultilingual';
import { selectFontFamily } from '@/lib/pdf/pdfFontSelector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Test samples for each script
const FONT_QA_SAMPLES = [
  {
    script: 'Thai',
    title: 'Thai Language Test (ภาษาไทย)',
    samples: [
      'สวัสดีครับ ทดสอบภาษาไทย',
      'ก่อน กลาง หลัง ก็ กำ กั้ น',
      'น้ำ ผ้า ไม้ ใจ ใส่ โต๊ะ',
      'ไทย ไกล ใกล้ ไข่ ไหว ไหม',
      'วรรณยุกต์: เอก โท ตรี จัตวา จัตวา',
      'หัวใจรัก ความรักเพลงใหม่ นักร้อง'
    ]
  },
  {
    script: 'Korean',
    title: 'Korean Test (한국어)',
    samples: [
      '안녕하세요 (Hello)',
      '한국어 테스트입니다 (This is a Korean test)',
      'NMIXX 엔믹스 (NMIXX Group Name)',
      'JISOO 지수 × ZAYN',
      '대한민국 서울 (South Korea Seoul)',
      '블랙핑크 아이브 르세라핌'
    ]
  },
  {
    script: 'Japanese',
    title: 'Japanese Test (日本語)',
    samples: [
      'こんにちは (Hello - Hiragana)',
      'カタカナテスト (Katakana test)',
      '日本語のテスト (Japanese test - Mixed)',
      '漢字 ひらがな カタカナ (Kanji Hiragana Katakana)',
      '東京 大阪 京都 (Tokyo Osaka Kyoto)'
    ]
  },
  {
    script: 'Chinese',
    title: 'Chinese Test (中文)',
    samples: [
      '你好世界 (Hello World - Simplified)',
      '中文测试 (Chinese test)',
      '北京 上海 广州 深圳 (Cities)',
      '中国 台湾 香港 (Regions)'
    ]
  },
  {
    script: 'Arabic',
    title: 'Arabic Test (العربية)',
    samples: [
      'مرحبا بك (Welcome)',
      'اختبار اللغة العربية (Arabic language test)',
      'الإمارات العربية المتحدة (UAE)',
      'السلام عليكم (Peace be upon you)'
    ]
  },
  {
    script: 'Hebrew',
    title: 'Hebrew Test (עברית)',
    samples: [
      'שלום (Hello)',
      'בדיקת עברית (Hebrew test)',
      'ישראל (Israel)',
      'תל אביב ירושלים (Tel Aviv Jerusalem)'
    ]
  },
  {
    script: 'Symbols & Emoji',
    title: 'Symbols & Emoji Test',
    samples: [
      '✓ ✗ ★ ☆ ♥ ♦ ♣ ♠',
      '© ® ™ § ¶ † ‡',
      '← → ↑ ↓ ⇐ ⇒ ⇑ ⇓',
      '∞ ≈ ≠ ≤ ≥ ± × ÷',
      '😀 😃 😄 😁 😊 🎉',
      '🔥 ⚡ ✨ 💯 ❤️ 🎵'
    ]
  },
  {
    script: 'Mixed Script',
    title: 'Mixed Script Test (Real-world)',
    samples: [
      'TrendSiam รายงานแนวโน้ม Weekly Report',
      'JISOO × ZAYN - EYES CLOSED (OFFICIAL MV) มิวสิควิดีโอ',
      'NMIXX 엔믹스 K-pop อัลบั้มใหม่ 2024',
      'Japanese 日本語 + Thai ภาษาไทย + English',
      'Korean 한국어 混合 Mixed ผสม Content'
    ]
  },
  {
    script: 'Problematic Items (Items #16 & #20)',
    title: 'Known Problematic Strings from Weekly PDF',
    samples: [
      '99 คืนไป (ภา Q&A) ~~Roblox 99 Nights in the Forest',
      'Trailer 她@Memory Wiped! ₽hen Zheyuan Wakes Up Forgetting Wife~|Fated Hearts一笑倾歌|iQIYI',
      '12. ตัวกินเนื้อ - PAINX x มาลัยความน (Young) DissTrack) [Official Music]',
      '16. 99 คืนไป (ภา Q&A) ~~Roblox 99 Nights in the Forest',
      '20. Trailer 她@Memory Wiped! ₽hen Zheyuan Wakes Up',
      'Special chars: @ # $ % ^ & * ~ | { } [ ] ₽ € £ ¥'
    ]
  }
];

// Styles for Font QA PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'NotoSansThaiUniversal',
    lineHeight: 1.4
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center'
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
    padding: 6
  },
  sample: {
    fontSize: 11,
    marginBottom: 5,
    paddingLeft: 10
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    textAlign: 'center',
    color: '#666'
  }
});

function FontQADoc() {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>
          Font QA Test — TrendSiam Multilingual PDF System
        </Text>
        
        <Text style={{ marginBottom: 20, fontSize: 9, textAlign: 'center', color: '#666' }}>
          Generated: {new Date().toLocaleString('en-US')} | Test all scripts for proper rendering
        </Text>

        {FONT_QA_SAMPLES.map((section, idx) => (
          <View key={idx}>
            <Text style={styles.sectionTitle}>
              {section.script} — {section.title}
            </Text>
            {section.samples.map((sample, sIdx) => {
              // Dynamic font selection per sample
              const selectedFont = selectFontFamily(sample);
              return (
                <Text key={sIdx} style={[styles.sample, { fontFamily: selectedFont }]}>
                  {sample} <Text style={{ fontSize: 7, color: '#999' }}>({selectedFont})</Text>
                </Text>
              );
            })}
          </View>
        ))}

        <View style={styles.footer}>
          <Text>Font QA Test PDF | TrendSiam | Dynamic font selection per text content</Text>
          <Text>If any text shows as boxes (tofu), the font for that script is missing or not registered.</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function GET(request: Request): Promise<Response> {
  try {
    console.log('[font-qa] Generating Font QA Test PDF...');

    // Create mock items with multilingual content for font detection
    const mockItems = FONT_QA_SAMPLES.flatMap(section =>
      section.samples.map(sample => ({
        title: sample,
        category: section.script,
        channel: 'Test Channel',
        popularity_score: 100,
        rank: 1
      }))
    );

    // Register fonts based on test samples
    const fontReport = registerMultilingualFontsForPDF(mockItems);
    
    console.log('[font-qa] Font registration:', {
      success: fontReport.success,
      loadedFamilies: fontReport.loadedFamilies.length,
      detectedScripts: fontReport.detectedScripts.length,
      fallbackMode: fontReport.fallbackMode
    });

    // Generate PDF
    const instance = pdf(<FontQADoc />);
    const blob = await instance.toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      throw new Error('E_BUFFER_EMPTY');
    }

    console.log('[font-qa] ✅ Font QA PDF generated:', buffer.length, 'bytes');

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="trendsiam_font_qa_${new Date().toISOString().split('T')[0]}.pdf"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
        'X-TS-API': 'font-qa-test',
        'X-TS-Fonts-Loaded': String(fontReport.loadedFamilies.length),
        'X-TS-Scripts-Detected': String(fontReport.detectedScripts.length),
        'X-TS-Fallback-Mode': String(fontReport.fallbackMode)
      }
    });

  } catch (error: any) {
    console.error('[font-qa] ❌ Error:', error);
    
    return new Response(JSON.stringify({
      ok: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }
}

