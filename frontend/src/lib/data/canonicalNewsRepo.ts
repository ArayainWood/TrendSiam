/**
 * Canonical News Repository
 * 
 * Data access layer that returns properly typed and mapped news items
 * Uses the canonical mapping between DB (snake_case) and UI (camelCase)
 */

import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { DbNewsRow, UiNewsItem, mapDbToUi, applyLegacyCompat } from '@/lib/db/types/canonical';

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

export interface NewsRepoResult {
  items: UiNewsItem[];
  totalCount: number;
  error?: string;
}

/**
 * Fetch home news from v_home_news view
 * Returns fully mapped UiNewsItem array with legacy compatibility
 */
export async function fetchHomeNews(limit = 20): Promise<NewsRepoResult> {
  const supabase = getPublicSupabase();
  
  try {
    console.log('[canonicalNewsRepo] Fetching from v_home_news view...');
    
    // Query the optimized Home view
    const { data, error, count } = await supabase
      .from('v_home_news')
      .select('*', { count: 'exact' })
      .order('popularity_score_precise', { ascending: false })
      .order('published_date', { ascending: false, nullsFirst: false })
      .limit(limit);
    
    if (error) {
      console.error('[canonicalNewsRepo] Query error:', error);
      return { items: [], totalCount: 0, error: error.message };
    }
    
    if (!data || data.length === 0) {
      console.warn('[canonicalNewsRepo] No items found');
      return { items: [], totalCount: 0 };
    }
    
    // Map DB rows to UI items
    const uiItems = data.map((row, index) => {
      // Add rank based on order
      const dbRow: DbNewsRow = {
        ...row,
        rank: index + 1
      };
      return mapDbToUi(dbRow);
    });
    
    // Apply legacy compatibility
    const compatItems = applyLegacyCompat(uiItems);
    
    console.log(`[canonicalNewsRepo] ✅ Fetched and mapped ${compatItems.length} items`);
    
    // Log stats
    const withImages = compatItems.filter(item => item.hasRealImage);
    const aiImages = compatItems.filter(item => item.isAIImage);
    console.log(`[canonicalNewsRepo] Images: ${withImages.length}/${compatItems.length} real, ${aiImages.length} AI-generated`);
    
    return {
      items: compatItems,
      totalCount: count || compatItems.length
    };
    
  } catch (error) {
    console.error('[canonicalNewsRepo] Error:', error);
    return { 
      items: [], 
      totalCount: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Fetch news by date range
 */
export async function fetchNewsByDateRange(
  startDate: Date,
  endDate: Date,
  limit = 100
): Promise<NewsRepoResult> {
  const supabase = getPublicSupabase();
  
  try {
    const { data, error, count } = await supabase
      .from('v_home_news')
      .select('*', { count: 'exact' })
      .gte('published_date', startDate.toISOString())
      .lte('published_date', endDate.toISOString())
      .order('popularity_score_precise', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[canonicalNewsRepo] Date range query error:', error);
      return { items: [], totalCount: 0, error: error.message };
    }
    
    // Map and apply compatibility
    const uiItems = (data || []).map((row, index) => {
      const dbRow: DbNewsRow = { ...row, rank: index + 1 };
      return mapDbToUi(dbRow);
    });
    
    const compatItems = applyLegacyCompat(uiItems);
    
    return {
      items: compatItems,
      totalCount: count || compatItems.length
    };
    
  } catch (error) {
    console.error('[canonicalNewsRepo] Error:', error);
    return {
      items: [],
      totalCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get single news item by ID
 */
export async function getNewsById(id: string): Promise<UiNewsItem | null> {
  const supabase = getPublicSupabase();
  
  try {
    const { data, error } = await supabase
      .from('v_home_news')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      console.error('[canonicalNewsRepo] Get by ID error:', error);
      return null;
    }
    
    const dbRow: DbNewsRow = { ...data, rank: 1 };
    const uiItem = mapDbToUi(dbRow);
    const { legacyUiCompat } = await import('@/lib/db/types/canonical');
    return legacyUiCompat(uiItem);
    
  } catch (error) {
    console.error('[canonicalNewsRepo] Error:', error);
    return null;
  }
}

/**
 * Search news by text query
 */
export async function searchNews(query: string, limit = 20): Promise<NewsRepoResult> {
  const supabase = getPublicSupabase();
  
  try {
    const { data, error, count } = await supabase
      .from('v_home_news')
      .select('*', { count: 'exact' })
      .or(`title.ilike.%${query}%,summary.ilike.%${query}%,channel.ilike.%${query}%`)
      .order('popularity_score_precise', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[canonicalNewsRepo] Search error:', error);
      return { items: [], totalCount: 0, error: error.message };
    }
    
    const uiItems = (data || []).map((row, index) => {
      const dbRow: DbNewsRow = { ...row, rank: index + 1 };
      return mapDbToUi(dbRow);
    });
    
    const compatItems = applyLegacyCompat(uiItems);
    
    return {
      items: compatItems,
      totalCount: count || compatItems.length
    };
    
  } catch (error) {
    console.error('[canonicalNewsRepo] Error:', error);
    return {
      items: [],
      totalCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Re-export the legacy compatibility function for use in other modules
export { legacyUiCompat } from '@/lib/db/types/canonical';
