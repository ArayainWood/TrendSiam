/**
 * CLI Test Script for Mixed-Script PDF Rendering v1
 * 
 * Tests the PDF font system and spacing fixes with known problematic strings
 * Generates a test PDF to verify no overlapping/colliding glyphs
 */

import React from 'react';
import { pdf, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { writeFileSync } from 'fs';
import { join } from 'path';
import path from 'path';
import fs from 'fs';

// CLI-compatible font resolver (without server-only)
function resolveThaiFontsCLI() {
  const candidates = [
    path.join(process.cwd(), 'public', 'fonts', 'NotoSansThai'),
    path.join(process.cwd(), 'frontend', 'public', 'fonts', 'NotoSansThai'),
    path.join(process.cwd(), 'public', 'fonts'),
    path.join(process.cwd(), 'frontend', 'public', 'fonts'),
  ];

  const base = candidates.find(basePath => {
    if (!fs.existsSync(basePath)) return false;
    const directoryBased = fs.existsSync(path.join(basePath, 'NotoSansThai-Regular.ttf'));
    const flatBased = fs.existsSync(path.join(basePath, 'NotoSansThai-Regular.ttf'));
    return directoryBased || flatBased;
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

  return { REG, BOLD, base };
}

// CLI-compatible font registration
function registerPDFFontsCLI() {
  const { REG, BOLD } = resolveThaiFontsCLI();
  
  Font.register({
    family: 'NotoSansThaiUniversal',
    fonts: [
      { src: REG, fontWeight: 'normal' },
      { src: BOLD, fontWeight: 'bold' },
    ]
  });
  
  const systemFonts = ['Helvetica', 'Arial', 'sans-serif', 'Times', 'serif'];
  systemFonts.forEach(fontName => {
    Font.register({
      family: fontName,
      fonts: [
        { src: REG, fontWeight: 'normal' },
        { src: BOLD, fontWeight: 'bold' },
      ]
    });
  });
  
  Font.registerHyphenationCallback((word: string) => [word]);
  
  console.log('[CLI] Universal font system registered');
}

// CLI-compatible spacing processor
function addScriptBoundarySpacingCLI(text: string): string {
  if (!text) return '';
  
  const HAIR_SPACE = '\u200A';
  const THIN_SPACE = '\u2009';
  
  let processed = String(text);
  
  // Thai ↔ Latin transitions
  processed = processed.replace(/([\u0E00-\u0E7F])([A-Za-z])/g, `$1${HAIR_SPACE}$2`);
  processed = processed.replace(/([A-Za-z])([\u0E00-\u0E7F])/g, `$1${HAIR_SPACE}$2`);
  
  // Thai ↔ Number transitions
  processed = processed.replace(/([\u0E00-\u0E7F])([0-9])/g, `$1${HAIR_SPACE}$2`);
  processed = processed.replace(/([0-9])([\u0E00-\u0E7F])/g, `$1${HAIR_SPACE}$2`);
  
  // Latin ↔ Number transitions
  processed = processed.replace(/([A-Za-z])([0-9])/g, `$1${HAIR_SPACE}$2`);
  processed = processed.replace(/([0-9])([A-Za-z])/g, `$1${HAIR_SPACE}$2`);
  
  // Emoji boundaries (using basic emoji ranges)
  processed = processed.replace(/([\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}])([\u0E00-\u0E7FA-Za-z0-9])/gu, `$1${THIN_SPACE}$2`);
  processed = processed.replace(/([\u0E00-\u0E7FA-Za-z0-9])([\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}])/gu, `$1${THIN_SPACE}$2`);
  
  // Special patterns
  processed = processed.replace(/(\d+)([A-Z]+)(\++)/g, `$1${HAIR_SPACE}$2$3`);
  processed = processed.replace(/([!]{2,})/g, (match) => match.split('').join('\u200A'));
  processed = processed.replace(/(\))(\s*)([A-Za-z\u0E00-\u0E7F])/g, `$1${HAIR_SPACE}$3`);
  processed = processed.replace(/(\s*)\|(\s*)/g, ` | `);
  processed = processed.replace(/[ ]{2,}/g, ' ');
  
  return processed.trim();
}

