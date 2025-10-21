import { Font } from '@react-pdf/renderer';
import { existsSync } from 'fs';
import { join } from 'path';

let registered = false;

/**
 * Register PDF fonts with environment-aware fallbacks
 * Guards against double registration and font loading failures
 */
export function registerPdfFonts() {
  if (registered) return;
  
  try {
    // Environment-aware font selection
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Production: Use reliable Google Fonts static URLs
    // Development: Check for local fonts, fallback to Google Fonts
    let regularSrc: string;
    let boldSrc: string;
    
    if (isProduction) {
      // Production: Always use Google Fonts for reliability
      regularSrc = 'https://fonts.gstatic.com/s/notosansthai/v20/iJWnBXeUZi_OHPqn4wq6hQ2_hbJ1xyN9wd43SofNWcd1MKVQt_So_9CdU5RtpzF-QRvzzXg.woff2';
      boldSrc = 'https://fonts.gstatic.com/s/notosansthai/v20/iJWnBXeUZi_OHPqn4wq6hQ2_hbJ1xyN9wd43SofNWcd1MKVQt_So_9CdU5RtpzF-QRvzzXg.woff2';
    } else {
      // Development: Try local fonts first, fallback to Google Fonts
      const localRegular = join(process.cwd(), 'public/fonts/NotoSansThai-Regular.ttf');
      const localBold = join(process.cwd(), 'public/fonts/NotoSansThai-Bold.ttf');
      
      regularSrc = existsSync(localRegular) 
        ? '/fonts/NotoSansThai-Regular.ttf'
        : 'https://fonts.gstatic.com/s/notosansthai/v20/iJWnBXeUZi_OHPqn4wq6hQ2_hbJ1xyN9wd43SofNWcd1MKVQt_So_9CdU5RtpzF-QRvzzXg.woff2';
      
      boldSrc = existsSync(localBold)
        ? '/fonts/NotoSansThai-Bold.ttf'
        : 'https://fonts.gstatic.com/s/notosansthai/v20/iJWnBXeUZi_OHPqn4wq6hQ2_hbJ1xyN9wd43SofNWcd1MKVQt_So_9CdU5RtpzF-QRvzzXg.woff2';
    }
    
    Font.register({
      family: 'NotoSansThai',
      src: regularSrc,
    });
    
    Font.register({
      family: 'NotoSansThai-Bold', 
      src: boldSrc,
    });
    
    registered = true;
    console.log('[pdf-fonts] ✅ Fonts registered successfully', { 
      environment: process.env.NODE_ENV,
      regularSrc: regularSrc.includes('http') ? 'Google Fonts' : 'Local',
      boldSrc: boldSrc.includes('http') ? 'Google Fonts' : 'Local'
    });
  } catch (error) {
    console.warn('[pdf-fonts] ⚠️ Font registration failed, using system fonts:', error);
    // Continue without custom fonts - will fall back to system fonts
    registered = true; // Prevent retry loops
  }
}

// Legacy alias for backward compatibility
export const getRegisteredFonts = registerPdfFonts;
