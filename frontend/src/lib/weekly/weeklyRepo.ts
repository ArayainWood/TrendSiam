/**
 * Weekly Report Repository
 * 
 * Centralized data access layer for weekly report snapshots
 * using public client with view fallback
 */

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { logProjectRef } from '@/utils/envProjectRef';

// Columns to select
const COLS = 'snapshot_id,status,built_at,created_at,range_start,range_end,items,meta';

// Tolerant validation schema
const WeeklySnap = z.object({
  snapshot_id: z.string(),
  status: z.string().optional(),
  built_at: z.coerce.date().optional(),
  created_at: z.coerce.date().optional(),
  range_start: z.coerce.date().optional(),
  range_end: z.coerce.date().optional(),
  items: z.array(z.any()).optional().default([]),
  meta: z.any().optional(),
});

export type WeeklySnapshot = z.infer<typeof WeeklySnap>;

// Create public Supabase client
function getPublicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

/**
 * Fetch the latest weekly snapshot
 * 
 * Tries view first, then falls back to table with status filter
 * @returns The latest snapshot or null if none found
 */
export async function fetchLatestWeekly(): Promise<WeeklySnapshot | null> {
  const supabase = getPublicSupabase();
  
  // Log project ref for debugging
  if (typeof window === 'undefined') {
    logProjectRef('weeklyRepo');
  }
  
  try {
    // Use the correct public view: public_v_weekly_snapshots (Plan-B compliant)
    console.log('[weeklyRepo] Fetching from public_v_weekly_snapshots view...');
    const { data, error } = await supabase
      .from('public_v_weekly_snapshots')
      .select(COLS)
      .order('built_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error('[weeklyRepo] Query error:', error.message);
      console.error('[weeklyRepo] Error details:', error);
      return null;
    }
    
    if (!data) {
      console.warn('[weeklyRepo] No snapshots found');
      return null;
    }
    
    console.log('[weeklyRepo] Found snapshot:', data.snapshot_id);
    
    // Validate and return
    try {
      const validated = WeeklySnap.parse(data);
      return validated;
    } catch (e) {
      console.error('[weeklyRepo] Data validation failed:', e);
      return null;
    }
    
  } catch (error) {
    console.error('[weeklyRepo] Unexpected error:', error);
    return null;
  }
}

/**
 * Count total stories in a snapshot
 * 
 * @param snap - The weekly snapshot
 * @returns Total number of stories
 */
export function countTotalStories(snap: any): number {
  if (!snap) return 0;
  
  // Primary: items array length
  if (Array.isArray(snap.items)) {
    return snap.items.length;
  }
  
  // Fallback: meta.total_items
  if (typeof snap.meta?.total_items === 'number') {
    return snap.meta.total_items;
  }
  
  return 0;
}

/**
 * Get diagnostic counts for debugging
 * 
 * @returns Counts from view and table
 */
export async function getDiagnosticCounts() {
  const supabase = getPublicSupabase();
  
  const results = {
    viewCount: 0,
    viewPublishedCount: 0
  };
  
  try {
    // Count total from public view
    const { count: totalCount } = await supabase
      .from('public_v_weekly_snapshots')
      .select('*', { count: 'exact', head: true });
    
    results.viewCount = totalCount || 0;
    
    // Count published (status='published' already filtered by view)
    const { count: publishedCount } = await supabase
      .from('public_v_weekly_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published');
    
    results.viewPublishedCount = publishedCount || 0;
    
  } catch (e) {
    console.error('[weeklyRepo] Error getting counts:', e);
  }
  
  return results;
}

/**
 * Fetch diagnostic data for troubleshooting
 * 
 * @returns Diagnostic information
 */
export async function fetchDiagnosticData() {
  const supabase = getPublicSupabase();
  
  const diagnostics: any = {
    latestFromView: null,
    totalCount: 0,
    publishedCount: 0
  };
  
  try {
    // Get counts
    const counts = await getDiagnosticCounts();
    diagnostics.totalCount = counts.viewCount;
    diagnostics.publishedCount = counts.viewPublishedCount;
    
    // Latest snapshot from public view
    const { data } = await supabase
      .from('public_v_weekly_snapshots')
      .select(COLS)
      .order('built_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (data) {
      diagnostics.latestFromView = {
        snapshot_id: data.snapshot_id,
        status: data.status,
        built_at: data.built_at,
        item_count: countTotalStories(data)
      };
    }
    
  } catch (e) {
    console.error('[weeklyRepo] Error fetching diagnostic data:', e);
  }
  
  return diagnostics;
}