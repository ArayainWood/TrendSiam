import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rate limiting store (in production, use Redis or similar)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// Configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per window

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Get client identifier (IP or fallback)
  const clientId = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'anonymous';
  
  // Apply rate limiting to API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const now = Date.now();
    const clientData = requestCounts.get(clientId) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
    
    // Reset if window expired
    if (now > clientData.resetTime) {
      clientData.count = 0;
      clientData.resetTime = now + RATE_LIMIT_WINDOW;
    }
    
    // Increment count
    clientData.count++;
    requestCounts.set(clientId, clientData);
    
    // Check rate limit
    if (clientData.count > RATE_LIMIT_MAX) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((clientData.resetTime - now) / 1000)),
          },
        }
      );
    }
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX));
    response.headers.set('X-RateLimit-Remaining', String(Math.max(0, RATE_LIMIT_MAX - clientData.count)));
    response.headers.set('X-RateLimit-Reset', String(clientData.resetTime));
  }
  
  // Security headers (backup for next.config.js)
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove sensitive headers
  response.headers.delete('X-Powered-By');
  
  // CORS for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL,
      'http://localhost:3000',
      'http://localhost:3001',
    ].filter(Boolean);
    
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.headers.set('Access-Control-Max-Age', '86400');
      return new NextResponse(null, { status: 200, headers: response.headers });
    }
  }
  
  // Prevent clickjacking for admin routes
  if (request.nextUrl.pathname.startsWith('/admin') || 
      request.nextUrl.pathname.startsWith('/dev-dashboard')) {
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  }
  
  // Add request ID for tracking
  const requestId = crypto.randomUUID();
  response.headers.set('X-Request-ID', requestId);
  
  // Log security events (in production, send to monitoring service)
  if (process.env.NODE_ENV === 'production') {
    // Log suspicious patterns
    const userAgent = request.headers.get('user-agent') || '';
    const suspiciousPatterns = [
      /sqlmap/i,
      /nikto/i,
      /scanner/i,
      /nmap/i,
      /harvest/i,
      /sql.*injection/i,
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
      console.warn(`[Security] Suspicious user agent detected: ${userAgent} from ${clientId}`);
    }
    
    // Check for common attack patterns in URL
    const url = request.nextUrl.toString();
    const attackPatterns = [
      /\.\.\//g,  // Path traversal
      /<script/i, // XSS
      /union.*select/i, // SQL injection
      /eval\(/i,  // Code injection
      /base64_/i, // Encoded payloads
    ];
    
    if (attackPatterns.some(pattern => pattern.test(url))) {
      console.warn(`[Security] Potential attack pattern in URL: ${url} from ${clientId}`);
      return new NextResponse(null, { status: 400 });
    }
  }
  
  return response;
}

// Configure which routes use middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)  
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};

// Cleanup old rate limit entries periodically
if (typeof global !== 'undefined') {
  const g = global as any;
  if (!g.rateLimitCleanupInterval) {
    g.rateLimitCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [clientId, data] of requestCounts.entries()) {
        if (now > data.resetTime + RATE_LIMIT_WINDOW) {
          requestCounts.delete(clientId);
        }
      }
    }, RATE_LIMIT_WINDOW);
  }
}
