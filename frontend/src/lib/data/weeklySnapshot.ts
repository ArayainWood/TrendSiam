/**
 * Weekly Snapshot Data Fetcher
 * 
 * Fetches weekly data from stable snapshots instead of live queries
 */

import { SnapshotItem } from '@/types/snapshots';
import { formatDisplayDate } from '@/utils/dateFormatting';
import { 
  fetchLatestWeekly, 
  countTotalStories 
} from '@/lib/weekly/weeklyRepo';
import { createClient } from '@supabase/supabase-js';
import { logProjectRef } from '@/utils/envProjectRef';

export interface WeeklySnapshotData {
  snapshotId: string;
  builtAt: string;
  rangeStart: string;
  rangeEnd: string;
  items: SnapshotItem[];
  metrics: {
    totalStories: number;
    avgScore: number;
    categoryDistribution: Record<string, number>;
    imagesCoverage: number;
    summariesCoverage: number;
    timeRange: string;
  };
  source: 'snapshot';
  success: boolean;
  error?: string;
}

// Date formatting is now imported from shared utils

/**
 * Fetch the latest weekly snapshot
 * 
 * @param snapshotId - Optional specific snapshot ID to fetch
 * @returns Weekly snapshot data formatted for UI consumption
 */
export async function fetchWeeklySnapshot(snapshotId?: string): Promise<WeeklySnapshotData> {
  // Log project ref for debugging (server-side only)
  if (typeof window === 'undefined') {
    logProjectRef('weeklySnapshot');
  }
  
  try {
    let snapshot;
    
    if (snapshotId) {
      // Fetch specific snapshot by ID using public client
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!url || !anonKey) {
        throw new Error('Missing Supabase environment variables');
      }
      
      const supabase = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      
      // Use the correct public view (Plan-B compliant)
      const { data, error } = await supabase
        .from('public_v_weekly_snapshots')
        .select('*')
        .eq('snapshot_id', snapshotId)
        .single();
      
      if (error || !data) {
        throw new Error(error?.message || `Snapshot ${snapshotId} not found`);
      }
      
      // Extract and validate items
      const items = (data.items as SnapshotItem[]) || [];
      snapshot = { ...data, items };
    } else {
      // Use the repository to fetch latest
      snapshot = await fetchLatestWeekly();
      
      if (!snapshot) {
        // Log additional context for debugging
        console.error('[fetchWeeklySnapshot] No snapshots available. Check /api/weekly/diagnostics for details.');
        throw new Error('No snapshots available');
      }
    }
    
    // Use centralized counting function
    const totalStories = countTotalStories(snapshot);
    
    // Calculate average score
    const avgScore = totalStories > 0
      ? snapshot.items.reduce((sum: number, item: any) => {
          const score = item.popularity_score_precise;
          const numScore = typeof score === 'string' ? parseFloat(score) : (score || 0);
          return sum + (isNaN(numScore) ? 0 : numScore);
        }, 0) / totalStories
      : 0;
    
    // Category distribution
    const categoryDistribution: Record<string, number> = {};
    snapshot.items.forEach((item: any) => {
      const category = item.category || 'Uncategorized';
      categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;
    });
    
    // Calculate coverage metrics
    const imagesCoverage = totalStories > 0
      ? Math.round((snapshot.items.filter((item: any) => item.ai_image_url).length / totalStories) * 100)
      : 0;
    
    const summariesCoverage = totalStories > 0
      ? Math.round((snapshot.items.filter((item: any) => item.summary).length / totalStories) * 100)
      : 0;
    
    // Format time range
    const timeRange = `${formatDisplayDate(snapshot.range_start, null)} - ${formatDisplayDate(snapshot.range_end, null)}`;
    
    return {
      snapshotId: snapshot.snapshot_id,
      builtAt: snapshot.built_at || snapshot.created_at,
      rangeStart: snapshot.range_start,
      rangeEnd: snapshot.range_end,
      items: snapshot.items,
      metrics: {
        totalStories,
        avgScore: Math.round(avgScore * 10) / 10,
        categoryDistribution,
        imagesCoverage,
        summariesCoverage,
        timeRange
      },
      source: 'snapshot',
      success: true
    };
    
  } catch (error) {
    console.error('[fetchWeeklySnapshot] Error:', error);
    
    return {
      snapshotId: '',
      builtAt: new Date().toISOString(),
      rangeStart: new Date().toISOString(),
      rangeEnd: new Date().toISOString(),
      items: [],
      metrics: {
        totalStories: 0,
        avgScore: 0,
        categoryDistribution: {},
        imagesCoverage: 0,
        summariesCoverage: 0,
        timeRange: 'No data available'
      },
      source: 'snapshot',
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch snapshot'
    };
  }
}

/**
 * Check if a newer snapshot is available
 * 
 * @param currentSnapshotId - ID of the currently displayed snapshot
 * @returns True if a newer snapshot exists
 */
export async function hasNewerSnapshot(currentSnapshotId: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    return false;
  }
  
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  
  try {
    // Get the current snapshot's built_at time (use public view)
    const { data: current } = await supabase
      .from('public_v_weekly_snapshots')
      .select('built_at')
      .eq('snapshot_id', currentSnapshotId)
      .single();
    
    if (!current) return false;
    
    // Check if any newer snapshots exist
    const { count } = await supabase
      .from('public_v_weekly_snapshots')
      .select('*', { count: 'exact', head: true })
      .gt('built_at', current.built_at);
    
    return (count || 0) > 0;
    
  } catch (error) {
    console.error('[hasNewerSnapshot] Error:', error);
    return false;
  }
}
