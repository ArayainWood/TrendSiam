/**
 * Universal PDF Font System v1 - Server Wrapper
 * 
 * Legacy wrapper that imports from server-specific module
 * Maintains backward compatibility for existing server code
 */

export {
  registerPdfFonts,
  getUniversalFontFamily,
  areFontsRegistered,
  resetFontRegistration,
  getFontRegistrationInfo,
  UNIVERSAL_FONT_FAMILY
} from './pdfFonts.server';

// Legacy export alias for backward compatibility
export { registerPdfFonts as registerPDFFonts } from './pdfFonts.server';
