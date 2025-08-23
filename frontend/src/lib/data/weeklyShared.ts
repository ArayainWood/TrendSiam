/**
 * Canonical weekly data fetcher - DB-first with JSON fallback
 * 
 * Provides consistent data logic for both Home and Weekly Report pages
 * Uses Supabase VIEW with proper filtering, sorting, and limiting
 */

import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'; // [weekly-db-fix] Use secure admin client

export type WeeklySource = 'supabase' | 'json-fallback' | 'public-view';

export interface WeeklyApiResponse {
  items: any[];
  metrics?: any;
  generatedAt: string;
  source: WeeklySource;
  success: boolean;
  error?: string;
  diagnostics?: {
    ordering: string;
    source: string;
    top3: Array<{
      rank: number;
      id: string;
      score: number;
      hasImage: boolean;
      imageSource: string;
    }>;
  };
}

// AI-only image resolver - no external thumbnails
function resolveDisplayImage(item: { ai_image_url?: string; video_id?: string }): string | null {
  // ONLY use AI-generated images - no external thumbnails
  if (item.ai_image_url) return item.ai_image_url;
  // Return null if no AI image - will trigger placeholder fallback in UI
  return null;
}

function nowTH() { 
  return new Date(); // keep simple; server is consistent
}

// [weekly-db-fix] Safe date conversion utility
function toDate(value: any): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (typeof value === 'number') {
    // If timestamp is in seconds (Unix), convert to milliseconds
    return new Date(value < 1e12 ? value * 1000 : value);
  }
  return new Date(); // Safe fallback
}

