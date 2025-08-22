/**
 * Extract project reference from Supabase URL
 * 
 * Helps identify which Supabase project is being used
 * Useful for debugging environment mismatches
 */

/**
 * Extract project reference from a Supabase URL
 * 
 * @param url - The Supabase URL (e.g., https://abc123.supabase.co)
 * @returns The project reference or null if not found
 */
export function extractProjectRef(url: string | undefined): string | null {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Pattern 1: https://[project-ref].supabase.co
    const supabaseMatch = hostname.match(/^([a-zA-Z0-9-]+)\.supabase\.co$/);
    if (supabaseMatch && supabaseMatch[1]) {
      return supabaseMatch[1];
    }
    
    // Pattern 2: Custom domain or local dev
    // Return first part of hostname as fallback
    const parts = hostname.split('.');
    if (parts.length > 0 && parts[0]) {
      return parts[0];
    }
    
    return null;
  } catch (error) {
    console.error('[envProjectRef] Failed to parse URL:', error);
    return null;
  }
}

/**
 * Log project reference to console (server-only)
 * 
 * @param label - Optional label for the log
 */
export function logProjectRef(label?: string): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ref = extractProjectRef(url);
  
  if (ref) {
    console.log(`[${label || 'ProjectRef'}] Supabase project: ${ref}`);
  } else {
    console.warn(`[${label || 'ProjectRef'}] Could not extract project ref from URL`);
  }
}
