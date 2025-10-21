#!/usr/bin/env node

/**
 * PDF Chromium Verification Script
 * 
 * Generates test PDFs and verifies rendering quality
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, '../reports/pdf-debug/chromium-migration/verification');

// Ensure output directory exists
await fs.mkdir(outputDir, { recursive: true });

// Test sets to verify
const testSets = ['critical', 'thai', 'mixed'];

async function generateTestPDF(set) {
  console.log(`\n📄 Generating PDF for test set: ${set}`);
  
  try {
    // Fetch test data
    const testDataRes = await fetch(`http://localhost:3000/api/test/pdf-cases?set=${set}`);
    if (!testDataRes.ok) {
      throw new Error(`Failed to fetch test data: ${testDataRes.status}`);
    }
    const testData = await testDataRes.json();
    console.log(`  ✓ Loaded ${testData.items.length} test cases`);
    
    // Generate PDF with test data
    const pdfUrl = `http://localhost:3000/api/weekly/pdf-chromium?test=${set}`;
    const pdfRes = await fetch(pdfUrl);
    
    if (!pdfRes.ok) {
      throw new Error(`Failed to generate PDF: ${pdfRes.status}`);
    }
    
    const pdfBuffer = await pdfRes.arrayBuffer();
    const outputPath = path.join(outputDir, `test_${set}_chromium.pdf`);
    await fs.writeFile(outputPath, Buffer.from(pdfBuffer));
    
    console.log(`  ✓ Generated PDF: ${outputPath} (${(pdfBuffer.byteLength / 1024).toFixed(2)} KB)`);
    
    return {
      set,
      success: true,
      path: outputPath,
      size: pdfBuffer.byteLength,
      items: testData.items.length,
    };
    
  } catch (error) {
    console.error(`  ✗ Failed for ${set}: ${error.message}`);
    return {
      set,
      success: false,
      error: error.message,
    };
  }
}

async function verifyTextRendering(results) {
  console.log('\n🔍 Verification Summary');
  console.log('=' * 50);
  
  const report = {
    timestamp: new Date().toISOString(),
    engine: 'chromium',
    results: results,
    criticalChecks: {
      thaiSaraAA: 'PENDING', // Check for preserved า vowels
      koreanHangul: 'PENDING', // Check for proper Korean fonts
      cjkIdeographs: 'PENDING', // Check for CJK rendering
      trailerCorruption: 'PENDING', // Check for "Trailer=@" issue
      emojiRendering: 'PENDING', // Check for emoji support
    },
    performance: {
      totalTime: 0,
      averageSize: 0,
    },
  };
  
  // Calculate performance metrics
  const successful = results.filter(r => r.success);
  if (successful.length > 0) {
    report.performance.averageSize = successful.reduce((sum, r) => sum + r.size, 0) / successful.length;
  }
  
  // Write verification report
  const reportPath = path.join(outputDir, 'verification_report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📊 Report saved: ${reportPath}`);
  
  // Print summary
  console.log('\nResults:');
  results.forEach(r => {
    if (r.success) {
      console.log(`  ✅ ${r.set}: ${r.items} items, ${(r.size / 1024).toFixed(2)} KB`);
    } else {
      console.log(`  ❌ ${r.set}: ${r.error}`);
    }
  });
  
  console.log('\n⚠️  Manual verification required:');
  console.log('  1. Open each PDF and check for Thai vowel preservation (า)');
  console.log('  2. Verify Korean text uses proper fonts (not Thai fallback)');
  console.log('  3. Check item #20 for "Trailer:" (not "Trailer=@")');
  console.log('  4. Confirm emoji and symbols render correctly');
  console.log('  5. Measure line heights for Thai diacritics');
}

// Main execution
console.log('🚀 PDF Chromium Verification');
console.log('=' * 50);
console.log('Server: http://localhost:3000');
console.log('Output: ' + outputDir);

// Check if server is running
try {
  const health = await fetch('http://localhost:3000/api/health-pdf?engine=chromium');
  const healthData = await health.json();
  
  if (!healthData.engines?.chromium?.healthy) {
    throw new Error('Chromium engine not healthy');
  }
  
  console.log('✓ Chromium engine healthy');
  console.log(`  Browser: ${healthData.engines.chromium.browserVersion}`);
  console.log(`  Fonts: ${healthData.engines.chromium.fonts.join(', ')}`);
  
} catch (error) {
  console.error('❌ Server not available or Chromium engine not healthy');
  console.error('   Run: npm run dev');
  process.exit(1);
}

// Generate all test PDFs
const results = [];
for (const set of testSets) {
  const result = await generateTestPDF(set);
  results.push(result);
}

// Verify results
await verifyTextRendering(results);

console.log('\n✨ Verification complete!');
