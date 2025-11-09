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
    console.log('[weeklyRepo] Trying weekly_report_public_v view...');
    const { data: viewData, error: viewError } = await supabase
      .from('weekly_report_public_v')
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
    
    // Step 2: Fallback to table with status filter
    console.log('[weeklyRepo] Falling back to weekly_report_snapshots table...');
    const { data: tableData, error: tableError } = await supabase
      .from('weekly_report_snapshots')
      .select(COLS)
      .eq('status', 'published')
      .order('built_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (!tableError && tableData) {
      console.log('[weeklyRepo] Found published snapshot in table');
      try {
        const validated = WeeklySnap.parse(tableData);
        return validated;
      } catch (e) {
        console.warn('[weeklyRepo] Table data validation failed:', e);
      }
    } else if (tableError) {
      console.error('[weeklyRepo] Table error:', tableError.message);
    }
    
    // No snapshots found
    console.warn('[weeklyRepo] No snapshots found in view or table');
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
      .from('weekly_report_public_v')
      .select('*', { count: 'exact', head: true });
    
    results.viewCount = viewCount || 0;
  } catch (e) {
    // View might not exist
  }
  
  try {
    // Count published from table
    const { count: publishedCount } = await supabase
      .from('weekly_report_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published');
    
    results.tablePublishedCount = publishedCount || 0;
  } catch (e) {
    console.error('[weeklyRepo] Error counting published:', e);
  }
  
  try {
    // Total count from table
    const { count: totalCount } = await supabase
      .from('weekly_report_snapshots')
      .select('*', { count: 'exact', head: true });
    
    results.tableTotalCount = totalCount || 0;
  } catch (e) {
    console.error('[weeklyRepo] Error counting total:', e);
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
    latestPublishedFromTable: null
  };
  
  try {
    // Latest from view
    const { data: viewData } = await supabase
      .from('weekly_report_public_v')
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
  
  try {
    // Latest published from table
    const { data: tableData } = await supabase
      .from('weekly_report_snapshots')
      .select(COLS)
      .eq('status', 'published')
      .order('built_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (tableData) {
      diagnostics.latestPublishedFromTable = {
        snapshot_id: tableData.snapshot_id,
        status: tableData.status,
        built_at: tableData.built_at,
        item_count: countTotalStories(tableData)
      };
    }
  } catch (e) {
    console.error('[weeklyRepo] Error fetching table data:', e);
  }
  
  return diagnostics;
}