/**
 * News Data Repository
 * 
 * Centralized data access layer that ensures all news data is properly normalized
 * All numeric fields are converted to numbers at this boundary
 */

import { NewsStory, NewsItem, newsItemToStory, safeNewsItemToStory, safeParseNewsStories, safeParseNewsItems } from '../schema/news'
import { parseRank } from '../num'
import { sanitizeHomeItem } from '../utils/sanitizeHomeItem'
import { pickDisplayImage } from '../utils/imageUtils'

/**
 * Transform raw API/database data to normalized NewsStory
 * This is the critical boundary where string numbers become real numbers
 */
export function normalizeNewsItem(rawItem: any): NewsStory {
  try {
    // Sanitize the raw item first
    const sanitizedItem = sanitizeHomeItem(rawItem);
    
    // First convert to NewsItem (flexible schema)
    const newsItem: NewsItem = {
      id: sanitizedItem.id,
      rank: sanitizedItem.rank, // Keep as-is for now
      title: sanitizedItem.title || '',
      channel: sanitizedItem.channel || '',
      view_count: String(sanitizedItem.view_count || 0),
      views: sanitizedItem.views,
      published_date: sanitizedItem.published_date || '',
      date: sanitizedItem.date,
      video_id: sanitizedItem.video_id || '',
      description: sanitizedItem.description || '',
      duration: sanitizedItem.duration || '',
      like_count: String(sanitizedItem.like_count || 0),
      comment_count: String(sanitizedItem.comment_count || 0),
      summary: sanitizedItem.summary || '',
      summary_en: sanitizedItem.summary_en || '',
      popularity_score: sanitizedItem.popularity_score || 0,
      popularity_score_precise: sanitizedItem.popularity_score_precise || 0,
      reason: sanitizedItem.reason || '',
      view_details: sanitizedItem.view_details || {
        views: '0',
        growth_rate: '0',
        platform_mentions: '0',
        matched_keywords: '',
        ai_opinion: '',
        score: '0'
      },
      auto_category: sanitizedItem.auto_category || '',
      platform: sanitizedItem.platform || '',
      ai_image_local: sanitizedItem.ai_image_local,
      ai_image_url: sanitizedItem.ai_image_url,
      ai_image_prompt: sanitizedItem.ai_image_prompt,
      display_image_url: pickDisplayImage({
        display_image_url: sanitizedItem.display_image_url,
        ai_image_url: sanitizedItem.ai_image_url
      }),
      analysis: sanitizedItem.analysis
    }
    
    // Convert to NewsStory (normalized with numeric fields)
    return newsItemToStory(newsItem)
  } catch (error) {
    console.error('Failed to normalize news item:', error, rawItem)
    throw new Error(`Invalid news item data: ${error}`)
  }
}

/**
 * Transform array of raw items to normalized NewsStory array
 */
export function normalizeNewsItems(rawItems: any[]): NewsStory[] {
  return rawItems.map(normalizeNewsItem)
}

/**
 * Safely normalize news items, filtering out invalid ones
 * Collects validation errors for diagnostics
 */
