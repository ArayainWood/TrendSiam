/**
 * Weekly Report Data Fetcher
 * 
 * Fetches last 7 days of stories from Supabase with JSON fallback.
 * Maintains existing UI data format while using real database.
 */

// V2 weekly data fetcher — server-only  
import 'server-only';
import { getSupabaseAdmin } from './supabaseAdmin';

// Types for weekly data
export interface WeeklyStory {
  story_id: string;
  rank: number;
  title: string;
  summary: string;
  summary_en?: string;
  category: string;
  platform: string;
  video_id: string;
  popularity_score: number;
  popularity_score_precise: number;
  published_date: string;
  description: string;
  channel: string;
  view_count: string;
  like_count?: string;
  comment_count?: string;
  ai_image_url?: string;
  image_status?: string;
  image_updated_at?: string;
  ai_image_prompt?: string;
  summary_status?: string;
}

export interface WeeklyMetrics {
  totalStories: number;
  avgScore: number;
  categoryDistribution: Record<string, number>;
  imagesCoverage: number;
  summariesCoverage: number;
  timeRange: string;
}

export interface WeeklyData {
  items: WeeklyStory[];
  metrics: WeeklyMetrics;
  generatedAt: string;
  dataVersion: string;
  source: 'db' | 'json';
}

// Simple in-memory cache (60 seconds)
let cache: { data: WeeklyData; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000; // 60 seconds

/**
 * Check if Supabase is enabled and ready
 */
function isSupabaseEnabled(): boolean {
  const enabled = process.env.SUPABASE_ENABLED;
  if (!enabled || enabled.toLowerCase() !== 'true') {
    return false;
  }

  // Validate required environment variables
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  return !!(url && key);
}

/**
 * Fetch weekly data from Supabase with timeout
 */
async function fetchFromSupabase(days: number = 7): Promise<WeeklyData> {
  if (!isSupabaseEnabled()) {
    console.log('[weekly/data] Supabase disabled via SUPABASE_ENABLED');
    throw new Error('Supabase disabled');
  }

  const supabase = getSupabaseAdmin();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromDateStr = fromDate.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  console.log(`[weekly/data] Querying Supabase for last ${days} days (from ${fromDateStr})`);
  
  // Query snapshots with stories, last N days
  const { data: snapshots, error } = await Promise.race([
    supabase
      .from('snapshots')
      .select(`
        *,
        stories!inner(*)
      `)
      .gte('snapshot_date', fromDateStr)
      .order('snapshot_date', { ascending: false })
      .order('popularity_score_precise', { ascending: false })
      .limit(200), // Get more for deduplication
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Supabase query timeout after 10s')), 10000)
    )
  ]) as { data: any[] | null; error: any };

  console.log(`[weekly/data] Supabase query result:`, {
    error: error?.message,
    snapshotCount: snapshots?.length || 0,
    dateRange: fromDateStr
  });

  if (error) {
    throw new Error(`Supabase query error: ${error.message}`);
  }

  if (!snapshots?.length) {
    throw new Error(`No snapshots found for date range >= ${fromDateStr}`);
  }

  // weekly fix: Pick latest snapshot per story (deduplicate by story_id)
  const seenStories = new Set<string>();
  const uniqueSnapshots = snapshots.filter(snapshot => {
    const storyId = snapshot.stories?.story_id;
    if (!storyId || seenStories.has(storyId)) return false;
    seenStories.add(storyId);
    return true;
  }).slice(0, 50); // Limit to top 50 after deduplication

  // Transform Supabase data to match existing format
  const items: WeeklyStory[] = uniqueSnapshots.map((snapshot, index) => {
    const story = snapshot.stories;
    return {
      story_id: story.story_id,
      rank: index + 1,
      title: story.title || '',
      summary: story.summary || '',
      summary_en: story.summary_en || '',
      category: snapshot.category || story.category || 'Unknown',
      platform: story.platform || 'YouTube',
      video_id: story.source_id || '',
      popularity_score: Math.round(snapshot.popularity_score_precise || snapshot.popularity_score || 0),
      popularity_score_precise: snapshot.popularity_score_precise || snapshot.popularity_score || 0,
      published_date: story.publish_time || story.created_at,
      description: story.description || '',
      channel: story.channel || '',
      view_count: story.view_count?.toString() || '0',
      like_count: story.like_count?.toString() || '0',
      comment_count: story.comment_count?.toString() || '0',
      ai_image_url: story.latest_image_url || snapshot.ai_image_url,
      image_status: story.latest_image_status || 'n/a',
      image_updated_at: story.latest_image_updated_at,
      ai_image_prompt: snapshot.ai_image_prompt || story.ai_image_prompt,
      summary_status: 'ready'
    };
  });

  // Calculate metrics
  const metrics = calculateMetrics(items);
  
  // weekly fix: structured console logs
  console.log(`📊 Weekly data fetched from Supabase: ${items.length} stories, ${metrics.imagesCoverage}% images, ${metrics.summariesCoverage}% summaries`);
  console.log(`[weekly/data] ✅ Supabase fetch successful at ${new Date().toISOString()}`);

  return {
    items,
    metrics,
    generatedAt: new Date().toISOString(),
    dataVersion: new Date().toISOString(),
    source: 'db'
  };
}

