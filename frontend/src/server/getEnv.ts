// src/server/getEnv.ts
// Server/CLI usage only. NEVER import in client components.

/**
 * Get server-side environment variables with type safety
 * @throws {Error} If required environment variables are missing
 */
export function getEnv() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Server env missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  } as const;
}
