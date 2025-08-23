/**
 * Home-specific data fetcher - Secure Version
 * 
 * Uses news_public_v view via repository pattern
 * Maintains exact same behavior as original but with secure data access
 */

import 'server-only';
import { fetchHomeNews as fetchCanonicalHomeNews } from './canonicalNewsRepo';
import type { UiNewsItem } from '@/lib/db/types/canonical';

export interface HomeApiResponse {
  items: any[];
  metrics?: any;
  generatedAt: string;
  source: string;
  success: boolean;
  error?: string;
  diagnostics?: {
    date: string;
    timezone: string;
    rowCount: number;
    ordering: string;
    top5: Array<{
      id: string;
      title: string;
      popularity_score_precise: number;
      view_count: number;
      published_at: string;
    }>;
  };
}

// Get today's date in Asia/Bangkok timezone
function getTodayBangkok(): string {
  const now = new Date();
  // Create date in Bangkok timezone
  const bangkokTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  
  // Convert MM/DD/YYYY to YYYY-MM-DD format
  const [month, day, year] = bangkokTime.split('/');
  return `${year}-${month?.padStart(2, '0')}-${day?.padStart(2, '0')}`;
}

// Get date range for recent stories
function getRecentDateRange(hoursAgo: number = 24): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getTime() - (hoursAgo * 60 * 60 * 1000));
  
  return { start, end: now };
}

/**
 * Fetch recent news for Home page using secure view
 */
export async function fetchHomeData(limit = 20, diagnostics = false): Promise<HomeApiResponse> {
  if (typeof window !== 'undefined') {
    throw new Error('fetchHomeData must only run on server');
  }
  
  const t0 = Date.now();
  const todayBangkok = getTodayBangkok();
  
  try {
    console.log(`[fetchHomeData] 🔍 Fetching via canonical repository, limit=${limit}`);

    // Use the canonical news repository
    const result = await fetchCanonicalHomeNews(limit);

    if (result.error) {
      throw new Error(`Query failed: ${result.error}`);
    }

    const items = result.items;
    console.log(`[fetchHomeData] ✅ Fetched ${items.length} items via canonical repo`);

    // Dev-only console check
    if (process.env.NODE_ENV === 'development') {
      console.debug({
        stories: items.length,
        aiImages: items.filter(i => i.isAIImage).length,
        withImages: items.filter(i => i.hasRealImage).length,
        placeholderImages: items.filter(i => !i.hasRealImage).length,
      });
    }

    if (!items || items.length === 0) {
      console.log(`[fetchHomeData] ⚠️ No data found in any time range`);
      return {
        items: [],
        metrics: { 
          elapsed: Date.now() - t0, 
          totalRows: 0,
          date: todayBangkok,
          timezone: 'Asia/Bangkok',
          windowChecked: 'today -> 24h -> 7days'
        },
        generatedAt: new Date().toISOString(),
        source: 'supabase-secure',
        success: true,
        error: 'No data available'
      };
    }

    console.log(`[fetchHomeData] ✅ Fetched ${items.length} items`);

    // Generate diagnostics if requested
    let diagnosticsData = undefined;
    if (diagnostics) {
      diagnosticsData = {
        date: todayBangkok,
        timezone: 'Asia/Bangkok',
        rowCount: items.length,
        ordering: 'popularity_score_precise DESC, created_at DESC',
        top5: items.slice(0, 5).map(item => ({
          id: item.id,
          title: item.title,
          popularity_score_precise: item.popularityScorePrecise,
          view_count: item.views,
          published_at: item.publishedAt || 'N/A'
        }))
      };
    }

    // Metrics for the response
    const metrics = {
      totalRows: items.length,
      elapsed: Date.now() - t0,
      date: todayBangkok,
      timezone: 'Asia/Bangkok',
      avgScore: items.length > 0 
        ? items.reduce((sum, item) => sum + item.popularityScorePrecise, 0) / items.length 
        : 0,
      imagesCoverage: 100, // All items now have displayImageUrl after mapping
      placeholderImages: items.length > 0
        ? Math.round((items.filter(item => !item.hasRealImage).length / items.length) * 100)
        : 0,
      summariesCoverage: 100, // All items have summaries from view
      source: 'v_home_news'
    };

    return {
      items: items as any[], // Cast to any[] for backward compatibility
      metrics,
      generatedAt: new Date().toISOString(),
      source: 'supabase-secure',
      success: true,
      diagnostics: diagnosticsData
    };
    
  } catch (error) {
    console.error('[fetchHomeData] Error:', error);
    
    return {
      items: [],
      metrics: { 
        elapsed: Date.now() - t0,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      generatedAt: new Date().toISOString(),
      source: 'supabase-secure',
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch home data'
    };
  }
}