/**
 * Fallback to JSON file
 */
async function fetchFromJSON(): Promise<WeeklyData> {
  const fs = await import('fs');
  const path = await import('path');
  
  const jsonPath = path.join(process.cwd(), 'public/data/thailand_trending_summary.json');
  
  if (!fs.existsSync(jsonPath)) {
    throw new Error('JSON fallback file not found');
  }

  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const items = Array.isArray(jsonData) ? jsonData : jsonData.trending_stories || jsonData.items || [];
  
  // Filter last 7 days by published_date
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const filteredItems = items
    .filter((item: any) => {
      const publishedDate = new Date(item.published_date);
      return publishedDate >= sevenDaysAgo;
    })
    .map((item: any, index: number) => ({
      ...item,
      rank: index + 1,
      story_id: item.story_id || `json_${item.video_id}_${index}`,
      summary_status: item.summary ? 'ready' : 'pending'
    }))
    .slice(0, 50); // Limit to 50 items

  const metrics = calculateMetrics(filteredItems);
  
  // weekly fix: structured console logs
  console.log(`📊 Weekly data fetched from JSON fallback: ${filteredItems.length} stories, ${metrics.imagesCoverage}% images, ${metrics.summariesCoverage}% summaries`);
  console.log(`[weekly/data] ⚠️ Using JSON fallback at ${new Date().toISOString()}`);

  return {
    items: filteredItems,
    metrics,
    generatedAt: new Date().toISOString(),
    dataVersion: jsonData.data_version || new Date().toISOString(),
    source: 'json'
  };
}

/**
 * Calculate weekly metrics
 */
function calculateMetrics(items: WeeklyStory[]): WeeklyMetrics {
  const totalStories = items.length;
  const avgScore = totalStories > 0 
    ? items.reduce((sum, item) => sum + (item.popularity_score_precise || 0), 0) / totalStories 
    : 0;

  // Category distribution
  const categoryDistribution: Record<string, number> = {};
  items.forEach(item => {
    const category = item.category || 'Unknown';
    categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;
  });

  // Coverage metrics
  const itemsWithImages = items.filter(item => 
    item.ai_image_url && item.image_status === 'ready'
  ).length;
  const itemsWithSummaries = items.filter(item => 
    item.summary && item.summary_status === 'ready'
  ).length;

  const imagesCoverage = totalStories > 0 ? Math.round((itemsWithImages / totalStories) * 100) : 0;
  const summariesCoverage = totalStories > 0 ? Math.round((itemsWithSummaries / totalStories) * 100) : 0;

  return {
    totalStories,
    avgScore: Math.round(avgScore * 10) / 10,
    categoryDistribution,
    imagesCoverage,
    summariesCoverage,
    timeRange: 'Last 7 days'
  };
}

/**
 * Main function to get weekly data with caching
 */
export async function getWeeklyData(): Promise<WeeklyData> {
  // Check cache first
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }

  let data: WeeklyData;

  try {
    // Try Supabase first (only fallback on real network/DB errors)
    data = await fetchFromSupabase();
    console.log(`[weekly/data] ✅ Successfully fetched from Supabase: ${data.items.length} stories, ${data.metrics.imagesCoverage}% images, ${data.metrics.summariesCoverage}% summaries`);
  } catch (supabaseError: any) {
    console.warn(`[weekly/data] ⚠️ Supabase fetch failed, falling back to JSON:`, {
      error: supabaseError?.message || String(supabaseError),
      enabled: process.env.SUPABASE_ENABLED,
      hasUrl: !!process.env.SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    });
    
    try {
      // Fallback to JSON only when DB is truly unreachable
      data = await fetchFromJSON();
      console.log(`[weekly/data] ✅ Successfully fetched from JSON fallback: ${data.items.length} stories, ${data.metrics.imagesCoverage}% images, ${data.metrics.summariesCoverage}% summaries`);
    } catch (jsonError) {
      console.error('[weekly/data] ❌ Both Supabase and JSON fallback failed:', jsonError);
      
      // Return empty state as last resort
      data = {
        items: [],
        metrics: {
          totalStories: 0,
          avgScore: 0,
          categoryDistribution: {},
          imagesCoverage: 0,
          summariesCoverage: 0,
          timeRange: 'Last 7 days'
        },
        generatedAt: new Date().toISOString(),
        dataVersion: new Date().toISOString(),
        source: 'json'
      };
      console.log('[weekly/data] ⚠️ Returning empty state as last resort');
    }
  }

  // Update cache
  cache = {
    data,
    timestamp: Date.now()
  };

  return data;
}
