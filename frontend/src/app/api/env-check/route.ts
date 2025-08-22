/**
 * Environment Check API Route
 * 
 * SECURITY: Server-only route that checks environment variables without exposing secrets.
 * Returns only boolean/length indicators, never actual secret values.
 */

import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Optional protection with admin token
  const adminToken = process.env.ADMIN_CHECK_TOKEN;
  
  try {
    // Check for service role key and URL (most critical)
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // Check for public keys (less sensitive but still important)
    const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publicAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    // Build response with ONLY boolean/length indicators
    const response = {
      serverSeen: {
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_URL_LEN: (supabaseUrl || '').length,
        SUPABASE_SERVICE_ROLE_KEY: !!serviceRoleKey,
        SUPABASE_SERVICE_ROLE_KEY_LEN: (serviceRoleKey || '').length,
        NEXT_PUBLIC_SUPABASE_URL: !!publicUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: !!publicAnonKey,
      },
      nodePid: process.pid,
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      // Include basic validation
      validation: {
        hasRequiredServerVars: !!(supabaseUrl && serviceRoleKey),
        hasRequiredPublicVars: !!(publicUrl && publicAnonKey),
        urlsMatch: supabaseUrl === publicUrl,
      }
    };

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'X-TS-API': 'env-check-v1',
      },
    });
    
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: 'Environment check failed',
      details: error?.message || 'unknown error',
      serverSeen: {
        SUPABASE_URL: false,
        SUPABASE_SERVICE_ROLE_KEY: false,
        SUPABASE_SERVICE_ROLE_KEY_LEN: 0,
      },
      nodePid: process.pid,
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-TS-API': 'env-check-v1',
      },
    });
  }
}
