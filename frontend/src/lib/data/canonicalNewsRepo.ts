/**
 * Canonical News Repository - Plan-B Security Compliant
 * 
 * Data access layer that uses public views only (no base table access)
 * All queries use anon key and public_v_* views for Plan-B security
 */

import 'server-only';
import { fetchHomeFeed, fetchNewsById, searchNewsApi, type HomeNewsItem } from './news';
import { DbNewsRow, UiNewsItem, mapDbToUi, applyLegacyCompat } from '@/lib/db/types/canonical';

/**
 * Convert HomeNewsItem to UiNewsItem format
 * Bridges the gap between the secure data layer and existing UI expectations
 */
function convertToUiNewsItem(item: HomeNewsItem, rank: number): UiNewsItem {
  // Convert to DbNewsRow format first, then use existing mapping
  const dbRow: DbNewsRow = {
    id: item.id,
    external_id: item.external_id,
    video_id: item.video_id,
    title: item.title,
    summary: item.summary,
    summary_en: item.summary_en,
    description: item.description,
    category: item.category,
    platform: item.platform,
    channel: item.channel,
    date: item.date,
    published_date: item.published_date,
    created_at: item.created_at,
    updated_at: item.updated_at,
    summary_date: item.summary_date,
    view_count: item.view_count,
    like_count: item.like_count,
    comment_count: item.comment_count,
    duration: item.duration,
    raw_view: item.raw_view,
    popularity_score: item.popularity_score,
    popularity_score_precise: item.popularity_score_precise,
    ai_image_url: item.ai_image_url,
    ai_image_prompt: item.ai_image_prompt,
    reason: item.reason,
    growth_rate: item.growth_rate,
    platform_mentions: item.platform_mentions,
    keywords: item.keywords,
    ai_opinion: item.ai_opinion,
    score_details: item.score_details,
    platforms_raw: item.platforms_raw,
    rank,
    image_url: item.image_url,
    display_image_url_raw: item.display_image_url_raw,
    is_ai_image: item.is_ai_image,
  };
  
  return mapDbToUi(dbRow);
}

export interface NewsRepoResult {
  items: UiNewsItem[];
  totalCount: number;
  error?: string;
}

/**
 * Fetch home news using Plan-B secure data layer
 * Returns fully mapped UiNewsItem array with legacy compatibility
 */
export async function fetchHomeNews(limit = 20): Promise<NewsRepoResult> {
  try {
    console.log('[canonicalNewsRepo] Fetching via Plan-B secure data layer...');
    
    // Use the secure data layer (public views only)
    const result = await fetchHomeFeed(limit);
    
    if (!result.data || result.data.length === 0) {
      console.warn('[canonicalNewsRepo] No items found');
      return { items: [], totalCount: 0 };
    }
    
    // Convert HomeNewsItem to UiNewsItem format
    const uiItems = result.data.map((item: HomeNewsItem, index: number) => convertToUiNewsItem(item, index + 1));
    
    // Apply legacy compatibility
    const compatItems = applyLegacyCompat(uiItems);
    
    console.log(`[canonicalNewsRepo] ✅ Fetched and mapped ${compatItems.length} items via Plan-B`);
    
    // Log stats
    const withImages = compatItems.filter(item => item.hasRealImage);
    const aiImages = compatItems.filter(item => item.isAIImage);
    console.log(`[canonicalNewsRepo] Images: ${withImages.length}/${compatItems.length} real, ${aiImages.length} AI-generated`);
    
    return {
      items: compatItems,
      totalCount: compatItems.length
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
 * Fetch news by date range using Plan-B secure data layer
 */
export async function fetchNewsByDateRange(
  startDate: Date,
  endDate: Date,
  limit = 100
): Promise<NewsRepoResult> {
  try {
    // Use the secure data layer with date filtering
    const result = await fetchHomeFeed(limit);
    
    if (!result.data) {
      return { items: [], totalCount: 0 };
    }
    
    // Filter by date range (client-side filtering since view doesn't support date range params yet)
    const filteredData = result.data.filter((item: HomeNewsItem) => {
      const publishedDate = item.published_date ? new Date(item.published_date) : null;
      const createdDate = new Date(item.created_at);
      const itemDate = publishedDate || createdDate;
      
      return itemDate >= startDate && itemDate <= endDate;
    });
    
    // Convert to UiNewsItem format
    const uiItems = filteredData.map((item: HomeNewsItem, index: number) => convertToUiNewsItem(item, index + 1));
    const compatItems = applyLegacyCompat(uiItems);
    
    console.log(`[canonicalNewsRepo] ✅ Fetched ${compatItems.length} items in date range via Plan-B`);
    
    return {
      items: compatItems,
      totalCount: filteredData.length
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
 * Get single news item by ID using Plan-B secure data layer
 */
export async function getNewsById(id: string): Promise<UiNewsItem | null> {
  try {
    const result = await fetchNewsById(id);
    
    if (!result.data) {
      console.warn('[canonicalNewsRepo] News item not found:', id);
      return null;
    }
    
    // Convert to UiNewsItem format
    const uiItem = convertToUiNewsItem(result.data, 1);
    const { legacyUiCompat } = await import('@/lib/db/types/canonical');
    return legacyUiCompat(uiItem);
    
  } catch (error) {
    console.error('[canonicalNewsRepo] Error:', error);
    return null;
  }
}

/**
 * Search news by text query using Plan-B secure data layer
 */
export async function searchNews(query: string, limit = 20): Promise<NewsRepoResult> {
  try {
    // Use the secure search function (already imported as searchNewsApi)
    const result = await searchNewsApi(query, limit);
    
    if (!result.data) {
      return { items: [], totalCount: 0 };
    }
    
    // Convert to UiNewsItem format
    const uiItems = result.data.map((item: HomeNewsItem, index: number) => convertToUiNewsItem(item, index + 1));
    const compatItems = applyLegacyCompat(uiItems);
    
    console.log(`[canonicalNewsRepo] ✅ Found ${compatItems.length} items for query "${query}" via Plan-B`);
    
    return {
      items: compatItems,
      totalCount: compatItems.length
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