function sevenDaysAgoISO() {
  const d = new Date(); 
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

/**
 * DB-first canonical fetch. If DB has 0 rows or errors, fall back to JSON file.
 * Use the view that Home uses (ensure same field names / sorting / limit).
 */
// [weekly-db-fix] Server-only guard function
function assertServerOnly() {
  if (typeof window !== 'undefined') {
    throw new Error('[weekly-db-fix] fetchWeeklyCanon must only run on server');
  }
}

export async function fetchWeeklyCanon(limit=20, diagnostics=false): Promise<WeeklyApiResponse> {
  assertServerOnly(); // [weekly-db-fix] Runtime guard
  const t0 = Date.now();
  
  // SECTION D: JSON fallback completely removed - DB-only system
  const allowJsonFallback = false; // Always false - no JSON fallback
  
  try {
    console.log(`[fetchWeeklyCanon] 🔍 Attempting Supabase fetch with limit=${limit}`);
    // [weekly-db-fix] Use admin client with proper runtime check
    const supa = getSupabaseAdmin();

    // [weekly-db-fix] First test connection with minimal query
    console.log('[fetchWeeklyCanon] 📊 Testing DB connection...');
    const { error: connectionError } = await supa
      .from('news_trends')
      .select('id', { head: true, count: 'exact' });
    
    if (connectionError) {
      const errMessage = `DB connection failed: ${connectionError.message}`;
      console.error('[weekly-db-fix] fallback', { reason: 'connection_error', errMessage, rowsLen: 0 });
      if (!allowJsonFallback) throw new Error(errMessage);
      throw new Error(errMessage); // Will trigger JSON fallback
    }

    // [weekly-db-fix] Try weekly_public_view first (canonical view with proper sorting)
    console.log('[fetchWeeklyCanon] 📊 Querying weekly_public_view...');
    let { data, error } = await supa
      .from('weekly_public_view')
      .select('*')
      .limit(limit);

    if (error) {
      console.log('[fetchWeeklyCanon] 📊 View not available, falling back to news_trends table...');
      // [weekly-db-fix] Fallback to direct table query (no ai_images join)
      const fallbackResult = await supa
        .from('news_trends')
        .select(`
          id, title, summary, summary_en, platform, popularity_score, popularity_score_precise,
          date, category, ai_image_url, ai_image_prompt, video_id, channel, view_count,
          published_date, description, duration, like_count, comment_count, reason,
          raw_view, growth_rate, platform_mentions, keywords, ai_opinion, score_details,
          created_at, updated_at
        `)
        .gte('published_date', sevenDaysAgoISO())
        .order('popularity_score_precise', { ascending: false })
        .order('id', { ascending: true }) // [rank-img-investigation] Stable tiebreaker
        .limit(limit);
      
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      const errMessage = `Weekly data query failed: ${error.message}`;
      console.error('[weekly-db-fix] fallback', { reason: 'query_error', errMessage, rowsLen: 0 });
      if (!allowJsonFallback) throw new Error(errMessage);
      throw error; // Will trigger JSON fallback
    }

    // [weekly-db-fix] If 0 rows from view, try alternative date filter
    if (!data || data.length === 0) {
      console.log('[fetchWeeklyCanon] 📊 Trying alternative date range with created_at fallback...');
      const alt = await supa
        .from('news_trends')
        .select(`
          id, title, summary, summary_en, platform, popularity_score, popularity_score_precise,
          date, category, ai_image_url, ai_image_prompt, video_id, channel, view_count,
          published_date, description, duration, like_count, comment_count, reason,
          raw_view, growth_rate, platform_mentions, keywords, ai_opinion, score_details,
          created_at, updated_at
        `)
        .gte('created_at', sevenDaysAgoISO())
        .order('popularity_score_precise', { ascending: false })
        .order('id', { ascending: true }) // [rank-img-investigation] Stable tiebreaker
        .limit(limit);
      
      if (!alt.error && alt.data && alt.data.length) {
        console.log(`[fetchWeeklyCanon] ✅ Alternative query succeeded: ${alt.data.length} items`);
        data = alt.data;
      } else if (alt.error) {
        console.error('[weekly-db-fix] fallback', { reason: 'alt_query_error', errMessage: alt.error.message, rowsLen: 0 });
      }
    }

    // [weekly-db-fix] Explicit success condition: DB query succeeded AND returned rows
    if (data && data.length > 0) {
      // [rank-img-investigation] Log raw fetch results for top 3
      console.log('[rank-img-investigation] fetched', {
        count: data.length,
        top3: data.slice(0, 3).map(item => ({
          id: item.id,
          score: item.popularity_score_precise,
          ai: !!item.ai_image_url,
          video: !!item.video_id
        }))
      });

      // Map analysis field and resolve images without ai_images join
      const itemsWithAnalysis = data.map((item: any, index: number) => {
        // Use ai_image_url directly from news_trends table
        const resolvedImage = item.display_image_url || item.ai_image_url || resolveDisplayImage(item);
        
        return {
          ...item,
          rank: index + 1, // [rank-sync-fix] Set rank based on sorted position
          analysis: item.analysis || (item.ai_opinion ? { text: item.ai_opinion } : undefined),
          // [rank-img-investigation] Use canonical display image
          display_image_url: resolvedImage,
          // [data-freshness] Ensure score field is normalized
          score: item.score || item.popularity_score_precise
        };
      });

      // [rank-img-investigation] Log top 3 after image resolution
      const top3 = itemsWithAnalysis.slice(0, 3);
      console.log('[rank-img-investigation] top3', top3.map((item, idx) => ({
        rank: idx + 1,
        id: item.id,
        imageResolved: !!item.display_image_url
      })));

      // [rank-img-investigation] Warn about missing images in top 3
      top3.forEach(item => {
        if (!item.display_image_url) {
          console.warn('[rank-img-investigation] missing-image-top3', { 
            id: item.id, 
            title: item.title?.substring(0, 40) 
          });
        }
      });
      
      const result: WeeklyApiResponse = { 
        items: itemsWithAnalysis, 
        metrics: { elapsed: Date.now()-t0, totalRows: data.length }, 
        generatedAt: nowTH().toISOString(), 
        source: 'supabase' as WeeklySource,
        success: true
      };

      // [data-freshness] Add diagnostics if requested
      if (diagnostics) {
        result.diagnostics = {
          ordering: 'server',
          source: 'supabase',
          top3: itemsWithAnalysis.slice(0, 3).map((item: any, idx: number) => ({
            rank: idx + 1,
            id: item.id,
            score: item.score || item.popularity_score_precise,
            hasImage: !!(item.display_image_url),
            imageSource: item.ai_image_url ? 'ai' : 'none'
          }))
        };
        console.log('[data-freshness] api diagnostics enabled:', result.diagnostics);
      }

      console.log('[weekly-db-fix] using-db', { rowsLen: data.length }); // [weekly-db-fix] Success log
      return result;
    }
    
    // [weekly-db-fix] Explicit fallback condition: DB returned 0 rows
    const errMessage = 'DB returned zero rows for date range';
    console.error('[weekly-db-fix] fallback', { reason: 'zero_rows', errMessage, rowsLen: 0 });
    if (!allowJsonFallback) {
      throw new Error(errMessage);
    }
    // fall through to JSON
  } catch (e) {
    // [weekly-db-fix] Explicit fallback condition: DB error occurred
    const errMessage = (e as Error)?.message || 'Unknown DB error';
    console.error('[weekly-db-fix] fallback', { reason: 'db_error', errMessage, rowsLen: 0 });
    if (!allowJsonFallback) {
      throw e;
    }
    // swallow to fallback
  }

  // SECTION D: DB-only system - no fallback
  console.error('[fetchWeeklyCanon] ❌ Database connection failed - no fallback available');
  console.error('[fetchWeeklyCanon] ❌ System is now fully DB-driven with no JSON fallback');
  
  return {
    items: [],
    metrics: { elapsed: Date.now()-t0, totalRows: 0 },
    generatedAt: nowTH().toISOString(),
    source: 'supabase' as WeeklySource,
    success: false,
    error: 'Database connection failed - system is fully DB-driven'
  };
}