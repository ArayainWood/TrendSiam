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
  // Core camelCase fields from API
  id: string;
  title: string;
  summary: string | null;
  summaryEn: string | null;         // camelCase
  category: string | null;
  platform: string | null;
  channel: string | null;
  popularityScore: number;           // camelCase
  rank: number | null;
  isTop3: boolean;                   // camelCase
  imageUrl: string | null;           // camelCase - clean image URL from API
  aiPrompt: string | null;           // camelCase - clean AI prompt from API
  showImage: boolean;                // camelCase - UI control flag
  showAiPrompt: boolean;             // camelCase - UI control flag
  growthRateValue: number | null;    // camelCase
  growthRateLabel: string;           // camelCase
  views: number | null;
  videoViews: number | null;         // camelCase - platform video views (YouTube)
  webViewCount: number | null;       // camelCase - TrendSiam site clicks
  likes: number | null;
  comments: number | null;
  popularityNarrative?: string;      // Generated narrative sentence
  publishedAt: string | null;        // camelCase
  sourceUrl: string | null;          // camelCase - guaranteed non-null from API
  videoId: string | null;            // camelCase
  externalId: string | null;         // camelCase
  platformMentions: number | null;   // camelCase
  keywords: string | null;
  aiOpinion: string | null;          // camelCase
  scoreDetails: any | null;          // camelCase - can be object or string
  updatedAt: string | null;          // camelCase
  
  // Additional UI fields (computed locally)
  displayImageUrl: string;           // final image with fallback (for UI)
  isAIImage: boolean;                // source tag
  channelTitle: string | null;       // alias for channel
  originalUrl: string | null;        // computed from sourceUrl/videoId
  popularitySubtext?: string;        // Generated subtext for popularity display
  summaryDate: string | null;
  keywordsList: string[];            // parsed keywords array
  platforms: string[];               // normalized platform names
  reason: string | null;             // "why trending"
  description: string | null;        // for legacy components
  duration: string | null;           // for legacy components
  
  // Legacy snake_case fields (for backward compatibility)
  summary_en?: string | null;
  video_id?: string;
  published_date?: string;
  date?: string;
  view_count?: string | number;
  like_count?: string | number;
  comment_count?: string | number;
  popularity_score?: number;
  popularity_score_precise?: number;
  ai_image_url?: string | null;
  display_image_url?: string;
  is_ai_image?: boolean;
  auto_category?: string;
  growth_rate?: number | null;
  ai_image_prompt?: string | null;
  view_details?: any;
};

