/**
 * Test Thai Character Rendering in PDF
 */

import React from 'react';
import { pdf, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { writeFileSync } from 'fs';
import { join } from 'path';
import path from 'path';
import fs from 'fs';

// CLI-compatible font resolver
function resolveThaiFontsCLI() {
  const candidates = [
    path.join(process.cwd(), 'public', 'fonts', 'NotoSansThai'),
    path.join(process.cwd(), 'public', 'fonts'),
  ];

  const base = candidates.find(basePath => {
    if (!fs.existsSync(basePath)) return false;
    return fs.existsSync(path.join(basePath, 'NotoSansThai-Regular.ttf'));
  });

  if (!base) {
    throw new Error('Thai font base directory not found');
  }

  let REG = path.join(base, 'NotoSansThai-Regular.ttf');
  let BOLD = path.join(base, 'NotoSansThai-Bold.ttf');

  if (!fs.existsSync(REG)) {
    REG = path.join(base, 'NotoSansThai', 'NotoSansThai-Regular.ttf');
    BOLD = path.join(base, 'NotoSansThai', 'NotoSansThai-Bold.ttf');
  }

  return { REG, BOLD };
}

// Register fonts
function registerPDFFontsCLI() {
  const { REG, BOLD } = resolveThaiFontsCLI();
  
  Font.register({
    family: 'NotoSansThaiUniversal',
    fonts: [
      { src: REG, fontWeight: 'normal', fontStyle: 'normal' },
      { src: BOLD, fontWeight: 'bold', fontStyle: 'normal' },
    ]
  });
  
  // Override system fonts
  ['Helvetica', 'Arial', 'sans-serif'].forEach(fontName => {
    Font.register({
      family: fontName,
      fonts: [
        { src: REG, fontWeight: 'normal' },
        { src: BOLD, fontWeight: 'bold' },
      ]
    });
  });
  
  Font.registerHyphenationCallback((word: string) => [word]);
  
  console.log('[CLI] Fonts registered with Thai rendering support');
}

// Enhanced spacing functions from V2
const SPACE = ' ';
const DOUBLE_SPACE = '  ';

function processTitleForPDFV2(title: string): string {
  if (!title) return '';
  
  let processed = String(title);
  
  // Thai ↔ Latin
  processed = processed.replace(/([\u0E00-\u0E7F])([A-Za-z])/g, `$1${SPACE}$2`);
  processed = processed.replace(/([A-Za-z])([\u0E00-\u0E7F])/g, `$1${SPACE}$2`);
  
  // Thai ↔ Number
  processed = processed.replace(/([\u0E00-\u0E7F])([0-9])/g, `$1${SPACE}$2`);
  processed = processed.replace(/([0-9])([\u0E00-\u0E7F])/g, `$1${SPACE}$2`);
  
  // Emoji boundaries
  processed = processed.replace(/([\u{1F300}-\u{1F9FF}])([\u0E00-\u0E7F])/gu, `$1${DOUBLE_SPACE}$2`);
  processed = processed.replace(/([\u0E00-\u0E7F])([\u{1F300}-\u{1F9FF}])/gu, `$1${DOUBLE_SPACE}$2`);
  
  // Long exclamation sequences
  processed = processed.replace(/!{4,}/g, (match) => match.split('').join(' '));
  
  // Pipe separator
  processed = processed.replace(/\s*\|\s*/g, ' | ');
  
  // Thai + punctuation
  processed = processed.replace(/([\u0E00-\u0E7F])(!+)/g, `$1${SPACE}$2`);
  
  return processed.trim();
}

// Create enhanced styles with Thai rendering fixes
const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: 'NotoSansThaiUniversal',
  },
  title: {
    fontFamily: 'NotoSansThaiUniversal',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    lineHeight: 2.0,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: 'NotoSansThaiUniversal',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#374151',
  },
  item: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB'
  },
  // Updated style matching the fixed version
  itemTitle: {
    fontFamily: 'NotoSansThaiUniversal',
    fontSize: 11,
    fontWeight: 'bold',
    lineHeight: 2.5,         // Extra line height for Thai tone marks
    marginBottom: 6,
    letterSpacing: 0.2,
    paddingTop: 2,
    paddingBottom: 2,
  },
  itemMeta: {
    fontFamily: 'NotoSansThaiUniversal',
    fontSize: 9,
    lineHeight: 1.8,         // Increased for Thai marks
    color: '#6B7280',
    letterSpacing: 0,
    paddingTop: 1,
    paddingBottom: 1,
  },
  note: {
    fontFamily: 'NotoSansThaiUniversal',
    fontSize: 10,
    color: '#059669',
    marginTop: 10,
  },
  testCase: {
    fontFamily: 'NotoSansThaiUniversal',
    fontSize: 11,
    lineHeight: 2.5,
    marginBottom: 8,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
  }
});

