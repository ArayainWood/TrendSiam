/**
 * Supabase Browser Client - CLIENT-SAFE
 * 
 * Uses ONLY public environment variables (NEXT_PUBLIC_*).
 * Safe to import in client components and browser-side code.
 * 
 * This client respects Row Level Security (RLS) policies and provides
 * user-level access only.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Environment variables validation for browser client
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('[supabaseBrowser] Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  console.error('[supabaseBrowser] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
}

/**
 * Browser-safe Supabase client instance
 * Cached for performance
 */
let browserClientCache: SupabaseClient | null = null;

/**
 * Get Supabase browser client with anon key
 * 
 * This client respects RLS policies and provides user-level access.
 * Safe to use in browser/client-side code.
 */
export function getSupabaseBrowser(): SupabaseClient {
  // Return cached instance if available
  if (browserClientCache) {
    return browserClientCache;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase browser configuration missing. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.'
    );
  }

  // Create browser client with anon key
  browserClientCache = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        'X-Client-Info': 'trendsiam-browser',
        'X-Client-Type': 'public',
      },
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  return browserClientCache;
}

/**
 * Test browser client connection
 * Safe to call from client-side code
 */
export async function testBrowserConnection(): Promise<{
  connected: boolean;
  error?: string;
  timestamp: string;
}> {
  try {
    const client = getSupabaseBrowser();
    
    // Test with a simple query to a public view
    const { error } = await client
      .from('weekly_public_view')
      .select('count', { count: 'exact', head: true });

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
 * Get browser client configuration info (safe for client-side logging)
 */
export function getBrowserClientInfo() {
  return {
    hasUrl: !!supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    urlLength: (supabaseUrl || '').length,
    anonKeyLength: (supabaseAnonKey || '').length,
    urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'not set',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check if browser client is properly configured
 */
export function isBrowserClientConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

/**
 * Force refresh of cached browser client
 * Useful for testing or development
 */
export function refreshBrowserClient(): void {
  browserClientCache = null;
}

// Export default instance for convenience
export const supabaseBrowser = getSupabaseBrowser;
