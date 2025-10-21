/**
 * Runtime-agnostic Snapshot Builder Core
 * 
 * This module contains all snapshot building logic without any Next.js-specific imports.
 * Can be used from both Next.js server components and Node.js CLI scripts.
 */

import { createClient } from '@supabase/supabase-js';
import type { SnapshotItem } from '@/types/snapshots';
import { getEnv } from '@/server/getEnv';

// Interface exports (duplicated to avoid circular deps)
export interface SnapshotMeta {
  sources: Record<string, number>;
  totalItems: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  buildDuration: number;
  notes?: string[];
}

export interface BuildSnapshotResult {
  success: boolean;
  snapshotId?: string;
  error?: string;
  meta?: SnapshotMeta;
}

// Initialize Supabase client for CLI usage
function getSupabaseClient() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getEnv();
  
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  });
}

// Date utilities with proper fallbacks
function parseDate(value: any, fallback: Date): Date {
  if (!value) return fallback;
  
  try {
    if (value instanceof Date) return value;
    
    if (typeof value === 'string') {
      const parsed = new Date(value);
      // Check for invalid date (including epoch time)
      if (isNaN(parsed.getTime()) || parsed.getFullYear() < 2020) {
        return fallback;
      }
      return parsed;
    }
    
    if (typeof value === 'number') {
      // Handle Unix timestamps
      const parsed = new Date(value < 1e12 ? value * 1000 : value);
      if (isNaN(parsed.getTime()) || parsed.getFullYear() < 2020) {
        return fallback;
      }
      return parsed;
    }
  } catch (e) {
    console.warn('[snapshotBuilder] Date parse error:', e);
  }
  
  return fallback;
}

// Get date 7 days ago
function getSevenDaysAgo(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date;
}

/**
 * Build a new weekly snapshot
 * 
 * @param dryRun - If true, only simulate the build without saving
 * @param shouldPublish - If true, publish the snapshot immediately; otherwise keep as draft
 * @returns Result with snapshot ID if successful
 */
