/**
 * Supabase Public Client for Weekly Public View Integration
 * 
 * Uses public anon key to access weekly_public_view with proper error handling.
 */

import { createClient } from '@supabase/supabase-js';

// Environment variables validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('[supabasePublic] Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  console.error('[supabasePublic] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
}

// Create Supabase public client
export const supabasePublic = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
);

/**
 * Get the public Supabase client instance
 * @returns Supabase client configured with anon key
 */
export function getPublicSupabase() {
  return supabasePublic;
}

/**
 * Weekly Public View interface based on expected schema
 */
export interface WeeklyPublicViewRow {
  id?: string;
  story_id: string;
  title: string;
  summary?: string | null;
  summary_en?: string | null;
  category: string;
  platform: string;
  video_id: string;
  popularity_score: number;
  popularity_score_precise: number;
  published_date: string;
  description?: string | null;
  channel: string;
  view_count: string;
  like_count?: string | null;
  comment_count?: string | null;
  ai_image_url?: string | null;
  ai_image_prompt?: string | null;
  created_at: string;
  updated_at?: string | null;
}

/**
 * Fetch weekly data from weekly_public_view
 * Orders by created_at descending and throws error if query fails
 */
export async function getWeeklyPublicView(): Promise<WeeklyPublicViewRow[]> {
  console.log('[supabasePublic] Fetching from weekly_public_view...');
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables not configured');
  }

  try {
    const { data, error, count } = await supabasePublic
      .from('weekly_public_view')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(100); // Reasonable limit for weekly data

    if (error) {
      console.error('[supabasePublic] ❌ Query failed:', error);
      throw new Error(`weekly_public_view query failed: ${error.message}`);
    }

    if (!data) {
      console.warn('[supabasePublic] ⚠️ No data returned from weekly_public_view');
      throw new Error('weekly_public_view returned null data');
    }

    console.log(`[supabasePublic] ✅ Successfully fetched ${data.length} rows from weekly_public_view (total: ${count || 'unknown'})`);
    
    return data as WeeklyPublicViewRow[];
    
  } catch (error) {
    console.error('[supabasePublic] ❌ Error fetching from weekly_public_view:', error);
    throw error;
  }
}

/**
 * Test the connection and environment variables
 */
export async function testPublicConnection(): Promise<{ ok: boolean; rows?: number; error?: string }> {
  try {
    const { data, error, count } = await supabasePublic
      .from('weekly_public_view')
      .select('id', { count: 'exact' })
      .limit(1);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, rows: count || 0 };
  } catch (error) {
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Verify environment variables are loaded correctly
 */
export function verifyEnvironment(): { isValid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
  const isValid = missing.length === 0;
  
  console.log('[supabasePublic] Environment check:', {
    isValid,
    hasUrl: !!supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    missing
  });
  
  return { isValid, missing };
}
