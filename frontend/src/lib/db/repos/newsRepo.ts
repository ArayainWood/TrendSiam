/**
 * News Repository - Secure Data Access Layer
 * 
 * All public news data access goes through news_public_v view
 * Ensures no sensitive columns are exposed
 */

import { createClient } from '@supabase/supabase-js';
import { NewsPublicViewSchema, type NewsPublicView, type HomeNewsItem } from '../types/views';
import { z } from 'zod';

// Create public Supabase client (browser-safe)
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

// Transform view row to home item format
function transformToHomeItem(row: NewsPublicView, rank: number): HomeNewsItem {
  return {
    id: row.id,
    rank,
    title: row.title,
    summary: row.summary,
    summary_en: row.summary_en,
    category: row.category,
    platform: row.platform,
    video_id: row.video_id,
    channel: row.channel,
    description: row.description,
    popularity_score: row.popularity_score,
    popularity_score_precise: row.popularity_score_precise,
    published_at: row.published_at?.toISOString() || null,
    created_at: row.created_at.toISOString(),
    view_count: Number(row.view_count || 0),
    like_count: Number(row.like_count || 0),
    comment_count: Number(row.comment_count || 0),
    ai_image_url: row.ai_image_url,
    display_image_url: row.ai_image_url, // Only AI images
    keywords: row.keywords,
    score_details: row.score_details,
    analysis: row.analysis,
    view_details: row.view_details ? {
      views: String(row.view_details.views || row.view_count || 0),
      growth_rate: String(row.view_details.growth_rate || '0'),
      platform_mentions: String(row.view_details.platform_mentions || '0'),
      matched_keywords: String(row.view_details.matched_keywords || (Array.isArray(row.keywords) ? row.keywords.join(', ') : '')),
      ai_opinion: String(row.view_details.ai_opinion || row.analysis || ''),
      score: String(row.view_details.score || row.popularity_score_precise)
    } : {
      views: String(row.view_count || 0),
      growth_rate: '0',
      platform_mentions: '0',
      matched_keywords: Array.isArray(row.keywords) ? row.keywords.join(', ') : '',
      ai_opinion: row.analysis || '',
      score: String(row.popularity_score_precise)
    }
  };
}

/**
 * Fetch recent news for home page
 * Uses news_public_v view for secure access
 */
