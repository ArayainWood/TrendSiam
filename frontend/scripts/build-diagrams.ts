#!/usr/bin/env npx tsx
/**
 * Build Mermaid Diagrams to SVG
 * 
 * Converts Mermaid diagram files to SVG for PDF inclusion
 * Usage: npx tsx scripts/build-diagrams.ts
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('='.repeat(50));
  console.log('Mermaid Diagram Builder');
  console.log('='.repeat(50));
  console.log('');

  try {
    // Check if mermaid CLI is available
    try {
      execSync('npx mmdc --version', { stdio: 'pipe' });
      console.log('✅ Mermaid CLI found');
    } catch (error) {
      console.log('⚠️  Mermaid CLI not found');
      console.log('📦 To generate diagrams, install with: npm install -D @mermaid-js/mermaid-cli');
      console.log('⏭️  Skipping diagram generation...');
      process.exit(0);
    }

    // Setup paths
    const rootPath = join(__dirname, '../../');
    const diagramsPath = join(rootPath, 'docs/diagrams');
    const outputPath = join(rootPath, 'frontend/public/diagrams');

    // Create output directory if it doesn't exist
    if (!existsSync(outputPath)) {
      mkdirSync(outputPath, { recursive: true });
      console.log('📁 Created output directory:', outputPath);
    }

    // Find all .mmd files
    if (!existsSync(diagramsPath)) {
      console.error('❌ Diagrams directory not found:', diagramsPath);
      process.exit(1);
    }

    const mmdFiles = readdirSync(diagramsPath).filter(file => file.endsWith('.mmd'));
    console.log(`📊 Found ${mmdFiles.length} diagram files`);

    if (mmdFiles.length === 0) {
      console.log('⚠️  No .mmd files found in diagrams directory');
      process.exit(0);
    }

    // Convert each diagram
    let successCount = 0;
    let errorCount = 0;

    for (const file of mmdFiles) {
      const inputFile = join(diagramsPath, file);
      const outputFile = join(outputPath, file.replace('.mmd', '.svg'));
      
      try {
        console.log(`🔄 Converting ${file}...`);
        
        // Use mermaid CLI to convert to SVG
        const command = `npx mmdc -i "${inputFile}" -o "${outputFile}" -t neutral -b white`;
        execSync(command, { stdio: 'pipe' });
        
        console.log(`   ✅ Generated: ${file.replace('.mmd', '.svg')}`);
        successCount++;
        
      } catch (error) {
        console.error(`   ❌ Failed to convert ${file}:`, error instanceof Error ? error.message : error);
        errorCount++;
      }
    }

    console.log('');
    console.log('📊 Conversion Summary:');
    console.log(`   ✅ Success: ${successCount} files`);
    console.log(`   ❌ Errors: ${errorCount} files`);
    console.log(`   📁 Output: ${outputPath}`);

    if (successCount > 0) {
      console.log('');
      console.log('🎉 Diagram generation complete!');
      console.log('   SVG files are ready for PDF inclusion');
    }

    process.exit(errorCount > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Diagram build failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
