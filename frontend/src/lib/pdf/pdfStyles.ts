/**
 * Centralized PDF Styles v1
 * 
 * Unified typography system for React-PDF components
 * Optimized for Thai + Latin + emoji mixed-script rendering
 */

import { StyleSheet } from '@react-pdf/renderer';
import { getUniversalFontFamily } from './pdfFonts';

// Get the universal font family name
const FONT_FAMILY = getUniversalFontFamily();

/**
 * Create PDF styles with optimal spacing for mixed-script text
 * All styles use the universal font family to prevent mid-line fallbacks
 */
export const createPDFStyles = () => StyleSheet.create({
  // Base page layout
  page: {
    padding: 24,
    fontFamily: FONT_FAMILY,
  },
  
  // Base text style - foundation for all text
  text: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    lineHeight: 1.35,        // Optimal for Thai (not excessive)
    letterSpacing: 0,        // No extra spacing for natural Thai rendering

  },
  
  // Headings
  h1: {
    fontFamily: FONT_FAMILY,
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 1.35,        // Consistent Thai-optimized line height
    marginBottom: 8,
    letterSpacing: 0,        // No extra spacing

  },
  
  h2: {
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 1.35,        // Consistent Thai-optimized line height
    marginBottom: 6,
    letterSpacing: 0,

  },
  
  h3: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: 'bold',
    lineHeight: 1.35,        // Consistent Thai-optimized line height
    marginBottom: 4,
    letterSpacing: 0,

  },
  
  // Content item styles
  item: {
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB'
  },
  
  // Item title - most critical for overlapping issues
  itemTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    fontWeight: 'bold',
    lineHeight: 1.65,        // Thai-safe line height (1.65 prevents diacritic clipping)
    marginBottom: 4,         // Reduced spacing
    letterSpacing: 0,        // Zero letter spacing for natural Thai rendering

    textAlign: 'left',
    maxWidth: '100%',
    overflow: 'hidden',      // React-PDF only supports hidden

    paddingTop: 3,           // Extra clearance for combining marks
    paddingBottom: 3,        // Extra clearance for combining marks
  },
  
  // Metadata text (smaller, less critical)
  itemMeta: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    lineHeight: 1.35,        // Consistent with base text
    color: '#6B7280',
    letterSpacing: 0,        // No extra spacing for natural Thai rendering

    paddingTop: 0,           // No padding needed
    paddingBottom: 0,
  },
  
  // Footer and supplementary text
  footer: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB'
  },
  
  footerText: {
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    lineHeight: 1.4,
    color: '#6B7280',

  },
  
  // Test/debug styles
  thaiTest: {
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    lineHeight: 1.4,
    color: '#059669',
    marginBottom: 10,
    letterSpacing: 0,

  },
  
  // Special styles for problematic content (DISABLED - causes Thai diacritic breakage)
  // letterSpacing breaks grapheme clusters in @react-pdf/renderer
  mixedScript: {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    lineHeight: 1.8,         // Maximum line height for mixed scripts
    letterSpacing: 0,        // CRITICAL: Must be 0 for Thai/CJK
    wordSpacing: 0,          // CRITICAL: Must be 0 for Thai/CJK
  },
  
  // Emoji-heavy content (DISABLED - causes rendering issues)
  emojiText: {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    lineHeight: 1.9,         // Extra space for emoji
    letterSpacing: 0,        // CRITICAL: Must be 0 for mixed emoji+text
  }
});

/**
 * Get base text style for consistent application
 */
export function getBaseTextStyle() {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    lineHeight: 1.65,
    letterSpacing: 0,        // CRITICAL: Must be 0 for Thai/CJK
    wordSpacing: 0,          // CRITICAL: Must be 0 for Thai/CJK
  };
}

/**
 * Get title style for mixed-script content
 */
export function getMixedScriptTitleStyle() {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    fontWeight: 'bold' as const,
    lineHeight: 1.75,
    letterSpacing: 0,        // CRITICAL: Must be 0 for Thai/CJK
  };
}

/**
 * Get metadata style
 */
export function getMetadataStyle() {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    lineHeight: 1.5,
    color: '#6B7280',
    letterSpacing: 0,        // CRITICAL: Must be 0 for Thai/CJK
  };
}

/**
 * Style recommendations based on content analysis
 */
export function getRecommendedStyle(text: string) {
  const hasEmoji = /[\p{Extended_Pictographic}]/u.test(text);
  const hasMixedScript = /[\p{Script=Thai}].*[\p{Script=Latin}]|[\p{Script=Latin}].*[\p{Script=Thai}]/u.test(text);
  const hasNumbers = /[\p{Number}]/u.test(text);
  
  if (hasEmoji) {
    return 'emojiText';
  } else if (hasMixedScript || hasNumbers) {
    return 'mixedScript';
  } else {
    return 'text';
  }
}

/**
 * Debug function to test style application
 */
export function testStyleApplication(): void {
  const testTexts = [
    'แมพกระโดดแกล้งแปลกๆ (รู้ว่าเราคิดอะไร) Roblox UNEXPECTED Tower',
    '2,052 KG++ เกาะพังแล้วครับ !!!!🤯ผู้กี่สุด ในชีวิต !!!!',
    'LISA — DREAM feat. Kentaro Sakaguchi',
    'รายงานแนวโน้มสัปดาห์ TrendSiam',
    'Entertainment | ช่อง: LOUD Official'
  ];
  
  console.log('[pdfStyles] Style recommendations:');
  testTexts.forEach((text, i) => {
    const recommended = getRecommendedStyle(text);
    console.log(`${i + 1}. "${text.substring(0, 50)}..."`);
    console.log(`   → Recommended style: ${recommended}`);
  });
}
