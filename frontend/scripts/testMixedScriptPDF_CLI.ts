/**
 * CLI Test Script for Mixed-Script PDF Rendering v1
 * 
 * Tests the PDF font system and spacing fixes with known problematic strings
 * Generates a test PDF to verify no overlapping/colliding glyphs
 */

import React from 'react';
import { pdf, Document, Page, Text, View } from '@react-pdf/renderer';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { registerPDFFonts, getFontRegistrationInfo } from '../src/lib/pdf/pdfFonts';
import { processTitleForPDF, processMetadataForPDF, testScriptBoundarySpacing } from '../src/lib/pdf/pdfTypo';
import { createPDFStyles } from '../src/lib/pdf/pdfStyles';

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
  // Register fonts and get styles
  registerPDFFonts();
  const styles = createPDFStyles();
  const fontInfo = getFontRegistrationInfo();
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <Text style={styles.h1}>
          {processTitleForPDF('TrendSiam Mixed-Script PDF Test')}
        </Text>
        
        {/* Font info */}
        <Text style={styles.thaiTest}>
          {processMetadataForPDF(`Font System: ${fontInfo.universalFamily} | Hyphenation: ${fontInfo.hyphenationDisabled ? 'Disabled' : 'Enabled'}`)}
        </Text>
        
        {/* Test description */}
        <Text style={styles.text}>
          {processMetadataForPDF('Testing problematic Thai + Latin + emoji combinations that previously caused overlapping:')}
        </Text>
        
        <View style={{ marginTop: 16, marginBottom: 16 }}>
          {TEST_CASES.map((testCase, idx) => (
            <View key={idx} style={styles.item}>
              <Text style={styles.itemTitle}>
                {processTitleForPDF(`${idx + 1}. ${testCase.title}`)}
              </Text>
              <Text style={styles.itemMeta}>
                {processMetadataForPDF(`หมวดหมู่: ${testCase.category} | ช่อง: ${testCase.channel} | คะแนน: ${testCase.score}`)}
              </Text>
            </View>
          ))}
        </View>
        
        {/* Specific problematic patterns */}
        <Text style={styles.h2}>
          {processTitleForPDF('Specific Pattern Tests')}
        </Text>
        
        <View style={{ marginTop: 8 }}>
          <Text style={styles.itemTitle}>
            {processTitleForPDF('Numbers + Letters + Punctuation: 2,052 KG++ !!!!🤯')}
          </Text>
          <Text style={styles.itemTitle}>
            {processTitleForPDF('Thai + Parentheses + Latin: แมพกระโดด (รู้ว่าเราคิด) Roblox')}
          </Text>
          <Text style={styles.itemTitle}>
            {processTitleForPDF('Emoji + Exclamations: 🤯ผู้กี่สุด ในชีวิต !!!!')}
          </Text>
          <Text style={styles.itemTitle}>
            {processTitleForPDF('Mixed Scripts + Pipe: โครตเทพ! | Minecraft Gods')}
          </Text>
          <Text style={styles.itemTitle}>
            {processTitleForPDF('Em Dash + Mixed: LISA — DREAM feat. Kentaro')}
          </Text>
        </View>
        
        {/* Footer with generation info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {processMetadataForPDF(`Generated: ${new Date().toISOString()}`)}
          </Text>
          <Text style={styles.footerText}>
            {processMetadataForPDF('If text appears overlapped/colliding, the fix needs adjustment.')}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

async function generateTestPDF(): Promise<void> {
  console.log('🧪 [testMixedScriptPDF] Starting mixed-script PDF test...');
  
  try {
    // Test the spacing processor first
    console.log('\n📝 Testing script boundary spacing:');
    testScriptBoundarySpacing();
    
    console.log('\n🔧 Generating test PDF...');
    
    // Generate PDF
    const instance = pdf(<TestMixedScriptDoc />);
    const pdfBuffer = await instance.toBuffer();
    
    // Handle ReadableStream if needed
    let finalBuffer: Buffer;
    if (pdfBuffer instanceof ReadableStream) {
      const reader = pdfBuffer.getReader();
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      finalBuffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)), totalLength);
    } else {
      finalBuffer = pdfBuffer as Buffer;
    }
    
    // Save to file
    const outputPath = join(process.cwd(), 'test-mixed-script.pdf');
    writeFileSync(outputPath, finalBuffer);
    
    console.log(`✅ Test PDF generated successfully: ${outputPath}`);
    console.log(`📊 File size: ${(finalBuffer.length / 1024).toFixed(1)} KB`);
    
    // Font registration info
    const fontInfo = getFontRegistrationInfo();
    console.log('\n🔤 Font System Info:');
    console.log(`   Universal Family: ${fontInfo.universalFamily}`);
    console.log(`   Hyphenation Disabled: ${fontInfo.hyphenationDisabled}`);
    console.log(`   Registration Status: ${fontInfo.registered}`);
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Open test-mixed-script.pdf in a PDF viewer');
    console.log('2. Check for overlapping/colliding text in the test cases');
    console.log('3. Verify proper spacing between Thai, Latin, numbers, and emoji');
    console.log('4. If issues remain, adjust spacing values in pdfTypo.ts');
    
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
