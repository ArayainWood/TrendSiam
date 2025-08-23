/**
 * PDF Fonts - Server Component Wrapper
 * 
 * Server-only wrapper for font registration
 * Use this in Next.js server components and API routes
 */

import 'server-only';
export {
  registerPdfFonts,
  getUniversalFontFamily,
  areFontsRegistered,
  resetFontRegistration,
  getFontRegistrationInfo,
  UNIVERSAL_FONT_FAMILY
} from './pdfFonts.core';
