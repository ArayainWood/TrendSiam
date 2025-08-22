#!/usr/bin/env npx tsx
/**
 * Test Manual Generation
 * 
 * Quick test to verify manual components work
 */

import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { TitlePage } from '../src/lib/pdf/manual/TitlePage';
import { registerPdfFonts } from '../src/lib/pdf/pdfFonts.cli';

async function main() {
  console.log('🧪 Testing manual generation...');
  
  try {
    // Register fonts first
    registerPdfFonts();
    
    // Test title page generation
    const titleBuffer = await renderToBuffer(
      React.createElement(TitlePage, {
        title: 'คู่มือทดสอบระบบ TrendSiam',
        date: new Date().toLocaleDateString('th-TH'),
        version: '1.0-test'
      })
    );
    
    console.log('✅ Title page generation successful');
    console.log(`📊 Size: ${(titleBuffer.length / 1024).toFixed(2)} KB`);
    
    // Test file inventory
    const { scanPythonFiles } = await import('../src/lib/pdf/manual/fileInventory');
    const files = scanPythonFiles('../../');
    console.log(`✅ File inventory scan successful: ${files.length} files`);
    
    console.log('🎉 Manual generation test passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