export async function buildWeeklySnapshot(dryRun = false, shouldPublish = true): Promise<BuildSnapshotResult> {
  const startTime = Date.now();
  const supabase = getSupabaseClient();
  
  try {
    console.log('[snapshotBuilder] Starting snapshot build...', { dryRun });
    
    // 1. Calculate date range
    const rangeEnd = new Date();
    const rangeStart = getSevenDaysAgo();
    
    // 2. Check for concurrent builds (advisory lock via unique constraint)
    if (!dryRun) {
      const { data: existing } = await supabase
        .from('weekly_report_snapshots')
        .select('snapshot_id, status')
        .eq('status', 'building')
        .single();
      
      if (existing) {
        console.log('[snapshotBuilder] Another build in progress:', existing.snapshot_id);
        return {
          success: false,
          error: 'Another snapshot build is already in progress'
        };
      }
    }
    
    // 3. Query items from last 7 days (by ingested_at/created_at)
    console.log('[snapshotBuilder] Querying items from:', rangeStart.toISOString());
    
    const { data: items, error: queryError } = await supabase
      .from('news_trends')
      .select(`
        id, title, summary, summary_en, platform, 
        popularity_score, popularity_score_precise,
        date, category, ai_image_url, ai_image_prompt, 
        video_id, channel, view_count, published_date, 
        description, duration, like_count, comment_count, 
        reason, keywords, score_details, created_at, updated_at
      `)
      .gte('created_at', rangeStart.toISOString())
      .lte('created_at', rangeEnd.toISOString())
      .order('popularity_score_precise', { ascending: false })
      .order('published_date', { ascending: false })
      .order('id', { ascending: true }); // Stable tiebreaker
    
    if (queryError) {
      throw new Error(`Query failed: ${queryError.message}`);
    }
    
    if (!items || items.length === 0) {
      console.warn('[snapshotBuilder] No items found for date range');
      return {
        success: false,
        error: 'No items found in the specified date range'
      };
    }
    
    console.log('[snapshotBuilder] Found items:', items.length);
    
    // 4. Transform and rank items
    const snapshotItems: SnapshotItem[] = items.map((item, index) => {
      const now = new Date();
      
      // Parse dates with fallbacks
      const publishedAt = parseDate(item.published_date, parseDate(item.created_at, now));
      const createdAt = parseDate(item.created_at, now);
      const ingestedAt = createdAt; // Use created_at as ingestion time
      
      // Parse keywords
      let keywords: string[] = [];
      if (item.keywords) {
        try {
          keywords = typeof item.keywords === 'string' 
            ? JSON.parse(item.keywords) 
            : Array.isArray(item.keywords) ? item.keywords : [];
        } catch (e) {
          keywords = [];
        }
      }
      
      return {
        id: item.id,
        rank: index + 1,
        title: item.title || '',
        summary: item.summary || '',
        summary_en: item.summary_en || '',
        category: item.category || 'Uncategorized',
        platform: item.platform || 'YouTube',
        video_id: item.video_id || '',
        channel: item.channel || '',
        description: item.description || '',
        popularity_score: Math.round(item.popularity_score_precise || item.popularity_score || 0),
        popularity_score_precise: item.popularity_score_precise || item.popularity_score || 0,
        published_at: publishedAt.toISOString(),
        created_at: createdAt.toISOString(),
        ingested_at: ingestedAt.toISOString(),
        view_count: String(item.view_count || '0'),
        like_count: String(item.like_count || '0'),
        comment_count: String(item.comment_count || '0'),
        ai_image_url: item.ai_image_url || null,
        ai_image_prompt: item.ai_image_prompt || null,
        keywords,
        score_details: item.score_details || {}
      } as SnapshotItem;
    });
    
    // 5. Calculate metadata
    const scores = snapshotItems.map(item => {
      const score = item.popularity_score_precise;
      return typeof score === 'string' ? parseFloat(score) : (score || 0);
    });
    const avgScore = scores.reduce((sum: number, score) => sum + score, 0) / scores.length;
    
    const sources = snapshotItems.reduce((acc: Record<string, number>, item) => {
      acc[item.platform] = (acc[item.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const meta: SnapshotMeta = {
      sources,
      totalItems: snapshotItems.length,
      avgScore: Math.round(avgScore * 100) / 100,
      minScore: scores.length > 0 ? Math.min(...scores) : 0,
      maxScore: scores.length > 0 ? Math.max(...scores) : 0,
      buildDuration: Date.now() - startTime,
      notes: [`Built from ${rangeStart.toISOString()} to ${rangeEnd.toISOString()}`]
    };
    
    // 6. Safety check: minimum items threshold
    const MIN_ITEMS_THRESHOLD = 5;
    if (snapshotItems.length < MIN_ITEMS_THRESHOLD) {
      console.warn('[snapshotBuilder] Below minimum threshold:', {
        found: snapshotItems.length,
        required: MIN_ITEMS_THRESHOLD
      });
      return {
        success: false,
        error: `Insufficient items (${snapshotItems.length} < ${MIN_ITEMS_THRESHOLD})`,
        meta
      };
    }
    
    if (dryRun) {
      console.log('[snapshotBuilder] Dry run complete:', meta);
      return {
        success: true,
        snapshotId: 'dry-run',
        meta
      };
    }
    
    // 7. Create snapshot record
    const { data: snapshot, error: insertError } = await supabase
      .from('weekly_report_snapshots')
      .insert({
        status: 'building',
        range_start: rangeStart.toISOString(),
        range_end: rangeEnd.toISOString(),
        algo_version: 'v1',
        data_version: 'v1',
        items: snapshotItems,
        meta
      })
      .select('snapshot_id')
      .single();
    
    if (insertError || !snapshot) {
      throw new Error(`Failed to create snapshot: ${insertError?.message}`);
    }
    
    // 8. Publish snapshot (atomic update) or mark as draft
    if (shouldPublish) {
      const { error: publishError } = await supabase
        .from('weekly_report_snapshots')
        .update({
          status: 'published',
          built_at: new Date().toISOString()
        })
        .eq('snapshot_id', snapshot.snapshot_id)
        .eq('status', 'building'); // Ensure we only publish if still building
      
      if (publishError) {
        // Try to clean up the failed snapshot
        await supabase
          .from('weekly_report_snapshots')
          .delete()
          .eq('snapshot_id', snapshot.snapshot_id);
        
        throw new Error(`Failed to publish snapshot: ${publishError.message}`);
      }
      
      console.log('[snapshotBuilder] Snapshot published:', {
        snapshotId: snapshot.snapshot_id,
        items: snapshotItems.length,
        duration: Date.now() - startTime
      });
    } else {
      // Mark as draft instead of published
      const { error: draftError } = await supabase
        .from('weekly_report_snapshots')
        .update({
          status: 'draft',
          built_at: new Date().toISOString()
        })
        .eq('snapshot_id', snapshot.snapshot_id)
        .eq('status', 'building');
      
      if (draftError) {
        // Try to clean up the failed snapshot
        await supabase
          .from('weekly_report_snapshots')
          .delete()
          .eq('snapshot_id', snapshot.snapshot_id);
        
        throw new Error(`Failed to mark snapshot as draft: ${draftError.message}`);
      }
      
      console.log('[snapshotBuilder] Snapshot saved as draft:', {
        snapshotId: snapshot.snapshot_id,
        items: snapshotItems.length,
        duration: Date.now() - startTime
      });
    }
    
    // 9. Prune old snapshots (keep 28 days)
    const pruneDate = new Date();
    pruneDate.setDate(pruneDate.getDate() - 28);
    
    const { error: pruneError } = await supabase
      .from('weekly_report_snapshots')
      .delete()
      .lt('built_at', pruneDate.toISOString());
    
    if (pruneError) {
      console.warn('[snapshotBuilder] Prune failed:', pruneError.message);
    }
    
    return {
      success: true,
      snapshotId: snapshot.snapshot_id,
      meta
    };
    
  } catch (error) {
    console.error('[snapshotBuilder] Build failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get the latest published snapshot
 */
export async function getLatestSnapshot() {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('weekly_report_snapshots')
    .select('*')
    .eq('status', 'published')
    .order('built_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error || !data) {
    console.error('[snapshotBuilder] Failed to get latest snapshot:', error);
    return null;
  }
  
  return data;
}

/**
 * Get a specific snapshot by ID
 */
export async function getSnapshotById(snapshotId: string) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('weekly_report_snapshots')
    .select('*')
    .eq('snapshot_id', snapshotId)
    .eq('status', 'published')
    .single();
  
  if (error || !data) {
    console.error('[snapshotBuilder] Failed to get snapshot:', error);
    return null;
  }
  
  return data;
}
