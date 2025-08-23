/**
 * Thai Font Resolution for PDF Generation
 * 
 * Portable font path resolution that works in any environment.
 * No Windows-specific paths, no hardcoded absolute paths.
 */

import 'server-only';
import path from 'path';
import fs from 'fs';

export interface ThaiFonts {
  REG: string;
  BOLD: string;
}

/**
 * Resolve Thai font paths from public directory
 * @throws {Error} If fonts are missing
 */
export function resolveThaiFonts(): ThaiFonts {
  const base = path.join(process.cwd(), 'public', 'fonts', 'NotoSansThai');
  const REG = path.join(base, 'NotoSansThai-Regular.ttf');
  const BOLD = path.join(base, 'NotoSansThai-Bold.ttf');
  
  console.log('[pdf/fonts] Checking Thai fonts at:', base);
  
  const existReg = fs.existsSync(REG);
  const existBold = fs.existsSync(BOLD);
  
  if (!existReg || !existBold) {
    const missing = [
      !existReg && REG, 
      !existBold && BOLD
    ].filter(Boolean);
    
    console.error('[pdf/fonts] ❌ Missing Thai fonts:', missing);
    throw new Error(`thai-font-missing:${missing.join(',')}`);
  }
  
  // Log font sizes for verification
  const regSize = fs.statSync(REG).size;
  const boldSize = fs.statSync(BOLD).size;
  
  console.log('[pdf/fonts] ✅ Thai fonts found:');
  console.log(`  Regular: ${REG} (${regSize} bytes)`);
  console.log(`  Bold: ${BOLD} (${boldSize} bytes)`);
  
  return { REG, BOLD };
}

/**
 * Get font directory for debugging
 */
export function getFontDirectory(): string {
  return path.join(process.cwd(), 'public', 'fonts', 'NotoSansThai');
}

/**
 * Test if fonts are available
 */
export function areThaiFontsAvailable(): boolean {
  try {
    resolveThaiFonts();
    return true;
  } catch (error) {
    console.log('[pdf/fonts] Thai fonts not available:', error instanceof Error ? error.message : error);
    return false;
  }
}
