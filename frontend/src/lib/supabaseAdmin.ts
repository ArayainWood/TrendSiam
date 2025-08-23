/**
 * Supabase Admin Client - SERVER-ONLY
 * 
 * ⚠️  CRITICAL SECURITY WARNING:
 * Do NOT import this file in client components, pages, or any "use client" code.
 * The service role key provides full admin access and MUST remain server-only.
 * 
 * Use this ONLY in:
 * - API routes (app/api/route.ts files)
 * - Server actions
 * - getServerSideProps (pages router)
 * - Server components (without "use client")
 */

import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/server/getEnv';

/**
 * Assert that an environment variable is not empty
 * Throws with clear error message if missing
 */
function assertNonEmpty(value: string | undefined, varName: string): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${varName}. Check your .env.local file.`);
  }
  return value.trim();
}

/**
 * Cached admin client instance
 */
let adminClientCache: SupabaseClient | null = null;

/**
 * Get Supabase admin client with service role key
 * 
 * This client bypasses Row Level Security (RLS) and has full database access.
 * Use responsibly and only for legitimate administrative operations.
 */
export function getSupabaseAdmin(): SupabaseClient {
  // Return cached instance if available
  if (adminClientCache) {
    return adminClientCache;
  }

  // Validate and get environment variables
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getEnv();
  const url = assertNonEmpty(SUPABASE_URL, 'SUPABASE_URL');
  const serviceRole = assertNonEmpty(SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');

  // Create admin client with service role key
  adminClientCache = createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'trendsiam-admin',
        'X-Admin-Access': 'service-role',
      },
    },
  });

  return adminClientCache;
}

/**
 * Test admin client connection
 * Returns boolean without exposing sensitive information
 */
export async function testAdminConnection(): Promise<{ 
  connected: boolean; 
  error?: string; 
  timestamp: string;
}> {
  try {
    const admin = getSupabaseAdmin();
    
    // Test with a simple query that requires minimal permissions
    const { error } = await admin
      .from('pg_tables')
      .select('tablename')
      .limit(1);

    if (error) {
      return {
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      connected: true,
      timestamp: new Date().toISOString(),
    };
    
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown connection error',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Get admin client configuration info (safe for logging)
 * Never returns actual keys, only metadata
 */
export function getAdminClientInfo() {
  try {
    const url = process.env.SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    return {
      hasUrl: !!url,
      hasServiceRole: !!serviceRole,
      urlLength: (url || '').length,
      serviceRoleLength: (serviceRole || '').length,
      urlPreview: url ? `${url.substring(0, 20)}...` : 'not set',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      hasUrl: false,
      hasServiceRole: false,
      error: error instanceof Error ? error.message : 'Configuration check failed',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Force refresh of cached admin client
 * Useful for testing or when environment variables change
 */
export function refreshAdminClient(): void {
  adminClientCache = null;
}
