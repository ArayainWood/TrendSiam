/**
 * Security Headers Configuration for Next.js
 * 
 * Implements comprehensive security headers to protect against
 * common web vulnerabilities.
 */

export interface SecurityHeaders {
  key: string;
  value: string;
}

// Content Security Policy directives
const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Required for Next.js
    "'unsafe-eval'", // Required for development, remove in production
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com"
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for styled-components/emotion
    "https://fonts.googleapis.com"
  ],
  'img-src': [
    "'self'",
    "data:",
    "blob:",
    "https://*.supabase.co",
    "https://i.ytimg.com",
    "https://img.youtube.com"
  ],
  'font-src': [
    "'self'",
    "https://fonts.gstatic.com"
  ],
  'connect-src': [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://api.openai.com",
    "https://www.googleapis.com",
    "https://youtube.googleapis.com"
  ],
  'media-src': [
    "'self'",
    "https://*.supabase.co"
  ],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'upgrade-insecure-requests': []
};

// Build CSP string
const buildCSP = (): string => {
  return Object.entries(CSP_DIRECTIVES)
    .map(([directive, values]) => {
      if (values.length === 0) return directive;
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');
};

// Security headers configuration
export const securityHeaders: SecurityHeaders[] = [
  {
    key: 'Content-Security-Policy',
    value: buildCSP()
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  }
];

// Development-specific adjustments
export const getSecurityHeaders = (isDevelopment: boolean = false): SecurityHeaders[] => {
  if (isDevelopment) {
    // Remove unsafe-eval restriction in development
    const devHeaders = [...securityHeaders];
    const cspIndex = devHeaders.findIndex(h => h.key === 'Content-Security-Policy');
    if (cspIndex >= 0) {
      const devCSP = { ...CSP_DIRECTIVES };
      devCSP['script-src'] = [...devCSP['script-src'], "'unsafe-eval'"];
      devHeaders[cspIndex] = {
        key: 'Content-Security-Policy',
        value: Object.entries(devCSP)
          .map(([directive, values]) => {
            if (values.length === 0) return directive;
            return `${directive} ${values.join(' ')}`;
          })
          .join('; ')
      };
    }
    return devHeaders;
  }
  
  return securityHeaders;
};

// Helper to add nonce to CSP for inline scripts
export const addNonceToCSP = (csp: string, nonce: string): string => {
  return csp.replace(
    /script-src([^;]*)/,
    `script-src$1 'nonce-${nonce}'`
  );
};

// Rate limiting configuration
export const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per window
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
};

// CORS configuration
export const CORS_CONFIG = {
  origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
