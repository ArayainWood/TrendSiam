/**
 * Server-side Supabase client with service role key
 * 
 * Uses SUPABASE_SERVICE_ROLE_KEY for bypassing RLS and server-side operations
 * 
 * @deprecated Use getSupabaseAdmin() from './supabaseAdmin' instead for better security practices
 */

import 'server-only';
import { getSupabaseAdmin } from './supabaseAdmin';

/**
 * @deprecated Use getSupabaseAdmin() instead
 */
export function createSupabaseServer() {
  // Delegate to the new secure admin client
  return getSupabaseAdmin();
}