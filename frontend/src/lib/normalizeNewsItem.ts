/**
 * Home News Item Normalizer
 * Single source of truth for all display fields with robust UINewsItem type
 */

import { isAbsoluteUrl, toPublicUrl, PLACEHOLDER_NEWS_IMAGE } from '@/lib/imageUrl';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { extractPlatformsFromRow } from '@/lib/helpers/platformHelpers';

// Feature flag for new UI sections
export const USE_NEW_UI_SECTIONS = true;

// Helper function to safely convert to number
const toNum = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^\d.\-+]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// Helper function to parse keywords
const parseKeywords = (keywords: string | string[] | null | undefined): string[] => {
  if (!keywords) return [];
  if (Array.isArray(keywords)) return keywords.filter(k => typeof k === 'string' && k.trim()).slice(0, 6);
  
  if (typeof keywords === 'string') {
    if (keywords === 'N/A' || keywords === '') return [];
    
    try {
      // Try to parse as JSON array first
      if (keywords.startsWith('[')) {
        const parsed = JSON.parse(keywords);
        if (Array.isArray(parsed)) {
          return parsed.filter(k => typeof k === 'string' && k.trim()).slice(0, 6);
        }
      }
      
      // Fallback to comma/space separated
      const keywordList = keywords.split(/[,\s]+/).map(k => k.trim()).filter(k => k);
      return [...new Set(keywordList)].slice(0, 6);
    } catch {
      // If parsing fails, try comma-separated
      const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k);
      return [...new Set(keywordList)].slice(0, 6);
    }
  }
  
  return [];
};

// Normalized UI News Item type - guaranteed safe defaults
export type UINewsItem = {
  id: string;
  title: string;
  summary: string | null;
  summary_en: string | null;         // Required by existing components
  description: string | null;        // Required by existing components
  duration: string | null;           // Required by existing components
  category: string | null;
  platform: string | null;
  displayImageUrl: string;           // final image (raw → ai → placeholder)
  isAIImage: boolean;                // source tag
  popularityScore: number;           // default 0
  growthRate: number | null;         // % or null (hide chip if null)
  views: number | null;
  likes: number | null;
  comments: number | null;
  publishedAt: string | null;
  popularitySubtext?: string;        // Generated subtext for popularity display
  channelTitle: string | null;
  originalUrl: string | null;
  reason: string | null;             // "why trending"
  keywords: string[];                // split on comma/space, trimmed, uniq
  platforms: string[];               // normalized platform names from fallback chain
  aiOpinion: string | null;          // AI OPINION panel
  aiImagePrompt: string | null;      // AI image generation prompt
  scoreDetails: string | null;       // raw explanation string or JSON
  updatedAt: string | null;
  summaryDate: string | null;
  externalId: string | null;
  
  // Legacy compatibility fields (for existing components)
  video_id?: string;
  channel?: string;
  published_date?: string;
  date?: string;                     // Alias for summaryDate
  view_count?: string | number;
  like_count?: string | number;
  comment_count?: string | number;
  popularity_score?: number;
  popularity_score_precise?: number;
  ai_image_url?: string | null;      // Allow null for fallback items
  display_image_url?: string;
  is_ai_image?: boolean;
  auto_category?: string;
  rank?: number;
  scorePrecise?: number;
  scoreRounded?: number;
  growth_rate?: number | null;
  ai_image_prompt?: string | null;   // Allow null for fallback items
  view_details?: any;
};