export function safeNormalizeNewsItems(rawItems: any[], collectErrors = false): { 
  items: NewsStory[], 
  errors?: Array<{ item: any, error: string }> 
} {
  const normalized: NewsStory[] = []
  const errors: Array<{ item: any, error: string }> = []
  
  for (const rawItem of rawItems) {
    try {
      // Sanitize the raw item first
      const sanitizedItem = sanitizeHomeItem(rawItem);
      
      // First convert to NewsItem (flexible schema)
      const newsItem: NewsItem = {
        id: sanitizedItem.id,
        rank: sanitizedItem.rank, // Keep as-is for now
        title: sanitizedItem.title || '',
        channel: sanitizedItem.channel || '',
        view_count: String(sanitizedItem.view_count || 0),
        views: sanitizedItem.views,
        published_date: sanitizedItem.published_date || '',
        date: sanitizedItem.date,
        video_id: sanitizedItem.video_id || '',
        description: sanitizedItem.description || '',
        duration: sanitizedItem.duration || '',
        like_count: String(sanitizedItem.like_count || 0),
        comment_count: String(sanitizedItem.comment_count || 0),
        summary: sanitizedItem.summary || '',
        summary_en: sanitizedItem.summary_en || '',
        popularity_score: sanitizedItem.popularity_score || 0,
        popularity_score_precise: sanitizedItem.popularity_score_precise || 0,
        reason: sanitizedItem.reason || '',
        view_details: sanitizedItem.view_details || {
          views: '0',
          growth_rate: '0',
          platform_mentions: '0',
          matched_keywords: '',
          ai_opinion: '',
          score: '0'
        },
        auto_category: sanitizedItem.auto_category || '',
        platform: sanitizedItem.platform || '',
        ai_image_local: sanitizedItem.ai_image_local,
        ai_image_url: sanitizedItem.ai_image_url,
        ai_image_prompt: sanitizedItem.ai_image_prompt,
        display_image_url: pickDisplayImage({
          display_image_url: sanitizedItem.display_image_url,
          ai_image_url: sanitizedItem.ai_image_url
        }),
        analysis: sanitizedItem.analysis
      }
      
      // Use safe conversion
      const story = safeNewsItemToStory(newsItem)
      if (story) {
        normalized.push(story)
      } else if (collectErrors) {
        errors.push({ 
          item: { id: rawItem.id, title: rawItem.title }, 
          error: 'Failed NewsStory schema validation' 
        })
      }
    } catch (error) {
      console.warn('Skipping invalid news item:', error, rawItem)
      if (collectErrors) {
        errors.push({ 
          item: { id: rawItem.id, title: rawItem.title }, 
          error: error instanceof Error ? error.message : String(error) 
        })
      }
    }
  }
  
  return collectErrors ? { items: normalized, errors } : { items: normalized }
}

/**
 * Fetch and normalize news data from API endpoint
 */
export async function fetchNormalizedNews(endpoint: string): Promise<NewsStory[]> {
  try {
    const response = await fetch(endpoint)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    // Handle different API response formats
    let items: any[]
    if (Array.isArray(data)) {
      items = data
    } else if (data.data && Array.isArray(data.data)) {
      items = data.data
    } else if (data.items && Array.isArray(data.items)) {
      items = data.items
    } else {
      throw new Error('Invalid API response format')
    }
    
    return safeNormalizeNewsItems(items).items
  } catch (error) {
    console.error('Failed to fetch normalized news:', error)
    throw error
  }
}

/**
 * Add rank to items based on array position (1-based)
 */
export function addPositionalRanks<T extends { rank?: number }>(items: T[]): T[] {
  return items.map((item, index) => ({
    ...item,
    rank: item.rank ?? (index + 1)
  }))
}

/**
 * Ensure all items have valid numeric ranks
 */
export function ensureValidRanks(items: NewsStory[]): NewsStory[] {
  return items.map((item, index) => ({
    ...item,
    rank: parseRank(item.rank) ?? (index + 1)
  }))
}

/**
 * Repository interface for different data sources
 */
export interface NewsRepository {
  getHomeNews(): Promise<NewsStory[]>
  getWeeklyNews(): Promise<NewsStory[]>
  getNewsByCategory(category: string): Promise<NewsStory[]>
}

/**
 * Default API-based repository implementation
 */
export class APINewsRepository implements NewsRepository {
  constructor(private baseUrl: string = '') {}
  
  async getHomeNews(): Promise<NewsStory[]> {
    const stories = await fetchNormalizedNews(`${this.baseUrl}/api/home`)
    return ensureValidRanks(stories)
  }
  
  async getWeeklyNews(): Promise<NewsStory[]> {
    const stories = await fetchNormalizedNews(`${this.baseUrl}/api/weekly`)
    return ensureValidRanks(stories)
  }
  
  async getNewsByCategory(category: string): Promise<NewsStory[]> {
    const stories = await fetchNormalizedNews(`${this.baseUrl}/api/news?category=${encodeURIComponent(category)}`)
    return ensureValidRanks(stories)
  }
}

// Default repository instance
export const newsRepo = new APINewsRepository()
