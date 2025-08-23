/**
 * Environment validation utility for server-side usage
 * Validates presence of critical environment variables without logging secrets
 */

import 'server-only';

interface EnvCheckResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates Supabase environment variables
 * @throws {Error} If critical variables are missing
 */
export function validateSupabaseEnv(): EnvCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check Supabase URL
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    errors.push('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required');
  } else if (!supabaseUrl.startsWith('https://')) {
    warnings.push('SUPABASE_URL should start with https://');
  }

  // Check Service Role Key (server-side only)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is required for server-side operations');
  } else if (serviceKey.length < 100) {
    warnings.push('SUPABASE_SERVICE_ROLE_KEY appears to be too short');
  }

  // Check anon key (public)
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    warnings.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing (needed for client-side operations)');
  }

  const isValid = errors.length === 0;

  // Log validation result without exposing secrets
  if (errors.length > 0) {
    console.error('[env-check] ❌ Supabase environment validation failed:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceKey,
      hasAnonKey: !!anonKey,
      enabled: process.env.SUPABASE_ENABLED,
      errors: errors.length,
      warnings: warnings.length
    });
  } else {
    console.log('[env-check] ✅ Supabase environment validation passed');
  }

  return { isValid, errors, warnings };
}

/**
 * Throws descriptive error if Supabase environment is invalid
 */
export function requireValidSupabaseEnv(): void {
  const result = validateSupabaseEnv();
  
  if (!result.isValid) {
    throw new Error(`Supabase environment validation failed: ${result.errors.join(', ')}`);
  }
}

/**
 * Check if Supabase is enabled and properly configured
 */
export function isSupabaseReady(): boolean {
  try {
    const enabled = process.env.SUPABASE_ENABLED;
    if (!enabled || enabled.toLowerCase() !== 'true') {
      console.log('[env-check] Supabase disabled via SUPABASE_ENABLED');
      return false;
    }

    const result = validateSupabaseEnv();
    if (result.isValid) {
      console.log('[env-check] ✅ Supabase is ready for operations');
    }
    return result.isValid;
  } catch (error) {
    console.error('[env-check] Error checking Supabase readiness:', error);
    return false;
  }
}

/**
 * Get diagnostic info for debugging (safe for logs)
 */
export function getEnvDiagnostics() {
  return {
    supabaseEnabled: process.env.SUPABASE_ENABLED,
    hasUrl: !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    nodeEnv: process.env.NODE_ENV
  };
}
