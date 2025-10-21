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
    lineHeight: 1.8,         // Increased for Thai tone marks
    letterSpacing: 0.05,     // Reduced for natural Thai spacing

  },
  
  // Headings
  h1: {
    fontFamily: FONT_FAMILY,
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 1.5,         // Slightly tighter for headings
    marginBottom: 8,
    letterSpacing: 0,        // No extra spacing for large text

  },
  
  h2: {
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 1.5,
    marginBottom: 6,
    letterSpacing: 0,

  },
  
  h3: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: 'bold',
    lineHeight: 1.5,
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
    lineHeight: 2.5,         // Extra line height for Thai tone marks and vowels
    marginBottom: 6,         // More space between items
    letterSpacing: 0.2,      // Slightly reduced for better Thai rendering

    textAlign: 'left',
    maxWidth: '100%',
    overflow: 'hidden',      // React-PDF only supports hidden

    paddingTop: 2,           // Extra padding for ascending marks
    paddingBottom: 2,        // Extra padding for descending marks
  },
  
  // Metadata text (smaller, less critical)
  itemMeta: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    lineHeight: 1.8,         // Increased for Thai marks
    color: '#6B7280',
    letterSpacing: 0,        // No extra spacing for small Thai text

    paddingTop: 1,           // Small padding for tone marks
    paddingBottom: 1,
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
  
  // Special styles for problematic content
  mixedScript: {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    lineHeight: 1.8,         // Maximum line height for mixed scripts
    letterSpacing: 0.2,      // Maximum letter spacing
    wordSpacing: 2,          // Maximum word spacing

  },
  
  // Emoji-heavy content
  emojiText: {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    lineHeight: 1.9,         // Extra space for emoji
    letterSpacing: 0.25,     // Extra spacing around emoji


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
    letterSpacing: 0.1,
    wordSpacing: 1,

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
    letterSpacing: 0.15,


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
    letterSpacing: 0.05,

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
