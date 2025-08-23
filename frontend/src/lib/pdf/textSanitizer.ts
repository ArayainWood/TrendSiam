/**
 * PDF Text Sanitization Utility
 * 
 * Fixes overlapping text issues in PDF generation by:
 * 1. Normalizing Unicode to NFC form
 * 2. Removing problematic zero-width characters
 * 3. Cleaning up exotic whitespace
 * 4. Preserving Thai, Latin, punctuation, and emoji
 */

import 'server-only';

/**
 * Sanitize text for PDF rendering to prevent glyph overlaps
 */
export function sanitizeForPDF(text: string | null | undefined): string {
  if (!text) return '';
  
  let sanitized = String(text);
  
  // 1. Normalize Unicode to NFC (Canonical Decomposition, followed by Canonical Composition)
  // This ensures consistent representation of accented characters
  sanitized = sanitized.normalize('NFC');
  
  // 2. Remove problematic zero-width characters that can cause layout issues
  // U+200B: Zero Width Space
  // U+200C: Zero Width Non-Joiner  
  // U+200D: Zero Width Joiner
  // U+FEFF: Zero Width No-Break Space (BOM)
  sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  // 3. Normalize whitespace - collapse multiple spaces but preserve line breaks
  sanitized = sanitized.replace(/[ \t]+/g, ' ');
  
  // 4. Remove control characters except common ones (tab, newline, carriage return)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // 5. Trim leading/trailing whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Sanitize title specifically for PDF rendering
 * Applies additional formatting for better line breaking
 */
export function sanitizeTitleForPDF(title: string | null | undefined): string {
  const sanitized = sanitizeForPDF(title);
  
  // Enhanced sanitization for mixed Thai/Latin text to prevent overlapping
  return sanitized
    // Add spaces around problematic script transitions
    .replace(/([\u0E00-\u0E7F])([A-Za-z])/g, '$1 $2')  // Thai -> Latin
    .replace(/([A-Za-z])([\u0E00-\u0E7F])/g, '$1 $2')  // Latin -> Thai
    .replace(/([\u0E00-\u0E7F])([0-9])/g, '$1 $2')     // Thai -> Number
    .replace(/([0-9])([\u0E00-\u0E7F])/g, '$1 $2')     // Number -> Thai
    // Handle emoji transitions that cause overlapping
    .replace(/([\u0E00-\u0E7F])([\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}])/gu, '$1 $2')
    .replace(/([\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}])([A-Za-z])/gu, '$1 $2')
    // Ensure proper punctuation spacing
    .replace(/([.!?:;]) /g, '$1 ')      // Ensure space after punctuation
    .replace(/([)]) /g, '$1 ')          // Ensure space after closing parenthesis
    .replace(/([}\]]) /g, '$1 ')        // Ensure space after closing brackets
    // Typography improvements
    .replace(/ - /g, ' — ')             // Use em dash for better typography
    .replace(/\.\.\./g, '…')            // Use ellipsis character
    // Clean up multiple spaces created by our replacements
    .replace(/  +/g, ' ')
    .trim();
}

/**
 * Get text metrics for debugging
 */
export function getTextMetrics(text: string): {
  original: string;
  sanitized: string;
  length: number;
  hasThaiChars: boolean;
  hasLatinChars: boolean;
  hasPunctuation: boolean;
  hasEmoji: boolean;
  hasZeroWidth: boolean;
} {
  const sanitized = sanitizeForPDF(text);
  
  return {
    original: text,
    sanitized,
    length: sanitized.length,
    hasThaiChars: /[\u0E00-\u0E7F]/.test(text),
    hasLatinChars: /[A-Za-z]/.test(text),
    hasPunctuation: /[.!?:;,()[\]{}'""-]/.test(text),
    hasEmoji: /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(text),
    hasZeroWidth: /[\u200B-\u200D\uFEFF]/.test(text)
  };
}

/**
 * Test function to validate sanitization
 */
export function testSanitization(): void {
  const testCases = [
    'LISA - DREAM feat. Kentaro Sakaguchi (Official Sho...',
    'à¹à¸«à¸à¸à¸à¸²à¸à¸à¸µà¹! à¸¢à¸±à¸à¹à¸£à¸µà¸¢à¸à¸§à¹à¸²à¹à¸¥à¹à¸à¸­à¸µà¸à¹à¸£à¹à¸­à¸°!? | Minecraft ...',
    'Mark Tuan - hold still (Official Music Video)...',
    'Test\u200BZero\u200CWidth\u200DChars\uFEFF',
    'Multiple   spaces    and\ttabs',
    'Thai: สวัสดี + Latin: Hello! 🎉'
  ];
  
  console.log('[textSanitizer] Testing sanitization:');
  testCases.forEach((test, i) => {
    const metrics = getTextMetrics(test);
    console.log(`${i + 1}. "${test.substring(0, 50)}${test.length > 50 ? '...' : ''}"`);
    console.log(`   → "${metrics.sanitized}"`);
    console.log(`   Thai: ${metrics.hasThaiChars}, Latin: ${metrics.hasLatinChars}, ZeroWidth: ${metrics.hasZeroWidth}`);
  });
}
