/**
 * PDF Typography Preprocessor v1
 * 
 * Adds script-boundary spacing to prevent glyph overlapping in mixed-script text
 * Specifically targets Thai ↔ Latin ↔ Number ↔ Emoji transitions
 */

import 'server-only';

// Hair space (U+200A) - thinner than regular space, perfect for script boundaries
const HAIR_SPACE = '\u200A';

// Thin space (U+2009) - slightly wider, for emoji boundaries  
const THIN_SPACE = '\u2009';

/**
 * Add strategic spacing at script boundaries to prevent overlapping
 * Uses Unicode property classes for accurate script detection
 */
export function addScriptBoundarySpacing(text: string | null | undefined): string {
  if (!text) return '';
  
  let processed = String(text);
  
  // 1. Thai ↔ Latin transitions
  // Thai script followed by Latin letters
  processed = processed.replace(/([\p{Script=Thai}])([\p{Script=Latin}])/gu, `$1${HAIR_SPACE}$2`);
  // Latin letters followed by Thai script  
  processed = processed.replace(/([\p{Script=Latin}])([\p{Script=Thai}])/gu, `$1${HAIR_SPACE}$2`);
  
  // 2. Thai ↔ Number transitions
  // Thai script followed by numbers
  processed = processed.replace(/([\p{Script=Thai}])([\p{Number}])/gu, `$1${HAIR_SPACE}$2`);
  // Numbers followed by Thai script
  processed = processed.replace(/([\p{Number}])([\p{Script=Thai}])/gu, `$1${HAIR_SPACE}$2`);
  
  // 3. Latin ↔ Number transitions (for completeness)
  // Latin followed by numbers (less critical but helps)
  processed = processed.replace(/([\p{Script=Latin}])([\p{Number}])/gu, `$1${HAIR_SPACE}$2`);
  // Numbers followed by Latin
  processed = processed.replace(/([\p{Number}])([\p{Script=Latin}])/gu, `$1${HAIR_SPACE}$2`);
  
  // 4. Emoji boundaries (most critical for overlapping)
  // Emoji followed by any text
  processed = processed.replace(/([\p{Extended_Pictographic}])([\p{Script=Thai}\p{Script=Latin}\p{Number}])/gu, `$1${THIN_SPACE}$2`);
  // Text followed by emoji
  processed = processed.replace(/([\p{Script=Thai}\p{Script=Latin}\p{Number}])([\p{Extended_Pictographic}])/gu, `$1${THIN_SPACE}$2`);
  
  // 5. Special punctuation handling
  // Ensure space after closing parentheses/brackets when followed by text
  processed = processed.replace(/([)\]}])([^\s)\]}])/g, `$1${HAIR_SPACE}$2`);
  
  // 6. Clean up multiple consecutive spaces (but preserve our intentional spacing)
  // Only collapse regular spaces, not our hair/thin spaces
  processed = processed.replace(/[ ]{2,}/g, ' ');
  
  return processed;
}

/**
 * Process title text with enhanced spacing for problematic cases
 * Combines boundary spacing with additional title-specific fixes
 */
export function processTitleForPDF(title: string | null | undefined): string {
  if (!title) return '';
  
  let processed = addScriptBoundarySpacing(title);
  
  // Additional title-specific processing
  // Handle common problematic patterns from the examples
  
  // 1. Fix "KG++" pattern (number + letters + punctuation)
  processed = processed.replace(/(\d+)([A-Z]+)(\++)/g, `$1${HAIR_SPACE}$2$3`);
  
  // 2. Fix exclamation sequences "!!!!" 
  processed = processed.replace(/([!]{2,})/g, (match) => {
    // Add slight spacing within long exclamation sequences
    return match.split('').join('\u200A');
  });
  
  // 3. Handle parenthetical expressions better
  processed = processed.replace(/(\))(\s*)([A-Za-z\p{Script=Thai}])/gu, `$1${HAIR_SPACE}$3`);
  
  // 4. Fix pipe separator spacing
  processed = processed.replace(/(\s*)\|(\s*)/g, ` | `);
  
  return processed.trim();
}

/**
 * Process metadata text (categories, channels, etc.)
 * Lighter processing for shorter text
 */
export function processMetadataForPDF(text: string | null | undefined): string {
  if (!text) return '';
  
  // Just apply basic boundary spacing for metadata
  return addScriptBoundarySpacing(text).trim();
}

/**
 * Test the spacing processor with known problematic strings
 */
export function testScriptBoundarySpacing(): void {
  const testCases = [
    'แมพกระโดดแกล้งแปลกๆ (รู้ว่าเราคิดอะไร) Roblox UNEXPECTED Tower',
    '2,052 KG++ เกาะพังแล้วครับ !!!!🤯ผู้กี่สุด ในชีวิต !!!! | Roblox Grow a Garden',
    'LISA — DREAM feat. Kentaro Sakaguchi (Official Short Film MV)',
    'โครตเทพ! ยังเรียกว่าเล่นอีกเรื่อะ!? | Minecraft Gods and Guns EP.25',
    'Mark Tuan — hold still (Official Music Video)',
    'MV full1-Gatsu no Anklet - กิโลลิตรกำแพงความรอง🎵 / BNK48',
    'Demon Slayer: Kimetsu no Yaiba Infinity Castle | V5 VISUAL 2 TRAILER'
  ];
  
  console.log('[pdfTypo] Testing script boundary spacing:');
  testCases.forEach((test, i) => {
    const original = test;
    const processed = processTitleForPDF(test);
    
    console.log(`\n${i + 1}. Original: "${original}"`);
    console.log(`   Processed: "${processed}"`);
    
    // Show spacing differences
    const spacingAdded = processed.length - original.length;
    if (spacingAdded > 0) {
      console.log(`   → Added ${spacingAdded} spacing characters`);
    }
  });
}

/**
 * Get spacing statistics for debugging
 */
export function getSpacingStats(text: string): {
  original: string;
  processed: string;
  hairSpaces: number;
  thinSpaces: number;
  regularSpaces: number;
  totalSpacingChars: number;
} {
  const processed = addScriptBoundarySpacing(text);
  
  return {
    original: text,
    processed,
    hairSpaces: (processed.match(/\u200A/g) || []).length,
    thinSpaces: (processed.match(/\u2009/g) || []).length,
    regularSpaces: (processed.match(/ /g) || []).length,
    totalSpacingChars: processed.length - text.length
  };
}