// Thai rendering test cases
const THAI_TEST_CASES = [
  {
    title: 'ผู้กี่สุด ในชีวิต',
    description: 'Testing Thai tone marks ี่ and ุ'
  },
  {
    title: 'เขาญที่สุด ในชีวิต',
    description: 'Testing ญ with tone marks'
  },
  {
    title: 'ปู่ ย่า ตา ยาย',
    description: 'Testing tone marks ู่ and ่า'
  },
  {
    title: 'กิ๊ก ก๊าก กุ๊ก',
    description: 'Testing mai ek (่) and mai tho (้)'
  },
  {
    title: 'ฟังก์ชั่น คำสั่ง',
    description: 'Testing mai han akat (์) and mai chattawa (ั่)'
  },
  {
    title: '!!!!🤯ผู้กี่สุด ในชีวิต !!!!',
    description: 'Original problematic case with emoji'
  },
  {
    title: '2,052 KG++ เกาะพังแล้วครับ !!!!🤯ผู้กี่สุด ในชีวิต !!!! | Roblox Grow a Garden',
    description: 'Full problematic title'
  }
];

// Create test document
function ThaiRenderingTestDoc() {
  registerPDFFontsCLI();
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>
          Thai Character Rendering Test
        </Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Basic Thai Tone Mark Tests
          </Text>
          {THAI_TEST_CASES.slice(0, 5).map((testCase, idx) => (
            <View key={idx} style={styles.item}>
              <Text style={styles.testCase}>
                {testCase.title}
              </Text>
              <Text style={styles.itemMeta}>
                {testCase.description}
              </Text>
            </View>
          ))}
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Problematic Cases with Processing
          </Text>
          {THAI_TEST_CASES.slice(5).map((testCase, idx) => (
            <View key={idx} style={styles.item}>
              <Text style={styles.itemTitle}>
                Original: {testCase.title}
              </Text>
              <Text style={styles.itemTitle}>
                Processed: {processTitleForPDFV2(testCase.title)}
              </Text>
              <Text style={styles.itemMeta}>
                {testCase.description}
              </Text>
            </View>
          ))}
        </View>
        
        <Text style={styles.note}>
          Check if Thai tone marks (ี่ ุ ู่ ่า ั่ ์) are properly displayed without clipping
        </Text>
      </Page>
    </Document>
  );
}

async function generateTestPDF(): Promise<void> {
  console.log('🧪 Generating Thai rendering test PDF...');
  
  try {
    const instance = pdf(<ThaiRenderingTestDoc />);
    
    const stream = await instance.toBlob();
    const arrayBuffer = await stream.arrayBuffer();
    const finalBuffer = Buffer.from(arrayBuffer);
    
    const outputPath = join(process.cwd(), 'test-thai-rendering.pdf');
    writeFileSync(outputPath, finalBuffer);
    
    console.log(`✅ PDF generated: ${outputPath}`);
    console.log(`📊 File size: ${(finalBuffer.length / 1024).toFixed(1)} KB`);
    
    // Show applied fixes
    console.log('\n📝 Key fixes applied:');
    console.log('- Line height: 2.5 (increased from 1.75)');
    console.log('- Padding top/bottom: 2px for titles');
    console.log('- Letter spacing: 0.2 (reduced from 0.3)');
    console.log('- Overflow: hidden (React-PDF limitation)');
    
  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    throw error;
  }
}

if (require.main === module) {
  generateTestPDF()
    .then(() => {
      console.log('\n🎉 Thai rendering test PDF completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

export { generateTestPDF };
