/**
 * Universal PDF Font System - Core Logic
 * 
 * Core font registration logic without server-only restrictions
 * Used by both server components and CLI scripts
 */

import { Font } from '@react-pdf/renderer';
import { resolveThaiFonts } from './fontResolver.core';

// Universal font family name used throughout PDF components
export const UNIVERSAL_FONT_FAMILY = 'NotoSansThaiUniversal';

// Track registration state to avoid double-registration
let fontsRegistered = false;

/**
 * Register universal font family that handles Thai, Latin, and basic symbols
 * This prevents font fallback mid-line which causes glyph overlapping
 */
export function registerPdfFonts(): void {
  if (fontsRegistered) {
    console.log('[pdfFonts] ✓ Fonts already registered, skipping...');
    return;
  }

  try {
    const { REG, BOLD } = resolveThaiFonts();
    
    console.log('[pdfFonts] 🔧 Registering universal PDF font family...');
    
    // Register the universal font family with Thai fonts as the base
    // This ensures consistent metrics for Thai + Latin mixed text
    Font.register({
      family: UNIVERSAL_FONT_FAMILY,
      fonts: [
        { src: REG, fontWeight: 'normal', fontStyle: 'normal' },
        { src: BOLD, fontWeight: 'bold', fontStyle: 'normal' },
      ]
    });
    
    // Override common system font fallbacks to use our universal family
    // This prevents React-PDF from falling back to Arial/Helvetica for Latin text
    const systemFonts = ['Helvetica', 'Arial', 'sans-serif', 'Times', 'serif'];
    
    systemFonts.forEach(fontName => {
      Font.register({
        family: fontName,
        fonts: [
          { src: REG, fontWeight: 'normal' },
          { src: BOLD, fontWeight: 'bold' },
        ]
      });
    });
    
    // Disable Thai hyphenation to prevent word breaking issues
    Font.registerHyphenationCallback((word: string) => {
      // Never hyphenate Thai text - return the word as a single unit
      return [word];
    });
    
    fontsRegistered = true;
    
    console.log('[pdfFonts] ✅ Universal font system registered successfully');
    console.log(`[pdfFonts] Primary family: ${UNIVERSAL_FONT_FAMILY}`);
    console.log(`[pdfFonts] System overrides: ${systemFonts.join(', ')}`);
    console.log('[pdfFonts] Thai hyphenation: disabled');
    
  } catch (error) {
    console.error('[pdfFonts] ❌ Failed to register PDF fonts:', error);
    throw new Error(`PDF font registration failed: ${error}`);
  }
}

/**
 * Get the universal font family name for use in StyleSheet
 */
export function getUniversalFontFamily(): string {
  return UNIVERSAL_FONT_FAMILY;
}

/**
 * Check if fonts are registered
 */
export function areFontsRegistered(): boolean {
  return fontsRegistered;
}

/**
 * Reset registration state (for testing)
 */
export function resetFontRegistration(): void {
  fontsRegistered = false;
}

/**
 * Get font registration info for diagnostics
 */
export function getFontRegistrationInfo(): {
  registered: boolean;
  universalFamily: string;
  hyphenationDisabled: boolean;
} {
  return {
    registered: fontsRegistered,
    universalFamily: UNIVERSAL_FONT_FAMILY,
    hyphenationDisabled: true
  };
}
