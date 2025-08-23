/**
 * PDF Fonts - CLI Wrapper
 * 
 * CLI-safe wrapper for font registration
 * Use this in CLI scripts and Node.js contexts
 */

export {
  registerPdfFonts,
  getUniversalFontFamily,
  areFontsRegistered,
  resetFontRegistration,
  getFontRegistrationInfo,
  UNIVERSAL_FONT_FAMILY
} from './pdfFonts.core';
