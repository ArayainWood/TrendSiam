/** @type {import('next').NextConfig} */

// ================================================================
// ENV SENTINEL: Verify .env.local exists before build
// ================================================================
// This prevents the issue where Phase 1 purge deleted .env.local
// and broke the app. Now we fail fast with a helpful message.
// ================================================================

const fs = require('fs');
const path = require('path');

const ENV_LOCAL_PATH = path.join(__dirname, '.env.local');
const ENV_EXAMPLE_PATH = path.join(__dirname, 'env.example');

// Only check in development/local builds (production uses different env vars)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL && !process.env.RENDER) {
  if (!fs.existsSync(ENV_LOCAL_PATH)) {
    console.error('\n❌ CRITICAL: frontend/.env.local is missing!\n');
    console.error('   This file is required for local development.');
    console.error('   It contains runtime secrets (Supabase keys, API keys, etc.)\n');
    console.error('   To fix:');
    console.error(`   1. Copy template: cp ${ENV_EXAMPLE_PATH} ${ENV_LOCAL_PATH}`);
    console.error('   2. Fill in your actual values from Supabase dashboard');
    console.error('   3. NEVER commit .env.local to git (already in .gitignore)\n');
    console.error('   If you need the original values, restore from backup:');
    console.error('   D:\\TrendSiam_BACKUP\\frontend\\.env.local\n');
    
    // Fail the build
    process.exit(1);
  } else {
    console.log('✅ ENV Check: .env.local found');
    
    // Verify critical keys exist (basic sanity check)
    require('dotenv').config({ path: ENV_LOCAL_PATH });
    const requiredKeys = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
    const missingKeys = requiredKeys.filter(key => !process.env[key]);
    
    if (missingKeys.length > 0) {
      console.error('\n⚠️  WARNING: Missing required environment variables:');
      missingKeys.forEach(key => console.error(`   - ${key}`));
      console.error('\n   Update your .env.local file with values from Supabase dashboard.\n');
      // Warn but don't fail (they might be set elsewhere)
    }
  }
}

const nextConfig = {
  // Prevent ESLint from failing the production build (Render)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Image optimization configuration
  images: {
    domains: ['localhost', '127.0.0.1'],
    unoptimized: true,
    remotePatterns: [
      // Generic Supabase pattern for any project
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Development
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000',
  },
  
  // Security headers
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https://*.supabase.co",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://www.googleapis.com https://youtube.googleapis.com",
              "media-src 'self' https://*.supabase.co",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests"
            ].join('; ')
          },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' }
        ],
      },
      {
        // Additional headers for API routes
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ];
  },
  
  // Redirect insecure requests in production
  async redirects() {
    return process.env.NODE_ENV === 'production' ? [
      {
        source: '/(.*)',
        has: [
          {
            type: 'header',
            key: 'x-forwarded-proto',
            value: 'http',
          },
        ],
        destination: 'https://trendsiam.com/$1',
        permanent: true,
      },
    ] : [];
  },
  
  // Disable x-powered-by header
  poweredByHeader: false,
  
  // Strict mode for React
  reactStrictMode: true,
  
  // Disable source maps in production
  productionBrowserSourceMaps: false,
  
  // SWC minification (more secure than Terser)
  swcMinify: true,
  
  // Experimental security features
  experimental: {
    // Enable strict CSP for App Router
    strictNextHead: true,
  },
};

module.exports = nextConfig;