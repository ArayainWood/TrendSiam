#!/usr/bin/env npx tsx
/**
 * System Manual Builder
 * 
 * Generates Thai-language PDF manual for TrendSiam system
 * Usage: npx tsx scripts/buildSystemManual.tsx
 */

import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { ManualDoc } from '../src/lib/pdf/manual/ManualDoc';
import { scanPythonFiles, getKeyTypeScriptModules } from '../src/lib/pdf/manual/fileInventory';

async function main() {
  console.log('='.repeat(60));
  console.log('TrendSiam System Manual Builder');
  console.log('='.repeat(60));
  console.log('Start time:', new Date().toISOString());
  console.log('');

  try {
    // Scan repository for Python files
    console.log('📁 Scanning repository for Python files...');
    const rootPath = join(__dirname, '../../');
    const pythonFiles = scanPythonFiles(rootPath);
    console.log(`   Found ${pythonFiles.length} Python files`);

    // Get TypeScript modules
    console.log('📄 Getting key TypeScript modules...');
    const tsModules = getKeyTypeScriptModules();
    console.log(`   Found ${tsModules.length} key TypeScript modules`);

    // Combine file inventory
    const fileInventory = [...pythonFiles, ...tsModules];
    console.log(`   Total files in inventory: ${fileInventory.length}`);

    // Generate PDF
    console.log('📖 Generating PDF manual...');
    const pdfBuffer = await renderToBuffer(
      React.createElement(ManualDoc, {
        title: 'คู่มือสถาปัตยกรรมและการปฏิบัติการระบบ TrendSiam',
        date: new Date().toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        version: '1.0',
        fileInventory
      })
    );

    // Save PDF file with robust path
    const date = new Date().toISOString().split('T')[0];
    const filename = `TrendSiam_คู่มือระบบ_${date}.pdf`;
    const outputPath = resolve(process.cwd(), filename);
    
    writeFileSync(outputPath, pdfBuffer);
    
    console.log('');
    console.log('✅ Manual generated successfully!');
    console.log(`📄 File: ${filename}`);
    console.log(`📍 Location: ${outputPath}`);
    console.log(`📊 Size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    console.log('');
    
    // Summary
    console.log('📋 Manual Contents:');
    console.log('   • Title Page (Thai)');
    console.log('   • Table of Contents');
    console.log('   • Architecture Overview');
    console.log('   • Data Flow');
    console.log('   • Security Guidelines');
    console.log('   • Supabase Configuration');
    console.log('   • Operations Manual');
    console.log('   • Testing Guidelines');
    console.log(`   • File Inventory (${pythonFiles.length} Python files)`);
    console.log('   • API Reference');
    console.log('');
    
    console.log('🎉 System manual generation complete!');
    console.log('='.repeat(60));
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Manual generation failed:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }
    
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
