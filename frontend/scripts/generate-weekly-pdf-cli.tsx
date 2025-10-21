/**
 * Generate Weekly PDF directly from snapshot data (CLI)
 * 
 * Usage: npx tsx -r ./scripts/loadEnv.cjs scripts/generate-weekly-pdf-cli.tsx [snapshot-id]
 */

import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { writeFileSync } from 'fs';
import { join } from 'path';
import WeeklyDoc from '../src/lib/pdf/WeeklyDoc';
import { registerMultilingualFontsForPDF } from '../src/lib/pdf/pdfFontsMultilingual';
import { fetchWeeklySnapshot } from '../src/lib/data/weeklySnapshot';

async function generateWeeklyPDF(snapshotId?: string): Promise<void> {
  console.log('🧪 Generating Weekly PDF from snapshot data...');
  console.log(`📌 Snapshot ID: ${snapshotId || 'latest'}\n`);
  
  try {
    // Fetch snapshot data
    const snapshotData = await fetchWeeklySnapshot(snapshotId);
    
    if (!snapshotData.success) {
      throw new Error(snapshotData.error || 'Failed to load snapshot data');
    }
    
    console.log(`✅ Loaded snapshot: ${snapshotData.snapshotId}`);
    console.log(`   Total items: ${snapshotData.items.length}`);
    console.log(`   Range: ${snapshotData.rangeStart} to ${snapshotData.rangeEnd}\n`);
    
    // Prepare data for PDF (top 20 items)
    const data = {
      items: snapshotData.items.slice(0, 20),
      metrics: snapshotData.metrics,
      generatedAt: snapshotData.builtAt,
      source: 'snapshot' as const,
      snapshotId: snapshotData.snapshotId,
      rangeStart: snapshotData.rangeStart,
      rangeEnd: snapshotData.rangeEnd
    };
    
    // Register fonts
    const fontReport = registerMultilingualFontsForPDF(data.items);
    console.log(`✅ Fonts registered: ${fontReport.primaryFamily}`);
    console.log(`   Loaded families: ${fontReport.loadedFamilies.join(', ')}`);
    console.log(`   Detected scripts: ${fontReport.detectedScripts.join(', ')}\n`);
    
    // Generate PDF
    const instance = pdf(<WeeklyDoc {...data} />);
    const blob = await instance.toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Save with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const outputPath = join(process.cwd(), 'reports', 'pdf', `weekly_${timestamp}.pdf`);
    
    // Ensure reports/pdf directory exists
    const reportsDir = join(process.cwd(), 'reports', 'pdf');
    const fs = require('fs');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    writeFileSync(outputPath, buffer);
    
    console.log(`✅ PDF generated: ${outputPath}`);
    console.log(`📊 File size: ${(buffer.length / 1024).toFixed(1)} KB`);
    console.log(`📄 Items included: ${data.items.length}/20 (top 20)\n`);
    
    // Analyze problematic items
    const problematicRanks = [4, 6, 16, 18, 19, 20];
    const problematic = data.items.filter(item => problematicRanks.includes(item.rank));
    
    if (problematic.length > 0) {
      console.log('🔍 Problematic items included in PDF:');
      problematic.forEach(item => {
        console.log(`   #${item.rank}: ${item.title.substring(0, 60)}...`);
      });
      console.log('');
    }
    
  } catch (error: any) {
    console.error('❌ PDF generation failed:', error.message);
    throw error;
  }
}

if (require.main === module) {
  const snapshotId = process.argv[2];
  
  generateWeeklyPDF(snapshotId)
    .then(() => {
      console.log('🎉 Weekly PDF generation completed!\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Generation failed:', error);
      process.exit(1);
    });
}

export { generateWeeklyPDF };

