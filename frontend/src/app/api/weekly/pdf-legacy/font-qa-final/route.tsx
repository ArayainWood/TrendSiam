/**
 * Font QA Test PDF v2 — UNIFIED TEXT POLICY V1 VALIDATION
 * 
 * Comprehensive test suite for:
 * - Thai diacritics (tone marks, vowels, final consonants, SARA AM)
 * - Korean Hangul (precomposed syllables)
 * - Chinese/Japanese CJK
 * - Special characters and symbols (@, ₽, ~, |, {, }, etc.)
 * - Control character filtering (C0/C1)
 * - Line wrapping and grapheme cluster integrity
 * 
 * Usage: GET /api/weekly/pdf/font-qa?v=final
 */

import { pdf } from '@react-pdf/renderer';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { registerMultilingualFontsForPDF } from '@/lib/pdf/pdfFontsMultilingual';
import { selectFontFamily } from '@/lib/pdf/pdfFontSelector';
import { sanitizeForPdf, analyzeString } from '@/lib/pdf/pdfTextSanitizer.v6.unified';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Test samples organized by policy requirements
const FONT_QA_SAMPLES_FINAL = [
  {
    category: 'Thai Grapheme Integrity (Items #4, #6, #18, #19)',
    title: 'Thai Diacritics, Final Consonants, and Complex Clusters',
    samples: [
      // Real problematic items from Weekly PDF
      'Official Trailer : Broken Of Love หัวใจฮัก',
      '[Official Trailer] โหเกรว่วามันไม่ถูกกัน Head 2 Head',
      'หมอดี อาชีพใหม่ระดับ 5 ดาว | 99 คืนไป',
      'ปฏิบัติการเย็ดนเพพ | Battlefield 6 [Part 2]',
      
      // Thai tone marks stress test
      'ไม่ ใหม่ ได้ ต้อง ว่า ก็ คุณ ที่ เขา เธอ',
      'ก่อน กลาง หลัง น้ำ ผ้า ไม้ ใจ ใส่ โต๊ะ',
      
      // Thai final consonants (all 8 plus special)
      'ก ง ด ต บ ป ม ย ว น ล ะ ๆ',
      'รัก ดัง ผิด มาก ป็อป สุม อยู่ ไกล ไหว คน หาล ระ ซ้ำๆ',
      
      // SARA AM (อำ) test - composed form
      'อำ น้ำ กำ ลำ ตำ บำ',
      
      // Complex stacking and vowel combinations
      'เก็ง เก่ง กำ น้ำ ผ้า ไม้ ใจ โต๊ะ เด็ก',
      'สวัสดีครับ ยินดีต้อนรับ ขอบคุณมาก',
      
      // Thai rare marks and symbols
      'ฯ ฿ ๏ ๚ ๛ (paiyan, baht, fongman, angkhankhu, khomut)',
    ]
  },
  {
    category: 'Special Character Preservation (Items #16, #20)',
    title: 'Control Character Filtering + Symbol Integrity',
    samples: [
      // Item #16 (with simulated C0 control char - will be stripped)
      '99 คืนไป (ภา Q&A) ~~Roblox 99 Nights in the Forest',
      
      // Item #20 (with CJK + special symbols)
      'Trailer 她@Memory Wiped! ₽hen Zheyuan Wakes Up Forgetting Wife~|Fated Hearts一笑倾歌|iQIYI',
      
      // Item #12 (Thai with parentheses and special chars)
      'ตัวกินเนื้อ - PAINX x มาลัยความน (Young) DissTrack) [Official Music]',
      
      // Special symbols that MUST be preserved
      'Symbols: @ # $ % ^ & * ~ | { } [ ] ( )',
      'Currency: ₽ € £ ¥ ₹ ₩ ฿ $',
      'Math: ± × ÷ ≈ ≠ ≤ ≥ ∞ √',
      'Arrows: → ← ↑ ↓ ⇒ ⇐',
      'Bullets: • ◦ ▪ ▫ ■ □',
      
      // CJK characters (Chinese)
      '她 他 们 的 是 不 在 有 人 这 中 一笑倾歌',
    ]
  },
  {
    category: 'Korean Hangul (Item #11)',
    title: 'Korean Precomposed Syllables',
    samples: [
      'NMIXX(엔믹스) "Blue Valentine" M/V',
      '안녕하세요 (Hello)',
      '한국어 테스트입니다 (This is a Korean test)',
      'JISOO 지수 × ZAYN',
      '대한민국 서울 (South Korea Seoul)',
      '블랙핑크 아이브 르세라핌 뉴진스',
    ]
  },
  {
    category: 'CJK Mixed Scripts',
    title: 'Japanese and Chinese Characters',
    samples: [
      'こんにちは (Hello - Hiragana)',
      'カタカナテスト (Katakana test)',
      '日本語のテスト (Japanese test - Mixed)',
      '漢字 ひらがな カタカナ (Kanji Hiragana Katakana)',
      '東京 大阪 京都 (Tokyo Osaka Kyoto)',
      '你好世界 (Hello World - Simplified Chinese)',
      '中文测试 (Chinese test)',
      '北京 上海 广州 深圳 (Cities)',
    ]
  },
  {
    category: 'Mixed Script Real-World',
    title: 'Thai + Latin + CJK + Symbols (Stress Test)',
    samples: [
      'TrendSiam รายงานแนวโน้ม Weekly Report',
      'JISOO × ZAYN - EYES CLOSED (OFFICIAL MV) มิวสิควิดีโอ',
      'NMIXX 엔믹스 K-pop อัลบั้มใหม่ 2024',
      'Japanese 日本語 + Thai ภาษาไทย + English',
      'Korean 한국어 混合 Mixed ผสม Content',
      'Cyberpunk 2077 Collab | ตัวอย่างเกมคอลแล็บดัง 10 - Arena Breakout',
    ]
  },
  {
    category: 'Line Wrapping & Grapheme Clusters',
    title: 'Thai/CJK Safe Line Breaking (No Hyphenation)',
    samples: [
      // Long Thai text to test wrapping
      'สวัสดีครับ ยินดีต้อนรับสู่ระบบทดสอบการแสดงผลภาษาไทยใน PDF ซึ่งต้องแน่ใจว่าตัวอักษรไทยไม่มีปัญหาในการแสดงผล',
      
      // Long mixed script text
      'This is a very long title in English combined with ภาษาไทยที่มีความยาวมากเพื่อทดสอบการขึ้นบรรทัดใหม่ and should wrap correctly without breaking Thai grapheme clusters or inserting hyphens in Thai text',
      
      // Korean long text
      '이것은 한국어로 작성된 매우 긴 제목입니다 그리고 PDF에서 올바르게 줄 바꿈되어야 합니다',
      
      // CJK long text
      '这是一个用中文写的很长的标题它应该在PDF中正确地换行而不会破坏字符',
    ]
  },
  {
    category: 'Emoji & Symbols',
    title: 'Emoji Sequences and Technical Symbols',
    samples: [
      '✓ ✗ ★ ☆ ♥ ♦ ♣ ♠',
      '© ® ™ § ¶ † ‡',
      '← → ↑ ↓ ⇐ ⇒ ⇑ ⇓',
      '∞ ≈ ≠ ≤ ≥ ± × ÷',
      '😀 😃 😄 😁 😊 🎉',
      '🔥 ⚡ ✨ 💯 ❤️ 🎵',
    ]
  },
];

