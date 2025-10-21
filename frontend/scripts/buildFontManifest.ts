/**
 * Build Font Manifest with SHA-256 Verification
 * 
 * Scans frontend/public/fonts/ recursively for all TTF/OTF files
 * Generates manifest with: path, size, SHA-256, family, style
 * 
 * Run: npx tsx scripts/buildFontManifest.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface FontFile {
  family: string;
  style: string;
  filename: string;
  relativePath: string;
  absolutePath: string;
  bytes: number;
  sha256: string;
  valid: boolean;
  error?: string;
}

interface FontManifest {
  generated_at: string;
  base_path: string;
  fonts: FontFile[];
  summary: {
    total_files: number;
    valid_fonts: number;
    invalid_fonts: number;
    total_bytes: number;
    families: string[];
  };
}

const FONTS_BASE_DIR = path.join(__dirname, '..', 'public', 'fonts');

/**
 * Compute SHA-256 hash of file
 */
function computeSHA256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex').toUpperCase();
}

/**
 * Infer font style from filename
 */
function inferStyle(filename: string): string {
  const lower = filename.toLowerCase();
  
  // Check for weight/style keywords
  if (lower.includes('bold') && lower.includes('italic')) return 'BoldItalic';
  if (lower.includes('bolditalic')) return 'BoldItalic';
  if (lower.includes('bold')) return 'Bold';
  if (lower.includes('italic')) return 'Italic';
  if (lower.includes('light')) return 'Light';
  if (lower.includes('medium')) return 'Medium';
  if (lower.includes('semibold')) return 'SemiBold';
  if (lower.includes('black')) return 'Black';
  if (lower.includes('thin')) return 'Thin';
  if (lower.includes('regular')) return 'Regular';
  
  // Default to Regular if no keywords found
  return 'Regular';
}

/**
 * Validate font file (basic check)
 */
function validateFontFile(filePath: string): { valid: boolean; error?: string } {
  try {
    const stats = fs.statSync(filePath);
    
    // Check if empty
    if (stats.size === 0) {
      return { valid: false, error: 'Zero-byte file' };
    }
    
    // Check if suspiciously small (< 10KB likely corrupt)
    if (stats.size < 10000) {
      return { valid: false, error: 'File too small (< 10KB, likely corrupt)' };
    }
    
    // Read first 4 bytes to check TTF/OTF signature
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(4);
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);
    
    const signature = buffer.toString('hex');
    
    // Valid signatures:
    // 00 01 00 00 = TrueType (TTF)
    // 4F 54 54 4F = OpenType (OTF) - "OTTO"
    // 74 74 63 66 = TrueType Collection (TTC) - "ttcf"
    if (signature === '00010000' || signature === '4f54544f' || signature === '74746366') {
      return { valid: true };
    }
    
    return { valid: false, error: `Invalid signature: ${signature}` };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}

/**
 * Scan fonts directory recursively
 */
function scanFontsDirectory(): FontFile[] {
  const fontFiles: FontFile[] = [];
  
  function scanDir(dir: string) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else if (item.match(/\.(ttf|otf)$/i)) {
        // Font file found
        const family = path.basename(path.dirname(fullPath));
        const relativePath = path.relative(FONTS_BASE_DIR, fullPath).replace(/\\/g, '/');
        
        console.log(`Scanning: ${relativePath}`);
        
        const validation = validateFontFile(fullPath);
        
        if (validation.valid) {
          const sha256 = computeSHA256(fullPath);
          const style = inferStyle(item);
          
          fontFiles.push({
            family,
            style,
            filename: item,
            relativePath,
            absolutePath: fullPath,
            bytes: stat.size,
            sha256,
            valid: true
          });
          
          console.log(`  ✅ Valid: ${stat.size.toLocaleString()} bytes, SHA-256: ${sha256.slice(0, 16)}...`);
        } else {
          fontFiles.push({
            family,
            style: 'Unknown',
            filename: item,
            relativePath,
            absolutePath: fullPath,
            bytes: stat.size,
            sha256: '',
            valid: false,
            error: validation.error
          });
          
          console.log(`  ❌ Invalid: ${validation.error}`);
        }
      }
    }
  }
  
  scanDir(FONTS_BASE_DIR);
  return fontFiles;
}

/**
 * Build manifest
 */
function buildManifest(): FontManifest {
  console.log('🔍 Font Manifest Builder\n');
  console.log(`Scanning: ${FONTS_BASE_DIR}\n`);
  console.log('='.repeat(80) + '\n');
  
  const fonts = scanFontsDirectory();
  
  // Calculate summary
  const validFonts = fonts.filter(f => f.valid);
  const invalidFonts = fonts.filter(f => !f.valid);
  const totalBytes = validFonts.reduce((sum, f) => sum + f.bytes, 0);
  const families = [...new Set(validFonts.map(f => f.family))].sort();
  
  const manifest: FontManifest = {
    generated_at: new Date().toISOString(),
    base_path: 'frontend/public/fonts',
    fonts,
    summary: {
      total_files: fonts.length,
      valid_fonts: validFonts.length,
      invalid_fonts: invalidFonts.length,
      total_bytes: totalBytes,
      families
    }
  };
  
  // Save manifest
  const manifestPath = path.join(FONTS_BASE_DIR, 'fonts_provenance.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 SUMMARY:\n');
  console.log(`   Total font files: ${fonts.length}`);
  console.log(`   ✅ Valid: ${validFonts.length}`);
  console.log(`   ❌ Invalid: ${invalidFonts.length}`);
  console.log(`   Total size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Font families: ${families.length}`);
  console.log('');
  
  // Print families
  families.forEach(family => {
    const familyFonts = validFonts.filter(f => f.family === family);
    const familySize = familyFonts.reduce((sum, f) => sum + f.bytes, 0);
    const styles = familyFonts.map(f => f.style).join(', ');
    
    console.log(`   ${family}:`);
    console.log(`     Styles: ${styles}`);
    console.log(`     Size: ${(familySize / 1024).toFixed(1)} KB`);
    console.log('');
  });
  
  console.log(`📄 Manifest saved: ${manifestPath}\n`);
  
  // Print invalid fonts if any
  if (invalidFonts.length > 0) {
    console.log('⚠️  INVALID FONTS (excluded from manifest):\n');
    invalidFonts.forEach(f => {
      console.log(`   ${f.relativePath}`);
      console.log(`     Error: ${f.error}\n`);
    });
  }
  
  return manifest;
}

// Run
try {
  buildManifest();
  console.log('✅ BUILD COMPLETE\n');
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}

