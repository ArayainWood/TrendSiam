/**
 * Weekly Data Fetcher using Supabase Public View
 * 
 * Prioritizes weekly_public_view over cached JSON fallback.
 * This is the new DB-first approach using public views.
 */

import { getWeeklyPublicView, WeeklyPublicViewRow } from './supabasePublic';
import { WeeklyData, WeeklyStory, calculateMetrics } from './weeklyDataShared';

/**
 * Transform public view row to WeeklyStory format
 */
function transformPublicViewToStory(row: WeeklyPublicViewRow, index: number): WeeklyStory {
  return {
    story_id: row.story_id,
    rank: index + 1,
    title: row.title,
    summary: row.summary || '',
    summary_en: row.summary_en || '',
    category: row.category || 'Unknown',
    platform: row.platform || 'YouTube',
    video_id: row.video_id,
    popularity_score: Math.round(row.popularity_score || 0),
    popularity_score_precise: row.popularity_score_precise || 0,
    published_date: row.published_date,
    description: row.description || '',
    channel: row.channel || '',
    view_count: row.view_count || '0',
    like_count: row.like_count || '0',
    comment_count: row.comment_count || '0',
    ai_image_url: row.ai_image_url || undefined,
    image_status: row.ai_image_url ? 'ready' : 'pending',
    image_updated_at: row.updated_at || undefined,
    ai_image_prompt: row.ai_image_prompt || undefined,
    summary_status: row.summary ? 'ready' : 'pending'
  };
}

/**
 * Fetch from cached JSON as fallback
 */
async function fetchFromCachedJSON(): Promise<WeeklyData> {
  console.log('[weeklyDataPublic] 📄 Using cached JSON fallback...');
  
  try {
    // Try to read from public JSON file
    const response = await fetch('/data/thailand_trending_summary.json', {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch JSON: ${response.status}`);
    }

    const jsonData = await response.json();
    const items = Array.isArray(jsonData) ? jsonData : jsonData.trending_stories || jsonData.items || [];
    
    // Filter and transform JSON data
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
        summary_status: item.summary ? 'ready' : 'pending',
        image_status: item.ai_image_url ? 'ready' : 'pending'
      }))
      .slice(0, 50);

    const metrics = calculateMetrics(filteredItems);
    
    console.log(`[weeklyDataPublic] ✅ JSON fallback successful: ${filteredItems.length} stories`);

    return {
      items: filteredItems,
      metrics,
      generatedAt: new Date().toISOString(),
      dataVersion: jsonData.data_version || new Date().toISOString(),
      source: 'json'
    };
  } catch (error) {
    console.error('[weeklyDataPublic] ❌ JSON fallback failed:', error);
    throw error;
  }
}

/**
 * Main function to get weekly data - Public View first, JSON fallback
 */
export async function getWeeklyDataFromPublicView(): Promise<WeeklyData> {
  console.log('[weeklyDataPublic] 🔄 Starting data fetch...');
  
  try {
    // Try public view first
    const publicViewRows = await getWeeklyPublicView();
    
    if (!publicViewRows || publicViewRows.length === 0) {
      console.warn('[weeklyDataPublic] ⚠️ Public view returned no data, falling back to JSON');
      return await fetchFromCachedJSON();
    }

    // Transform public view data
    const items: WeeklyStory[] = publicViewRows
      .slice(0, 50) // Limit to 50 items
      .map((row, index) => transformPublicViewToStory(row, index));

    const metrics = calculateMetrics(items);
    
    console.log(`[weeklyDataPublic] ✅ Public view successful: ${items.length} stories from ${publicViewRows.length} total rows`);

    return {
      items,
      metrics,
      generatedAt: new Date().toISOString(),
      dataVersion: new Date().toISOString(),
      source: 'public-view'
    };

  } catch (publicViewError: any) {
    console.warn(`[weeklyDataPublic] ⚠️ Public view failed, falling back to JSON:`, {
      error: publicViewError?.message || String(publicViewError)
    });
    
    try {
      return await fetchFromCachedJSON();
    } catch (jsonError) {
      console.error('[weeklyDataPublic] ❌ Both public view and JSON fallback failed:', jsonError);
      
      // Return empty state as last resort
      return {
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
    }
  }
}