export function normalizeNewsItem(raw: any): UINewsItem {
  if (!raw) {
    throw new Error('Cannot normalize null/undefined news item');
  }

  // Extract fields - accept both camelCase (from API) and snake_case (legacy)
  const {
    id,
    title,
    summary,
    summaryEn, summary_en,  // Accept both
    description,
    duration,
    category,
    platform,
    channel,
    popularityScore, popularity_score, popularity_score_precise,  // Accept all variants
    rank,
    isTop3, is_top3,  // Accept both
    imageUrl, image_url, ai_image_url,  // Accept all variants
    aiPrompt, ai_prompt, ai_image_prompt,  // Accept all variants
    showImage, show_image,  // Accept both
    showAiPrompt, show_ai_prompt,  // Accept both
    growthRateValue, growth_rate_value, growth_rate,  // Accept all variants
    growthRateLabel, growth_rate_label,  // Accept both
    views, view_count,  // Accept both
    videoViews, video_views,  // Accept both
    webViewCount, web_view_count,  // Accept both
    likes, like_count,  // Accept both
    popularityNarrative, popularity_narrative,  // Accept both
    comments, comment_count,  // Accept both
    publishedAt, published_at, published_date,  // Accept all variants
    sourceUrl, source_url,  // Accept both
    videoId, video_id,  // Accept both
    externalId, external_id,  // Accept both
    platformMentions, platform_mentions,  // Accept both
    keywords,
    aiOpinion, ai_opinion,  // Accept both
    scoreDetails, score_details,  // Accept both
    updatedAt, updated_at,  // Accept both
    summaryDate, summary_date, date,  // Accept all variants
    reason,
    display_image_url_raw,
    is_ai_image,
    platforms_raw,
    view_details,
    auto_category,
    ...rest
  } = raw;

  // Validate required fields
  if (!id) throw new Error('News item missing required id field');
  if (!title) throw new Error('News item missing required title field');

  // Prefer camelCase fields from API, fallback to snake_case
  const finalSummaryEn = summaryEn ?? summary_en ?? summary;
  const finalPopularityScore = toNum(popularityScore) ?? toNum(popularity_score_precise) ?? toNum(popularity_score) ?? 0;
  const finalIsTop3 = isTop3 ?? is_top3 ?? false;
  const finalImageUrl = imageUrl ?? image_url ?? ai_image_url;
  const finalAiPrompt = aiPrompt ?? ai_prompt ?? ai_image_prompt;
  const finalShowImage = showImage ?? show_image ?? Boolean(finalImageUrl && finalIsTop3);
  const finalShowAiPrompt = showAiPrompt ?? show_ai_prompt ?? Boolean(finalAiPrompt && finalIsTop3);
  const finalGrowthRateValue = toNum(growthRateValue ?? growth_rate_value ?? growth_rate);
  const finalGrowthRateLabel = growthRateLabel ?? growth_rate_label ?? 'Not enough data';
  const finalViews = toNum(views ?? view_count);
  const finalVideoViews = toNum(videoViews ?? video_views ?? views ?? view_count);
  const finalWebViewCount = toNum(webViewCount ?? web_view_count);
  const finalLikes = toNum(likes ?? like_count);
  const finalPopularityNarrative = popularityNarrative ?? popularity_narrative;
  const finalComments = toNum(comments ?? comment_count);
  const finalPublishedAt = publishedAt ?? published_at ?? published_date;
  const finalSourceUrl = sourceUrl ?? source_url;
  const finalVideoId = videoId ?? video_id;
  const finalExternalId = externalId ?? external_id;
  const finalPlatformMentions = toNum(platformMentions ?? platform_mentions);
  const finalAiOpinion = aiOpinion ?? ai_opinion;
  const finalScoreDetails = scoreDetails ?? score_details;
  const finalUpdatedAt = updatedAt ?? updated_at;
  const finalSummaryDate = summaryDate ?? summary_date ?? date;

  // Image normalization for displayImageUrl
  let displayImageUrl = PLACEHOLDER_NEWS_IMAGE;
  let isAIImage = false;

  // Use finalImageUrl if available
  if (finalImageUrl) {
    if (finalImageUrl === '/placeholder-image.svg') {
      displayImageUrl = PLACEHOLDER_NEWS_IMAGE;
      isAIImage = false;
    } else if (isAbsoluteUrl(finalImageUrl)) {
      displayImageUrl = finalImageUrl;
      isAIImage = is_ai_image ?? true; // Assume AI if from API
    } else {
      displayImageUrl = toPublicUrl(finalImageUrl);
      isAIImage = is_ai_image ?? true;
    }
  }
  // Fallback for display_image_url_raw (legacy)
  else if (display_image_url_raw) {
    if (display_image_url_raw === '/placeholder-image.svg') {
      displayImageUrl = PLACEHOLDER_NEWS_IMAGE;
      isAIImage = false;
    } else if (isAbsoluteUrl(display_image_url_raw)) {
      displayImageUrl = display_image_url_raw;
      isAIImage = is_ai_image ?? false;
    } else {
      displayImageUrl = toPublicUrl(display_image_url_raw);
      isAIImage = is_ai_image ?? false;
    }
  }

  // Check if displayImageUrl includes 'ai' in the path as additional AI detection
  if (displayImageUrl && displayImageUrl.includes('ai_generated_images/')) {
    isAIImage = true;
  }

  // Parse keywords safely
  const keywordsList = parseKeywords(keywords);

  // Generate original URL (prefer sourceUrl from API)
  const originalUrl = finalSourceUrl || (finalVideoId || finalExternalId 
    ? `https://www.youtube.com/watch?v=${finalVideoId || finalExternalId}`
    : null);

  // Create normalized UINewsItem
  const normalized: UINewsItem = {
    // Core camelCase fields (from API)
    id: String(id),
    title: String(title),
    summary: summary || null,
    summaryEn: finalSummaryEn,
    category: category || null,
    platform: platform || null,
    channel: channel || null,
    popularityScore: finalPopularityScore,
    rank: toNum(rank),
    isTop3: finalIsTop3,
    imageUrl: finalImageUrl,
    aiPrompt: finalAiPrompt,
    showImage: finalShowImage,
    showAiPrompt: finalShowAiPrompt,
    growthRateValue: finalGrowthRateValue,
    growthRateLabel: finalGrowthRateLabel,
    views: finalViews,
    videoViews: finalVideoViews,
    webViewCount: finalWebViewCount,
    likes: finalLikes,
    comments: finalComments,
    popularityNarrative: finalPopularityNarrative,
    publishedAt: finalPublishedAt,
    sourceUrl: finalSourceUrl,
    videoId: finalVideoId,
    externalId: finalExternalId,
    platformMentions: finalPlatformMentions,
    keywords: keywords || null,  // Keep as string for now
    aiOpinion: finalAiOpinion && finalAiOpinion !== 'N/A' ? finalAiOpinion : null,
    scoreDetails: finalScoreDetails,
    updatedAt: finalUpdatedAt,
    
    // Additional UI fields
    displayImageUrl,
    isAIImage,
    channelTitle: channel || null,
    originalUrl,
    popularitySubtext: raw.popularitySubtext || undefined,
    summaryDate: finalSummaryDate,
    keywordsList,
    platforms: extractPlatformsFromRow({ platforms_raw, platform, platform_mentions: finalPlatformMentions ? String(finalPlatformMentions) : null }),
    reason: reason || null,
    description: description || null,
    duration: duration || null,

    // Legacy snake_case compatibility fields
    summary_en: finalSummaryEn,
    video_id: finalVideoId,
    published_date: finalPublishedAt,
    date: finalSummaryDate,
    view_count: finalViews,
    like_count: finalLikes,
    comment_count: finalComments,
    popularity_score: finalPopularityScore,
    popularity_score_precise: toNum(popularity_score_precise) ?? finalPopularityScore,
    ai_image_url: finalImageUrl,
    display_image_url: displayImageUrl,
    is_ai_image: isAIImage,
    auto_category: auto_category || category,
    growth_rate: finalGrowthRateValue,
    ai_image_prompt: finalAiPrompt,
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
        // Core camelCase fields
        id: item?.id || `fallback-${index}`,
        title: item?.title || 'Untitled Story',
        summary: item?.summary || null,
        summaryEn: item?.summaryEn || item?.summary_en || item?.summary || null,
        category: item?.category || null,
        platform: item?.platform || null,
        channel: item?.channel || null,
        popularityScore: 0,
        rank: index + 1,
        isTop3: false,
        imageUrl: null,
        aiPrompt: null,
        showImage: false,
        showAiPrompt: false,
        growthRateValue: null,
        growthRateLabel: 'Not enough data',
        views: null,
        videoViews: null,
        webViewCount: null,
        likes: null,
        comments: null,
        popularityNarrative: undefined,
        publishedAt: item?.publishedAt || item?.published_at || item?.published_date || null,
        sourceUrl: null,
        videoId: item?.videoId || item?.video_id || null,
        externalId: item?.externalId || item?.external_id || null,
        platformMentions: null,
        keywords: null,
        aiOpinion: null,
        scoreDetails: null,
        updatedAt: null,
        
        // Additional UI fields
        displayImageUrl: PLACEHOLDER_NEWS_IMAGE,
        isAIImage: false,
        channelTitle: item?.channel || null,
        originalUrl: null,
        popularitySubtext: undefined,
        summaryDate: null,
        keywordsList: [],
        platforms: [],
        reason: null,
        description: item?.description || null,
        duration: item?.duration || null,
        
        // Legacy compatibility
        summary_en: item?.summaryEn || item?.summary_en || item?.summary || null,
        video_id: item?.videoId || item?.video_id,
        published_date: item?.publishedAt || item?.published_at || item?.published_date,
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