export function normalizeNewsItem(raw: any): UINewsItem {
  if (!raw) {
    throw new Error('Cannot normalize null/undefined news item');
  }

  // Extract fields with safe defaults
  const {
    id,
    title,
    summary,
    summary_en,
    description,
    duration,
    category,
    platform,
    display_image_url_raw,
    ai_image_url,
    is_ai_image,
    popularity_score,
    popularity_score_precise,
    growth_rate,
    view_count,
    views,
    like_count,
    likes,
    comment_count,
    comments,
    published_at,
    published_date,
    channel_title,
    channel,
    video_id,
    external_id,
    reason,
    keywords,
    ai_opinion,
    score_details,
    updated_at,
    summary_date,
    date,
    ai_image_prompt,
    platforms_raw,
    platform_mentions,
    view_details,
    auto_category,
    rank,
    ...rest
  } = raw;

  // Validate required fields
  if (!id) throw new Error('News item missing required id field');
  if (!title) throw new Error('News item missing required title field');

  // Image normalization with guaranteed fallback
  let displayImageUrl = PLACEHOLDER_NEWS_IMAGE;
  let isAIImage = false;

  // Use display_image_url_raw (which now has COALESCE fallback in the view)
  if (display_image_url_raw) {
    if (display_image_url_raw === '/placeholder-image.svg') {
      displayImageUrl = PLACEHOLDER_NEWS_IMAGE;
      isAIImage = false;
    } else if (isAbsoluteUrl(display_image_url_raw)) {
      displayImageUrl = display_image_url_raw;
      isAIImage = is_ai_image ?? !!ai_image_url;
    } else {
      displayImageUrl = toPublicUrl(display_image_url_raw);
      isAIImage = is_ai_image ?? !!ai_image_url;
    }
  }
  // Fallback for legacy data without display_image_url_raw
  else if (ai_image_url) {
    displayImageUrl = isAbsoluteUrl(ai_image_url) 
      ? ai_image_url 
      : toPublicUrl(ai_image_url);
    isAIImage = true;
  }

  // Check if displayImageUrl includes 'ai' in the path as additional AI detection
  if (displayImageUrl && displayImageUrl.includes('ai_generated_images/')) {
    isAIImage = true;
  }

  // Numeric field normalization
  const growthRateNum = toNum(growth_rate);
  const popularityScoreNum = toNum(popularity_score_precise) ?? toNum(popularity_score) ?? 0;
  const viewsNum = toNum(views) ?? toNum(view_count);
  const likesNum = toNum(likes) ?? toNum(like_count);
  const commentsNum = toNum(comments) ?? toNum(comment_count);

  // Parse keywords safely
  const keywordsList = parseKeywords(keywords);

  // Generate original URL
  const originalUrl = video_id || external_id 
    ? `https://www.youtube.com/watch?v=${video_id || external_id}`
    : null;

  // Create normalized UINewsItem
  const normalized: UINewsItem = {
    // Core UINewsItem fields
    id: String(id),
    title: String(title),
    summary: summary || null,
    summary_en: summary_en || summary || null,  // Fallback to summary if summary_en missing
    description: description || null,
    duration: duration || null,
    category: category || null,
    platform: platform || null,
    displayImageUrl,
    isAIImage,
    popularityScore: popularityScoreNum,
    growthRate: growthRateNum,
    views: viewsNum,
    likes: likesNum,
    comments: commentsNum,
    publishedAt: published_at || published_date || null,
    popularitySubtext: raw.popularitySubtext || undefined,
    channelTitle: channel_title || channel || null,
    originalUrl,
    reason: reason || null,
    keywords: keywordsList,
    platforms: extractPlatformsFromRow({ platforms_raw, platform, platform_mentions }),
    aiOpinion: ai_opinion && ai_opinion !== 'N/A' ? ai_opinion : null,
    aiImagePrompt: ai_image_prompt || null,
    scoreDetails: score_details || null,
    updatedAt: updated_at || null,
    summaryDate: summary_date || date || null,
    externalId: external_id || video_id || null,

    // Legacy compatibility fields
    video_id: video_id || external_id,
    channel: channel_title || channel,
    published_date: published_at || published_date,
    date: summary_date || date || null,  // Alias for summaryDate
    view_count: viewsNum,
    like_count: likesNum,
    comment_count: commentsNum,
    popularity_score: popularityScoreNum,
    popularity_score_precise: toNum(popularity_score_precise) ?? popularityScoreNum,
    ai_image_url: ai_image_url || null,
    display_image_url: displayImageUrl,
    is_ai_image: isAIImage,
    auto_category: auto_category || category,
    rank: toNum(rank),
    scorePrecise: toNum(popularity_score_precise) ?? popularityScoreNum,
    scoreRounded: Math.round(popularityScoreNum),
    growth_rate: growthRateNum,
    ai_image_prompt: ai_image_prompt || null,
    view_details,

    // Pass through any additional fields
    ...rest
  };

  return normalized;
}

/**
 * Normalize an array of news items
 * Never filters out items - ensures all have valid images and required fields
 */
export function normalizeNewsItems(rawItems: any[]): UINewsItem[] {
  if (!Array.isArray(rawItems)) {
    console.warn('[normalizeNewsItems] Input is not an array:', rawItems);
    return [];
  }

  if ((FEATURE_FLAGS as any).DEBUG_UI) {
    console.log('[diag] before normalize count=', rawItems?.length, rawItems?.[0]);
  }

  const items: UINewsItem[] = rawItems.map((item, index) => {
    try {
      return normalizeNewsItem(item);
    } catch (error) {
      console.warn(`[normalizeNewsItems] Failed to normalize item ${index}:`, error, item);
      
      // Create a minimal valid UINewsItem with safe defaults
      const fallbackItem: UINewsItem = {
        id: item?.id || `fallback-${index}`,
        title: item?.title || 'Untitled Story',
        summary: item?.summary || null,
        summary_en: item?.summary_en || item?.summary || null,
        description: item?.description || null,
        duration: item?.duration || null,
        category: item?.category || null,
        platform: item?.platform || null,
        displayImageUrl: PLACEHOLDER_NEWS_IMAGE,
        isAIImage: false,
        popularityScore: 0,
        growthRate: null,
        views: null,
        likes: null,
        comments: null,
        publishedAt: item?.published_at || item?.published_date || null,
        channelTitle: item?.channel_title || item?.channel || null,
        originalUrl: null,
        reason: null,
        keywords: [],
        platforms: [],
        aiOpinion: null,
        aiImagePrompt: null,
        scoreDetails: null,
        updatedAt: null,
        summaryDate: null,
        externalId: null,
        
        // Legacy compatibility
        video_id: item?.video_id,
        channel: item?.channel,
        published_date: item?.published_date,
        date: item?.date || null,
        view_count: 0,
        like_count: 0,
        comment_count: 0,
        popularity_score: 0,
        popularity_score_precise: 0,
        ai_image_url: null,
        display_image_url: PLACEHOLDER_NEWS_IMAGE,
        is_ai_image: false,
        auto_category: item?.auto_category || item?.category,
        rank: index + 1,
        scorePrecise: 0,
        scoreRounded: 0,
        growth_rate: null,
        ai_image_prompt: null,
        view_details: null
      };
      
      return fallbackItem;
    }
  });

  // Filter out items that are missing both title and summary (completely invalid)
  const validItems = items.filter(item => item.title && item.title !== 'Untitled Story');

  if ((FEATURE_FLAGS as any).DEBUG_UI) {
    console.log('[diag] after normalize count=', validItems.length, validItems?.[0]);
    console.log('[diag] items with AI images=', validItems.filter(i => i.isAIImage).length);
    console.log('[diag] items with placeholders=', validItems.filter(i => i.displayImageUrl === PLACEHOLDER_NEWS_IMAGE).length);
  }

  return validItems;
}
