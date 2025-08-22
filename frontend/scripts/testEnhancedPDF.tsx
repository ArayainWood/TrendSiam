/**
 * Test Enhanced PDF Generation
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
  
  console.log('[CLI] Fonts registered with enhanced spacing support');
}

// Enhanced spacing functions
const SPACE = ' ';
const DOUBLE_SPACE = '  ';

function addScriptBoundarySpacingV2(text: string): string {
  if (!text) return '';
  
  let processed = String(text);
  
  // Thai ↔ Latin
  processed = processed.replace(/([\u0E00-\u0E7F])([A-Za-z])/g, `$1${SPACE}$2`);
  processed = processed.replace(/([A-Za-z])([\u0E00-\u0E7F])/g, `$1${SPACE}$2`);
  
  // Thai ↔ Number
  processed = processed.replace(/([\u0E00-\u0E7F])([0-9])/g, `$1${SPACE}$2`);
  processed = processed.replace(/([0-9])([\u0E00-\u0E7F])/g, `$1${SPACE}$2`);
  
  // Emoji boundaries - simplified for testing
  processed = processed.replace(/([\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}])([\u0E00-\u0E7FA-Za-z0-9])/gu, `$1${DOUBLE_SPACE}$2`);
  processed = processed.replace(/([\u0E00-\u0E7FA-Za-z0-9])([\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}])/gu, `$1${DOUBLE_SPACE}$2`);
  
  // Punctuation
  processed = processed.replace(/([)\]}])([^\s)\]}\-])/g, `$1${SPACE}$2`);
  
  return processed;
}

function processTitleForPDFV2(title: string): string {
  if (!title) return '';
  
  let processed = addScriptBoundarySpacingV2(title);
  
  // Fix exclamation sequences
  processed = processed.replace(/!{2,}/g, (match) => {
    return match.split('').join(' ');
  });
  
  // Handle parenthetical expressions
  processed = processed.replace(/(\))(?!\s)([A-Za-z\u0E00-\u0E7F])/g, `$1${SPACE}$2`);
  
  // Fix pipe separator
  processed = processed.replace(/\s*\|\s*/g, ' | ');
  
  // Thai + punctuation
  processed = processed.replace(/([\u0E00-\u0E7F])(!+)/g, `$1${SPACE}$2`);
  
  // Clean up multiple spaces
  processed = processed.replace(/\s{3,}/g, '  ');
  
  return processed.trim();
}

// Create enhanced styles
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
  },
  item: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB'
  },
  itemTitle: {
    fontFamily: 'NotoSansThaiUniversal',
    fontSize: 11,
    fontWeight: 'bold',
    lineHeight: 2.0,          // Very generous line height
    letterSpacing: 0.3,       // Increased letter spacing
    wordSpacing: 2,           // Increased word spacing
    marginBottom: 4,
  },
  itemMeta: {
    fontFamily: 'NotoSansThaiUniversal',
    fontSize: 9,
    lineHeight: 1.5,
    color: '#6B7280',
    letterSpacing: 0.05,
  },
  note: {
    fontFamily: 'NotoSansThaiUniversal',
    fontSize: 10,
    color: '#059669',
    marginTop: 20,
  }
});

// Test cases
const PROBLEM_CASES = [
  {
    title: '2,052 KG++ เกาะพังแล้วครับ !!!!🤯ผู้กี่สุด ในชีวิต !!!! | Roblox Grow a Garden',
    category: 'เกม/อนิเมะ (Games/Anime)',
    channel: 'iuccc.'
  },
  {
    title: 'แมพกระโดดแกล้งแปลกๆ (รู้ว่าเราคิดอะไร) Roblox UNEXPECTED Tower',
    category: 'เกม/อนิเมะ (Games/Anime)',
    channel: 'สุดหล่อแห่งป่าน้ำ XD'
  },
  {
    title: 'LISA — DREAM feat. Kentaro Sakaguchi (Official Short Film MV)',
    category: 'บันเทิง (Entertainment)',
    channel: 'LOUD Official'
  },
  {
    title: 'โครตเทพ! ยังเรียกว่าเล่นอีกเรื่อะ!? | Minecraft Gods and Guns EP.25',
    category: 'บันเทิง (Entertainment)',
    channel: 'GWPunch'
  },
  {
    title: '!!!!🤯ผู้กี่สุด ในชีวิต !!!! (Problem Area Test)',
    category: 'Test Case',
    channel: 'Test Channel'
  }
];

// Create test document
function TestEnhancedPDFDoc() {
  registerPDFFontsCLI();
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>
          {processTitleForPDFV2('Enhanced Spacing Test PDF')}
        </Text>
        
        <Text style={styles.note}>
          Testing enhanced spacing with regular spaces and double spaces for emoji
        </Text>
        
        <View style={{ marginTop: 20 }}>
          {PROBLEM_CASES.map((item, idx) => (
            <View key={idx} style={styles.item}>
              <Text style={styles.itemTitle}>
                {processTitleForPDFV2(`${idx + 1}. ${item.title}`)}
              </Text>
              <Text style={styles.itemMeta}>
                {processTitleForPDFV2(`หมวดหมู่: ${item.category} | ช่อง: ${item.channel}`)}
              </Text>
            </View>
          ))}
        </View>
        
        <Text style={styles.note}>
          {processTitleForPDFV2('Note: Check if emoji (🤯) and exclamations (!!!!) have proper spacing')}
        </Text>
      </Page>
    </Document>
  );
}

async function generateTestPDF(): Promise<void> {
  console.log('🧪 Generating enhanced spacing test PDF...');
  
  try {
    const instance = pdf(<TestEnhancedPDFDoc />);
    
    const stream = await instance.toBlob();
    const arrayBuffer = await stream.arrayBuffer();
    const finalBuffer = Buffer.from(arrayBuffer);
    
    const outputPath = join(process.cwd(), 'test-enhanced-spacing.pdf');
    writeFileSync(outputPath, finalBuffer);
    
    console.log(`✅ PDF generated: ${outputPath}`);
    console.log(`📊 File size: ${(finalBuffer.length / 1024).toFixed(1)} KB`);
    
    // Show what spacing was applied
    console.log('\n📝 Spacing applied to problem case:');
    const problemText = '!!!!🤯ผู้กี่สุด';
    const processed = processTitleForPDFV2(problemText);
    console.log(`Original: "${problemText}"`);
    console.log(`Processed: "${processed}"`);
    console.log(`Spacing added: ${processed.length - problemText.length} characters`);
    
  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    throw error;
  }
}

if (require.main === module) {
  generateTestPDF()
    .then(() => {
      console.log('\n🎉 Enhanced spacing PDF test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

export { generateTestPDF };
