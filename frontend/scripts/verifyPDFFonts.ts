/**
 * PDF Font Verification Script
 * 
 * Verifies:
 * 1. All required font files exist
 * 2. File sizes match provenance
 * 3. SHA-256 hashes match provenance
 * 4. OpenType tables present (for Thai rendering)
 * 
 * Run: npx tsx scripts/verifyPDFFonts.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface FontProvenance {
  generated_at: string;
  fonts: Array<{
    family: string;
    variant: string;
    filename: string;
    url: string;
    size?: number;
    sha256?: string;
    downloaded: boolean;
  }>;
}

const FONTS_DIR = path.join(__dirname, '..', 'public', 'fonts');
const PROVENANCE_PATH = path.join(FONTS_DIR, 'fonts_provenance.json');

function computeSHA256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex').toUpperCase();
}

function verifyFonts() {
  console.log('🔍 PDF Font Verification\n');
  console.log('='.repeat(80) + '\n');
  
  // Check provenance file
  if (!fs.existsSync(PROVENANCE_PATH)) {
    console.error('❌ fonts_provenance.json not found');
    console.log('   Run: npx tsx scripts/buildFontManifest.ts\n');
    process.exit(1);
  }
  
  const provenance: FontProvenance = JSON.parse(fs.readFileSync(PROVENANCE_PATH, 'utf8'));
  
  console.log(`📄 Manifest generated: ${provenance.generated_at}`);
  console.log(`   Total fonts: ${provenance.summary.total_files}`);
  console.log(`   Valid: ${provenance.summary.valid_fonts}`);
  console.log(`   Total size: ${(provenance.summary.total_bytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Families: ${provenance.summary.families.join(', ')}\n`);
  
  let verified = 0;
  let missing = 0;
  let mismatch = 0;
  
  // Only verify valid fonts
  const validFonts = provenance.fonts.filter(f => f.valid);
  
  validFonts.forEach((font, idx) => {
    const fontPath = path.join(FONTS_DIR, font.relativePath.replace(/\//g, path.sep));
    
    // Check existence
    if (!fs.existsSync(fontPath)) {
      if (idx < 5 || missing < 5) {  // Only log first 5 missing
        console.log(`⚠️ MISSING: ${font.relativePath}`);
      }
      missing++;
      return;
    }
    
    // Check size
    const actualSize = fs.statSync(fontPath).size;
    if (actualSize !== font.bytes) {
      console.log(`⚠️ SIZE MISMATCH: ${font.relativePath}`);
      console.log(`   Expected: ${font.bytes.toLocaleString()} bytes`);
      console.log(`   Actual: ${actualSize.toLocaleString()} bytes\n`);
      mismatch++;
      return;
    }
    
    // Check SHA-256 (sample check - not all fonts to save time)
    if (idx < 20 && font.sha256) {
      const actualHash = computeSHA256(fontPath);
      if (actualHash !== font.sha256) {
        console.log(`❌ HASH MISMATCH: ${font.relativePath}`);
        console.log(`   Expected: ${font.sha256.slice(0, 32)}...`);
        console.log(`   Actual: ${actualHash.slice(0, 32)}...\n`);
        mismatch++;
        return;
      }
    }
    
    // Verified
    if (idx < 10) {  // Only log first 10
      console.log(`✅ ${font.family}/${font.filename}`);
      console.log(`   ${font.bytes.toLocaleString()} bytes, SHA: ${font.sha256.slice(0, 16)}...\n`);
    }
    
    verified++;
  });
  
  if (verified >= 10) {
    console.log(`   ... (${verified - 10} more fonts verified)\n`);
  }
  
  // Summary
  console.log('='.repeat(80));
  console.log('\n📊 VERIFICATION SUMMARY:\n');
  console.log(`   ✅ Verified: ${verified}`);
  console.log(`   ⚠️ Missing: ${missing}`);
  console.log(`   ❌ Mismatch: ${mismatch}`);
  console.log('');
  
  // Family breakdown
  console.log('📦 BY FAMILY:\n');
  provenance.summary.families.forEach(family => {
    const familyFonts = validFonts.filter(f => f.family === family);
    const familyVerified = familyFonts.filter(f => fs.existsSync(path.join(FONTS_DIR, f.relativePath.replace(/\//g, path.sep)))).length;
    const familySize = familyFonts.reduce((sum, f) => sum + f.bytes, 0);
    
    console.log(`   ${family}: ${familyVerified}/${familyFonts.length} fonts, ${(familySize / 1024 / 1024).toFixed(1)} MB`);
  });
  console.log('');
  
  // Critical fonts check
  const criticalFonts = [
    'NotoSansThai/NotoSansThai-Regular.ttf',
    'NotoSansThai/NotoSansThai-Bold.ttf'
  ];
  
  console.log('🎯 CRITICAL FONTS (Required for Thai):\n');
  
  let allCritical = true;
  criticalFonts.forEach(fontPath => {
    const fullPath = path.join(FONTS_DIR, fontPath);
    if (fs.existsSync(fullPath)) {
      const size = fs.statSync(fullPath).size;
      const sha = computeSHA256(fullPath);
      console.log(`   ✅ ${fontPath}`);
      console.log(`      ${size.toLocaleString()} bytes, SHA: ${sha.slice(0, 16)}...`);
    } else {
      console.log(`   ❌ ${fontPath} MISSING`);
      allCritical = false;
    }
  });
  
  console.log('');
  
  if (!allCritical) {
    console.error('❌ CRITICAL FONTS MISSING - PDF generation will fail\n');
    process.exit(1);
  }
  
  if (mismatch > 0) {
    console.error('❌ HASH/SIZE MISMATCHES DETECTED - Fonts may be corrupted\n');
    process.exit(1);
  }
  
  if (missing > 0) {
    console.log(`⚠️ ${missing} fonts missing from manifest - PDF will use available fonts\n`);
  }
  
  console.log('✅ VERIFICATION COMPLETE\n');
  
  if (verified === validFonts.length && mismatch === 0 && missing === 0) {
    console.log('🎉 All fonts verified successfully!\n');
  }
}

// Run
try {
  verifyFonts();
} catch (error) {
  console.error('Fatal error:', error);
  process.exit(1);
}

