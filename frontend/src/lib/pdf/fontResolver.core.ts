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
  const fontFiles = {
    regular: 'NotoSansThai-Regular.ttf',
    bold: 'NotoSansThai-Bold.ttf'
  };

  // Try each base path
  for (const basePath of basePaths) {
    const regularPath = path.join(basePath, fontFiles.regular);
    const boldPath = path.join(basePath, fontFiles.bold);

    if (fs.existsSync(regularPath) && fs.existsSync(boldPath)) {
      // Verify file sizes (fonts should be >40KB)
      const regularSize = fs.statSync(regularPath).size;
      const boldSize = fs.statSync(boldPath).size;

      if (regularSize > 40000 && boldSize > 40000) {
        console.log(`[fontResolver] ✓ Found Thai fonts at: ${basePath}`);
        console.log(`  Regular: ${regularSize.toLocaleString()} bytes`);
        console.log(`  Bold: ${boldSize.toLocaleString()} bytes`);
        
        return {
          REG: regularPath,
          BOLD: boldPath,
          base: basePath
        };
      } else {
        console.warn(`[fontResolver] ⚠ Font files too small at ${basePath}`);
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