// CLI-compatible styles
const createCLIStyles = () => StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: 'NotoSansThaiUniversal',
    fontKerning: 'normal',
  },
  text: {
    fontFamily: 'NotoSansThaiUniversal',
    fontSize: 12,
    lineHeight: 1.65,
    letterSpacing: 0.1,
    wordSpacing: 1,
    fontKerning: 'normal',
  },
  h1: {
    fontFamily: 'NotoSansThaiUniversal',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 1.5,
    marginBottom: 8,
    letterSpacing: 0,
    fontKerning: 'normal',
  },
  h2: {
    fontFamily: 'NotoSansThaiUniversal',
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 1.5,
    marginBottom: 6,
    letterSpacing: 0,
    fontKerning: 'normal',
  },
  item: {
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB'
  },
  itemTitle: {
    fontFamily: 'NotoSansThaiUniversal',
    fontSize: 11,
    fontWeight: 'bold',
    lineHeight: 1.75,
    marginBottom: 4,
    letterSpacing: 0.15,
    wordSpacing: 1.5,
    textAlign: 'left',
    maxWidth: '100%',
    overflow: 'hidden',
    fontKerning: 'normal',
  },
  itemMeta: {
    fontFamily: 'NotoSansThaiUniversal',
    fontSize: 9,
    lineHeight: 1.5,
    color: '#6B7280',
    letterSpacing: 0.05,
    fontKerning: 'normal',
  },
  footer: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB'
  },
  footerText: {
    fontFamily: 'NotoSansThaiUniversal',
    fontSize: 10,
    lineHeight: 1.4,
    color: '#6B7280',
    fontKerning: 'normal',
  },
  thaiTest: {
    fontFamily: 'NotoSansThaiUniversal',
    fontSize: 10,
    lineHeight: 1.4,
    color: '#059669',
    marginBottom: 10,
    letterSpacing: 0,
    fontKerning: 'normal',
  }
});

// Test cases from the problematic examples
const TEST_CASES = [
  {
    title: 'แมพกระโดดแกล้งแปลกๆ (รู้ว่าเราคิดอะไร) Roblox UNEXPECTED Tower',
    category: 'เกม/อนิเมะ (Games/Anime)',
    channel: 'สุดหล่อแห่งป่าน้ำ XD',
    score: '69.13880800942286'
  },
  {
    title: '2,052 KG++ เกาะพังแล้วครับ !!!!🤯ผู้กี่สุด ในชีวิต !!!! | Roblox Grow a Garden',
    category: 'เกม/อนิเมะ (Games/Anime)',
    channel: 'iuccc.',
    score: '56.63818880967680'
  },
  {
    title: 'LISA — DREAM feat. Kentaro Sakaguchi (Official Short Film MV)',
    category: 'บันเทิง (Entertainment)',
    channel: 'LOUD Official',
    score: '89.63000000000000'
  },
  {
    title: 'โครตเทพ! ยังเรียกว่าเล่นอีกเรื่อะ!? | Minecraft Gods and Guns EP.25',
    category: 'บันเทิง (Entertainment)',
    channel: 'GWPunch',
    score: '81.06111111111111'
  },
  {
    title: 'Mark Tuan — hold still (Official Music Video)',
    category: 'บันเทิง (Entertainment)',
    channel: 'Mark Tuan',
    score: '80.96519880588181'
  },
  {
    title: 'MV full1-Gatsu no Anklet - กิโลลิตรกำแพงความรอง🎵 / BNK48',
    category: 'บันเทิง (Entertainment)',
    channel: 'BNK48',
    score: '78.76333333333334'
  },
  {
    title: 'Demon Slayer: Kimetsu no Yaiba Infinity Castle | V5 VISUAL 2 TRAILER',
    category: 'บันเทิง (Entertainment)',
    channel: 'Aniplex USA',
    score: '66.99140844779932'
  }
];

