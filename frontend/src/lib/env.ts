/**
 * Server-only environment validation
 * 
 * Ensures all required Supabase environment variables are present
 * and throws descriptive errors if missing
 */

import 'server-only';

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
};

export function getEnv(): Env {
  const e = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  } as Record<string, string | undefined>;

  const missing = Object.entries(e).filter(([,v]) => !v).map(([k])=>k);
  if (missing.length) {
    throw new Error(`env-missing: ${missing.join(',')}`);
  }
  return e as Env;
}