// Styles for Font QA PDF - UNIFIED TEXT POLICY V1 COMPLIANT
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'NotoSansThaiUniversal',
    lineHeight: 1.4,
    letterSpacing: 0, // POLICY: Must be 0 for Thai/CJK
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0,
  },
  subheader: {
    fontSize: 11,
    marginBottom: 20,
    textAlign: 'center',
    color: '#666',
    letterSpacing: 0,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 18,
    marginBottom: 4,
    backgroundColor: '#f0f0f0',
    padding: 6,
    letterSpacing: 0,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 6,
    color: '#333',
    letterSpacing: 0,
  },
  sample: {
    fontSize: 11,
    marginBottom: 5,
    paddingLeft: 10,
    lineHeight: 1.5,
    letterSpacing: 0, // POLICY: Must be 0
  },
  fontLabel: {
    fontSize: 7,
    color: '#999',
    letterSpacing: 0,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    textAlign: 'center',
    color: '#666',
    letterSpacing: 0,
  }
});

function FontQADocFinal() {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>
          Font QA Test v2 — Unified Text Policy v1 Validation
        </Text>
        
        <Text style={styles.subheader}>
          Generated: {new Date().toLocaleString('en-US')} | Test suite for Thai graphemes, CJK, symbols, control chars
        </Text>

        {FONT_QA_SAMPLES_FINAL.map((category, catIdx) => (
          <View key={catIdx}>
            <Text style={styles.categoryTitle}>
              {category.category}
            </Text>
            <Text style={styles.sectionTitle}>
              {category.title}
            </Text>
            {category.samples.map((sample, sIdx) => {
              // Apply unified sanitizer (will log control chars if any)
              const cleanSample = sanitizeForPdf(sample, `qa-cat${catIdx+1}-s${sIdx+1}`);
              
              // Dynamic font selection per sample
              const selectedFont = selectFontFamily(cleanSample);
              
              return (
                <Text key={sIdx} style={[styles.sample, { fontFamily: selectedFont }]}>
                  {cleanSample} <Text style={styles.fontLabel}>({selectedFont})</Text>
                </Text>
              );
            })}
          </View>
        ))}

        <View style={styles.footer}>
          <Text>Font QA Test PDF v2 | TrendSiam | Unified Text Policy v1</Text>
          <Text>letterSpacing=0, hyphenation=OFF, C0/C1 filtered, NFC normalized, grapheme-aware</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function GET(request: Request): Promise<Response> {
  try {
    console.log('[font-qa-final] Generating Font QA Test PDF (Unified Text Policy v1)...');

    // Create mock items with multilingual content for font detection
    const mockItems = FONT_QA_SAMPLES_FINAL.flatMap(category =>
      category.samples.map(sample => ({
        title: sample,
        category: category.category,
        channel: 'QA Test Channel',
        popularity_score: 100,
        rank: 1
      }))
    );

    // Register fonts based on test samples
    const fontReport = registerMultilingualFontsForPDF(mockItems);
    
    console.log('[font-qa-final] Font registration:', {
      success: fontReport.success,
      loadedFamilies: fontReport.loadedFamilies.length,
      detectedScripts: fontReport.detectedScripts.length,
      fallbackMode: fontReport.fallbackMode,
      families: fontReport.loadedFamilies
    });

    // Generate PDF
    const instance = pdf(<FontQADocFinal />);
    const blob = await instance.toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      throw new Error('E_BUFFER_EMPTY');
    }

    console.log('[font-qa-final] ✅ Font QA PDF v2 generated:', buffer.length, 'bytes');

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="trendsiam_font_qa_final_${new Date().toISOString().split('T')[0]}.pdf"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
        'X-TS-API': 'font-qa-final-unified-policy-v1',
        'X-TS-Fonts-Loaded': String(fontReport.loadedFamilies.length),
        'X-TS-Scripts-Detected': String(fontReport.detectedScripts.length),
        'X-TS-Fallback-Mode': String(fontReport.fallbackMode),
        'X-TS-Policy': 'unified-text-policy-v1'
      }
    });

  } catch (error: any) {
    console.error('[font-qa-final] ❌ Error:', error);
    
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

