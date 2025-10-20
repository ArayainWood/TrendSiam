/**
 * Thai Font Resolver v4 - Core Logic
 * 
 * Portable, monorepo-safe font path resolution
 * Verifies font files exist and are valid (>40KB)
 */

import path from 'path';
import fs from 'fs';
import type { ThaiFontPaths } from '@/types/weekly';

/**
 * Resolve Thai font paths with multi-location fallback
 * Works in both development and production builds
 */
export function resolveThaiFonts(): ThaiFontPaths {
  // Try multiple base paths for monorepo compatibility
  const basePaths = [
    // 1. Next.js project root (most common)
    path.join(process.cwd(), 'public', 'fonts', 'NotoSansThai'),
    // 2. Frontend subdirectory (monorepo with frontend/backend split)
    path.join(process.cwd(), 'frontend', 'public', 'fonts', 'NotoSansThai'),
    // 3. Parent directory (running from subfolder)
    path.join(process.cwd(), '..', 'public', 'fonts', 'NotoSansThai'),
    // 4. Direct fonts directory (legacy)
    path.join(process.cwd(), 'fonts', 'NotoSansThai')
  ];

  // Required font files
  // Check for Variable font first (fuller coverage), then fall back to static
  const fontFiles = {
    variable: 'NotoSansThai-Variable.ttf',
    regular: 'NotoSansThai-Regular.ttf',
    bold: 'NotoSansThai-Bold.ttf'
  };

  // Try each base path
  for (const basePath of basePaths) {
    const variablePath = path.join(basePath, fontFiles.variable);
    const regularPath = path.join(basePath, fontFiles.regular);
    const boldPath = path.join(basePath, fontFiles.bold);

    // IMPORTANT: Prefer static fonts for PDF due to @react-pdf/renderer limitations
    // Variable fonts cause rendering issues with fontkit (diacritic overlapping, weight extraction failures)
    
    // First, try static fonts (most reliable for Thai PDF rendering)
    if (fs.existsSync(regularPath) && fs.existsSync(boldPath)) {
      const regularSize = fs.statSync(regularPath).size;
      const boldSize = fs.statSync(boldPath).size;

      if (regularSize > 40000 && boldSize > 40000) {
        // Verify font integrity via SHA-256
        const crypto = require('crypto');
        const expectedSHA = {
          regular: '9ACB585D8662CA4ED1B1CF5889DFA1393F8555103B3986E1EA1E3AF4FAEF70BD',
          bold: '0BE544F347B3AB6382BDC2B555A783727A4858A3DC140670406924670967D916'
        };
        
        const regularContent = fs.readFileSync(regularPath);
        const boldContent = fs.readFileSync(boldPath);
        const regularHash = crypto.createHash('sha256').update(regularContent).digest('hex').toUpperCase();
        const boldHash = crypto.createHash('sha256').update(boldContent).digest('hex').toUpperCase();
        
        if (regularHash !== expectedSHA.regular) {
          throw new Error(`Font integrity check FAILED: Regular font corrupted (${regularHash} != ${expectedSHA.regular})`);
        }
        if (boldHash !== expectedSHA.bold) {
          throw new Error(`Font integrity check FAILED: Bold font corrupted (${boldHash} != ${expectedSHA.bold})`);
        }
        
        console.log('[fontResolver] ✅ Font integrity verified (SHA-256 match)');
        console.log(`[fontResolver] ✓ Using static Thai fonts for PDF reliability: ${basePath}`);
        console.log(`  Regular: ${regularSize.toLocaleString()} bytes`);
        console.log(`  Bold: ${boldSize.toLocaleString()} bytes`);
        console.log(`  [fontResolver] Static fonts prevent Variable font subsetting/shaping issues`);
        
        return {
          REG: regularPath,
          BOLD: boldPath,
          base: basePath
        };
      } else {
        console.warn(`[fontResolver] ⚠ Font files too small at ${basePath}`);
      }
    }

    // Only use Variable font if static fonts not available (fallback)
    if (fs.existsSync(variablePath)) {
      const variableSize = fs.statSync(variablePath).size;
      
      if (variableSize > 100000) {
        console.warn(`[fontResolver] ⚠ Using Variable font as fallback (may cause Thai rendering issues)`);
        console.log(`  Variable: ${variableSize.toLocaleString()} bytes`);
        
        return {
          REG: variablePath,
          BOLD: variablePath,
          base: basePath
        };
      }
    }
  }

  // If we get here, fonts weren't found
  const searchedPaths = basePaths.map(p => `  - ${p}`).join('\n');
  throw new Error(
    `Thai fonts not found. Searched in:\n${searchedPaths}\n\n` +
    `Please ensure NotoSansThai-Regular.ttf and NotoSansThai-Bold.ttf exist in one of these locations.`
  );
}

/**
 * Get base font names without paths
 */
export function getThaiFontBasenames(): { regular: string; bold: string } {
  return {
    regular: 'NotoSansThai-Regular',
    bold: 'NotoSansThai-Bold'
  };
}

/**
 * Verify Thai fonts are available
 */
export function verifyThaiFonts(): boolean {
  try {
    resolveThaiFonts();
    return true;
  } catch {
    return false;
  }
}