export async function fetchRecentNews(limit = 20): Promise<{
  items: HomeNewsItem[];
  totalCount: number;
  error?: string;
}> {
  const supabase = getPublicSupabase();
  
  try {
    // Get recent news from secure view
    const { data, error, count } = await supabase
      .from('news_public_v')
      .select('*', { count: 'exact' })
      .order('popularity_score_precise', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[newsRepo] Query error:', error);
      return { items: [], totalCount: 0, error: error.message };
    }
    
    if (!data || data.length === 0) {
      console.warn('[newsRepo] No news items found');
      return { items: [], totalCount: 0 };
    }
    
    // Validate and transform data
    const validatedItems: HomeNewsItem[] = [];
    let rank = 1;
    
    for (const row of data) {
      try {
        const validated = NewsPublicViewSchema.parse(row);
        validatedItems.push(transformToHomeItem(validated, rank++));
      } catch (err) {
        console.warn('[newsRepo] Validation error for row:', row.id, err);
        // Skip invalid rows
      }
    }
    
    return {
      items: validatedItems,
      totalCount: count || validatedItems.length
    };
    
  } catch (error) {
    console.error('[newsRepo] Unexpected error:', error);
    return {
      items: [],
      totalCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Fetch news by date range
 * Uses news_public_v view for secure access
 */
export async function fetchNewsByDateRange(
  startDate: Date,
  endDate: Date,
  limit = 100
): Promise<{
  items: HomeNewsItem[];
  totalCount: number;
  error?: string;
}> {
  const supabase = getPublicSupabase();
  
  try {
    const { data, error, count } = await supabase
      .from('news_public_v')
      .select('*', { count: 'exact' })
      .gte('published_date', startDate.toISOString())
      .lte('published_date', endDate.toISOString())
      .order('popularity_score_precise', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[newsRepo] Date range query error:', error);
      return { items: [], totalCount: 0, error: error.message };
    }
    
    // Validate and transform
    const validatedItems: HomeNewsItem[] = [];
    let rank = 1;
    
    for (const row of data || []) {
      try {
        const validated = NewsPublicViewSchema.parse(row);
        validatedItems.push(transformToHomeItem(validated, rank++));
      } catch (err) {
        console.warn('[newsRepo] Validation error:', err);
      }
    }
    
    return {
      items: validatedItems,
      totalCount: count || validatedItems.length
    };
    
  } catch (error) {
    console.error('[newsRepo] Unexpected error:', error);
    return {
      items: [],
      totalCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get single news item by ID
 * Uses news_public_v view for secure access
 */
export async function getNewsById(id: string): Promise<HomeNewsItem | null> {
  const supabase = getPublicSupabase();
  
  try {
    const { data, error } = await supabase
      .from('news_public_v')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      console.error('[newsRepo] Get by ID error:', error);
      return null;
    }
    
    // Validate and transform
    try {
      const validated = NewsPublicViewSchema.parse(data);
      return transformToHomeItem(validated, 1);
    } catch (err) {
      console.warn('[newsRepo] Validation error:', err);
      return null;
    }
    
  } catch (error) {
    console.error('[newsRepo] Unexpected error:', error);
    return null;
  }
}

/**
 * Count news items in date range
 * Useful for analytics and diagnostics
 */
export async function countNewsByDateRange(
  startDate: Date,
  endDate: Date
): Promise<number> {
  const supabase = getPublicSupabase();
  
  try {
    const { count, error } = await supabase
      .from('news_public_v')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    
    if (error) {
      console.error('[newsRepo] Count error:', error);
      return 0;
    }
    
    return count || 0;
    
  } catch (error) {
    console.error('[newsRepo] Unexpected error:', error);
    return 0;
  }
}

/**
 * Fetch news from v_home_news view for Home page
 * Returns raw data with display_image_url_raw for client-side normalization
 */
export async function fetchHomeNews(limit = 20): Promise<{
  items: any[];
  totalCount: number;
  error?: string;
}> {
  const supabase = getPublicSupabase();
  
  try {
    console.log('[newsRepo] Fetching from v_home_news view...');
    
    // Query the optimized Home view
    const { data, error, count } = await supabase
      .from('v_home_news')
      .select('id,title,summary,summary_en,category,platform,date,channel,published_date,video_id,view_count,like_count,comment_count,popularity_score,popularity_score_precise,growth_rate,ai_image_url,display_image_url_raw,is_ai_image,reason,keywords,ai_opinion', { count: 'exact' })
      .order('popularity_score_precise', { ascending: false })
      .order('published_date', { ascending: false, nullsFirst: false })
      .limit(limit);
    
    if (process.env.NEXT_PUBLIC_DEBUG_UI === '1') {
      // Non-blocking console logs only
      console.log('[diag] v_home_news rows:', data?.length, { error, sample: data?.slice(0, 2) });
    }
    
    if (error) {
      console.error('[newsRepo] v_home_news query error:', error);
      return { items: [], totalCount: 0, error: error.message };
    }
    
    if (!data || data.length === 0) {
      console.warn('[newsRepo] No items found in v_home_news');
      return { items: [], totalCount: 0 };
    }
    
    console.log(`[newsRepo] ✅ Fetched ${data.length} items from v_home_news`);
    
    return {
      items: data,
      totalCount: count || data.length
    };
    
  } catch (error) {
    console.error('[newsRepo] Error fetching from v_home_news:', error);
    return { 
      items: [], 
      totalCount: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
