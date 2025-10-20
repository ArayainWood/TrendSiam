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
    // Step 1: Try to fetch from view
    console.log('[weeklyRepo] Trying public_v_weekly_snapshots view...');
    const { data: viewData, error: viewError } = await supabase
      .from('public_v_weekly_snapshots')
      .select(COLS)
      .order('built_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (!viewError && viewData) {
      console.log('[weeklyRepo] Found snapshot in view');
      try {
        const validated = WeeklySnap.parse(viewData);
        return validated;
      } catch (e) {
        console.warn('[weeklyRepo] View data validation failed:', e);
      }
    } else if (viewError) {
      console.log('[weeklyRepo] View error (might not exist):', viewError.message);
    }
    
    // Step 2: No fallback to base table - Plan-B compliance
    console.log('[weeklyRepo] No fallback to base table - Plan-B security enforced');
    console.warn('[weeklyRepo] View access failed, no snapshots available');
    return null;
    
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
    tablePublishedCount: 0,
    tableTotalCount: 0
  };
  
  try {
    // Count from view
    const { count: viewCount } = await supabase
      .from('public_v_weekly_snapshots')
      .select('*', { count: 'exact', head: true });
    
    results.viewCount = viewCount || 0;
  } catch (e) {
    // View might not exist
  }
  
  // Plan-B: No direct table access from client
  results.tablePublishedCount = 0;
  results.tableTotalCount = 0;
  
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
    latestPublishedFromTable: null
  };
  
  try {
    // Latest from view
    const { data: viewData } = await supabase
      .from('public_v_weekly_snapshots')
      .select(COLS)
      .order('built_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (viewData) {
      diagnostics.latestFromView = {
        snapshot_id: viewData.snapshot_id,
        status: viewData.status,
        built_at: viewData.built_at,
        item_count: countTotalStories(viewData)
      };
    }
  } catch (e) {
    // View might not exist
  }
  
  // Plan-B: No direct table access from client
  diagnostics.latestPublishedFromTable = null;
  
  return diagnostics;
}