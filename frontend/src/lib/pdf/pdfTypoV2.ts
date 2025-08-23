/**
 * PDF Typography Preprocessor v2
 * 
 * Enhanced version with more visible spacing for better PDF rendering
 * Uses regular spaces instead of hair/thin spaces for better compatibility
 */

import 'server-only';

// Use regular space for better PDF compatibility
const SPACE = ' ';

// Double space for emoji boundaries
const DOUBLE_SPACE = '  ';

/**
 * Add strategic spacing at script boundaries to prevent overlapping
 * V2: Uses regular spaces for better visibility in PDF
 */
export function addScriptBoundarySpacing(text: string | null | undefined): string {
  if (!text) return '';
  
  let processed = String(text);
  
  // 1. Thai ↔ Latin transitions
  // Thai script followed by Latin letters
  processed = processed.replace(/([\p{Script=Thai}])([\p{Script=Latin}])/gu, `$1${SPACE}$2`);
  // Latin letters followed by Thai script  
  processed = processed.replace(/([\p{Script=Latin}])([\p{Script=Thai}])/gu, `$1${SPACE}$2`);
  
  // 2. Thai ↔ Number transitions
  // Thai script followed by numbers
  processed = processed.replace(/([\p{Script=Thai}])([\p{Number}])/gu, `$1${SPACE}$2`);
  // Numbers followed by Thai script
  processed = processed.replace(/([\p{Number}])([\p{Script=Thai}])/gu, `$1${SPACE}$2`);
  
  // 3. Latin ↔ Number transitions - only when transitioning between words
  // Don't add space within things like "2,052" or "KG++"
  processed = processed.replace(/([a-zA-Z])(\d)/g, (match, p1, p2) => {
    // Check if this is part of a unit like "KG++"
    const beforeMatch = processed.substring(0, processed.indexOf(match));
    const afterMatch = processed.substring(processed.indexOf(match) + match.length);
    
    // Don't add space if followed by special chars like ++
    if (afterMatch.match(/^[+\-*/#%]/)) {
      return match;
    }
    
    return `${p1}${SPACE}${p2}`;
  });
  
  // 4. Emoji boundaries (most critical for overlapping)
  // Add double space for better separation
  // Note: We need to handle emoji as surrogate pairs in JavaScript
  
  // First, handle text before emoji
  processed = processed.replace(/([\p{Script=Thai}\p{Script=Latin}\p{Number}!])([\p{Extended_Pictographic}])/gu, `$1${DOUBLE_SPACE}$2`);
  
  // Then, handle emoji before text - this is the critical one for "🤯ผู้"
  // We need to be more explicit about emoji ranges for better compatibility
  processed = processed.replace(/([\u{1F300}-\u{1F9FF}])([\p{Script=Thai}\p{Script=Latin}\p{Number}])/gu, `$1${DOUBLE_SPACE}$2`);
  
  // Additional emoji ranges
  processed = processed.replace(/([\u{2600}-\u{26FF}])([\p{Script=Thai}\p{Script=Latin}\p{Number}])/gu, `$1${DOUBLE_SPACE}$2`);
  processed = processed.replace(/([\u{2700}-\u{27BF}])([\p{Script=Thai}\p{Script=Latin}\p{Number}])/gu, `$1${DOUBLE_SPACE}$2`);
  
  // 5. Special punctuation handling
  // Ensure space after closing parentheses/brackets when followed by text
  processed = processed.replace(/([)\]}])([^\s)\]}\-])/g, `$1${SPACE}$2`);
  
  // 6. Clean up multiple consecutive spaces (but preserve our double spaces for emoji)
  // First, temporarily mark double spaces around emoji
  processed = processed.replace(/([\p{Extended_Pictographic}])\s{2}/gu, '$1◊◊');
  processed = processed.replace(/\s{2}([\p{Extended_Pictographic}])/gu, '◊◊$1');
  
  // Collapse multiple spaces to single
  processed = processed.replace(/\s{3,}/g, ' ');
  
  // Restore double spaces around emoji
  processed = processed.replace(/◊◊/g, '  ');
  
  return processed;
}

/**
 * Process title text with enhanced spacing for problematic cases
 * V2: More aggressive spacing for known problem patterns
 */
export function processTitleForPDF(title: string | null | undefined): string {
  if (!title) return '';
  
  let processed = addScriptBoundarySpacing(title);
  
  // Additional title-specific processing
  
  // 1. Fix "KG++" pattern - don't add internal space
  // Already handled in base function
  
  // 2. Fix exclamation sequences "!!!!" - add space only for long sequences
  processed = processed.replace(/!{4,}/g, (match) => {
    // Add space between each exclamation only for 4+ exclamations
    return match.split('').join(' ');
  });
  
  // 3. Fix sequences like "🤯ผู้กี่สุด" - ensure proper spacing
  // Already handled by emoji boundaries
  
  // 4. Handle parenthetical expressions better
  processed = processed.replace(/(\))(?!\s)([A-Za-z\p{Script=Thai}])/gu, `$1${SPACE}$2`);
  
  // 5. Fix pipe separator spacing - ensure spaces around pipe
  processed = processed.replace(/\s*\|\s*/g, ' | ');
  
  // 6. Special handling for problematic Thai + punctuation
  // Add space between Thai and exclamation marks
  processed = processed.replace(/([\p{Script=Thai}])(!+)/gu, `$1${SPACE}$2`);
  
  // 7. Ensure no Thai characters are directly adjacent to emoji
  // This is a double-check as the base function should handle it
  // Use explicit emoji ranges for better compatibility
  processed = processed.replace(/([\u{1F300}-\u{1F9FF}])([\u0E00-\u0E7F])/gu, `$1${DOUBLE_SPACE}$2`);
  processed = processed.replace(/([\u0E00-\u0E7F])([\u{1F300}-\u{1F9FF}])/gu, `$1${DOUBLE_SPACE}$2`);
  
  // Also check for emoji followed immediately by Thai without any spacing
  // This specifically targets patterns like "🤯ผู้" where the emoji might not have been caught
  processed = processed.replace(/([^\s])([\u{1F300}-\u{1F9FF}])(?=[\u0E00-\u0E7F])/gu, `$1${SPACE}$2${DOUBLE_SPACE}`);
  processed = processed.replace(/([\u{1F300}-\u{1F9FF}])(?=[\u0E00-\u0E7F])/gu, `$1${DOUBLE_SPACE}`);
  
  // 8. Clean up any triple+ spaces that might have been created
  processed = processed.replace(/\s{3,}/g, '  ');
  
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
 * Test the enhanced spacing processor
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
  
  console.log('[pdfTypoV2] Testing enhanced script boundary spacing:');
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
  spacesAdded: number;
  totalLength: number;
} {
  const processed = addScriptBoundarySpacing(text);
  
  return {
    original: text,
    processed,
    spacesAdded: processed.length - text.length,
    totalLength: processed.length
  };
}