// Create test PDF component
function TestMixedScriptDoc() {
  registerPDFFontsCLI();
  const styles = createCLIStyles();
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <Text style={styles.h1}>
          {addScriptBoundarySpacingCLI('TrendSiam Mixed-Script PDF Test')}
        </Text>
        
        {/* Font info */}
        <Text style={styles.thaiTest}>
          {addScriptBoundarySpacingCLI('Font System: NotoSansThaiUniversal | Hyphenation: Disabled')}
        </Text>
        
        {/* Test description */}
        <Text style={styles.text}>
          {addScriptBoundarySpacingCLI('Testing problematic Thai + Latin + emoji combinations that previously caused overlapping:')}
        </Text>
        
        <View style={{ marginTop: 16, marginBottom: 16 }}>
          {TEST_CASES.map((testCase, idx) => (
            <View key={idx} style={styles.item}>
              <Text style={styles.itemTitle}>
                {addScriptBoundarySpacingCLI(`${idx + 1}. ${testCase.title}`)}
              </Text>
              <Text style={styles.itemMeta}>
                {addScriptBoundarySpacingCLI(`หมวดหมู่: ${testCase.category} | ช่อง: ${testCase.channel} | คะแนน: ${testCase.score}`)}
              </Text>
            </View>
          ))}
        </View>
        
        {/* Specific problematic patterns */}
        <Text style={styles.h2}>
          {addScriptBoundarySpacingCLI('Specific Pattern Tests')}
        </Text>
        
        <View style={{ marginTop: 8 }}>
          <Text style={styles.itemTitle}>
            {addScriptBoundarySpacingCLI('Numbers + Letters + Punctuation: 2,052 KG++ !!!!🤯')}
          </Text>
          <Text style={styles.itemTitle}>
            {addScriptBoundarySpacingCLI('Thai + Parentheses + Latin: แมพกระโดด (รู้ว่าเราคิด) Roblox')}
          </Text>
          <Text style={styles.itemTitle}>
            {addScriptBoundarySpacingCLI('Emoji + Exclamations: 🤯ผู้กี่สุด ในชีวิต !!!!')}
          </Text>
          <Text style={styles.itemTitle}>
            {addScriptBoundarySpacingCLI('Mixed Scripts + Pipe: โครตเทพ! | Minecraft Gods')}
          </Text>
          <Text style={styles.itemTitle}>
            {addScriptBoundarySpacingCLI('Em Dash + Mixed: LISA — DREAM feat. Kentaro')}
          </Text>
        </View>
        
        {/* Footer with generation info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {addScriptBoundarySpacingCLI(`Generated: ${new Date().toISOString()}`)}
          </Text>
          <Text style={styles.footerText}>
            {addScriptBoundarySpacingCLI('If text appears overlapped/colliding, the fix needs adjustment.')}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

async function generateTestPDF(): Promise<void> {
  console.log('🧪 [testMixedScriptPDF] Starting mixed-script PDF test...');
  
  try {
    console.log('\n🔧 Generating test PDF...');
    
    // Generate PDF
    const instance = pdf(<TestMixedScriptDoc />);
    
    // Use the stream approach
    const stream = await instance.toBlob();
    const arrayBuffer = await stream.arrayBuffer();
    const finalBuffer = Buffer.from(arrayBuffer);
    
    // Save to file
    const outputPath = join(process.cwd(), 'test-mixed-script.pdf');
    writeFileSync(outputPath, finalBuffer);
    
    console.log(`✅ Test PDF generated successfully: ${outputPath}`);
    console.log(`📊 File size: ${(finalBuffer.length / 1024).toFixed(1)} KB`);
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Open test-mixed-script.pdf in a PDF viewer');
    console.log('2. Check for overlapping/colliding text in the test cases');
    console.log('3. Verify proper spacing between Thai, Latin, numbers, and emoji');
    console.log('4. If issues remain, adjust spacing values in the PDF system');
    
  } catch (error) {
    console.error('❌ Test PDF generation failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  generateTestPDF()
    .then(() => {
      console.log('\n🎉 Mixed-script PDF test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Mixed-script PDF test failed:', error);
      process.exit(1);
    });
}

export { generateTestPDF, TestMixedScriptDoc };