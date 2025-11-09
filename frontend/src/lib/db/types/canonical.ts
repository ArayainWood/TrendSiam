/**
 * Canonical Type Definitions and Mapping Layer
 * 
 * Single source of truth for news item types and field mapping between 
 * database (snake_case) and UI (camelCase) representations
 */

import { z } from 'zod';
import { ENGAGEMENT_THRESHOLDS, ENGAGEMENT_LABELS, GROWTH_RATE_THRESHOLDS, VIEW_THRESHOLDS } from '@/lib/constants/businessRules';
import { extractPlatformsFromRow } from '@/lib/helpers/platformHelpers';

// =============================================
// DATABASE ROW TYPE (snake_case) - Mirrors news_trends table
// =============================================
export const DbNewsRowSchema = z.object({
  // Core identifiers
  id: z.string(),
  external_id: z.string().nullable(),
  video_id: z.string().nullable(),
  
  // Content fields
  title: z.string(),
  summary: z.string(),
  summary_en: z.string().nullable(),
  description: z.string().nullable(),
  category: z.string(),
  platform: z.string(),
  channel: z.string().nullable(),
  
  // Dates
  date: z.string().nullable(),
  published_date: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  summary_date: z.string().nullable(),
  
  // Metrics - stored as strings in DB
  view_count: z.union([z.string(), z.number()]).nullable(),
  like_count: z.union([z.string(), z.number()]).nullable(),
  comment_count: z.union([z.string(), z.number()]).nullable(),
  duration: z.string().nullable(),
  raw_view: z.string().nullable(),
  
  // Scores
  popularity_score: z.union([z.number(), z.string()]).nullable(),
  popularity_score_precise: z.union([z.number(), z.string()]),
  
  // AI & Image fields
  ai_image_url: z.string().nullable(),
  ai_image_prompt: z.string().nullable(),
  
  // Analysis fields
  reason: z.string().nullable(),
  growth_rate: z.string().nullable(),
  platform_mentions: z.string().nullable(),
  keywords: z.string().nullable(),
  ai_opinion: z.string().nullable().optional(), // Removed from secure views
  score_details: z.string().nullable().optional(), // Removed from secure views
  
  // Platform fields (from fallback chain)
  platforms_raw: z.string().nullable(),
  
  // Snapshot fields (when joined)
  rank: z.union([z.number(), z.string()]).optional(),
  image_url: z.string().nullable().optional(), // from snapshots
  display_image_url_raw: z.string().nullable().optional(), // from v_home_news
  is_ai_image: z.boolean().optional(),
});

export type DbNewsRow = z.infer<typeof DbNewsRowSchema>;

// =============================================
// UI NEWS ITEM TYPE (camelCase) - For UI consumption
// =============================================
export interface UiNewsItem {
  // Core identifiers
  id: string;
  externalId: string | null;
  videoId: string | null;
  
  // Content fields
  title: string;
  summary: string;
  summaryEn: string | null;
  description: string | null;
  category: string;
  platform: string;
  channelTitle: string | null;
  
  // Dates
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  summaryDate: string | null;
  
  // Metrics (as numbers for UI)
  views: number;
  likes: number;
  comments: number;
  duration: string | null;
  rawView: string | null;
  
  // Scores
  popularityScore: number;
  popularityScorePrecise: number;
  
  // Image fields with fallback chain
  displayImageUrl: string; // Never null - has placeholder fallback
  isAIImage: boolean;
  aiImagePrompt: string | null;
  
  // Analysis fields
  reason: string | null;
  growthRate: number | null;
  platformMentions: string | null;
  platforms: string[]; // Normalized platform names from fallback chain
  keywords: string[];
  aiOpinion: string | null;
  scoreDetails: string | null;
  
  // UI-specific fields
  rank: number;
  hasRealImage: boolean;
  popularitySubtext: string;
  
  // Legacy compatibility fields (will be provided by adapter)
  video_id?: string;
  channel?: string;
  published_date?: string;
  date?: string;
  view_count?: string | number;
  like_count?: string | number;
  comment_count?: string | number;
  popularity_score?: number;
  popularity_score_precise?: number;
  ai_image_url?: string | null;
  growth_rate?: string | null;
  auto_category?: string;
  ai_image_prompt?: string | null;
  view_details?: any;
}

// =============================================
// MAPPING FUNCTIONS
// =============================================

const PLACEHOLDER_IMAGE = '/placeholder-image.svg';

/**
 * Safely convert value to number
 */
function toNumber(value: string | number | null | undefined, defaultValue = 0): number {
  if (value == null) return defaultValue;
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : value;
  return isNaN(num) ? defaultValue : num;
}

/**
 * Parse keywords from various formats
 */
function parseKeywords(keywords: string | null | undefined): string[] {
  if (!keywords || keywords === 'N/A' || keywords === '') return [];
  
  try {
    // Try JSON array
    if (keywords.startsWith('[')) {
      const parsed = JSON.parse(keywords);
      if (Array.isArray(parsed)) {
        return parsed.filter(k => typeof k === 'string' && k.trim()).slice(0, 6);
      }
    }
    
    // Comma-separated fallback
    return keywords.split(',').map(k => k.trim()).filter(k => k).slice(0, 6);
  } catch {
    return keywords.split(/[,\s]+/).filter(k => k).slice(0, 6);
  }
}

/**
 * Get popularity subtext based on score and other metrics
 */
function getPopularitySubtext(row: DbNewsRow): string {
  const score = toNumber(row.popularity_score_precise || row.popularity_score, 0);
  const views = toNumber(row.view_count, 0);
  const likes = toNumber(row.like_count, 0);
  const growthRate = row.growth_rate ? toNumber(row.growth_rate) : null;
  
  const parts = [];
  
  // Engagement level first (based on like rate)
  if (views > 0 && likes > 0) {
    const likeRate = (likes / views) * 100;
    if (likeRate >= ENGAGEMENT_THRESHOLDS.HIGH) parts.push(ENGAGEMENT_LABELS.HIGH);
    else if (likeRate >= ENGAGEMENT_THRESHOLDS.MEDIUM) parts.push(ENGAGEMENT_LABELS.MEDIUM);
    else parts.push(ENGAGEMENT_LABELS.LOW);
  }
  
  // Views with like rate in parentheses
  if (views > 0) {
    let viewsStr = '';
    if (views >= VIEW_THRESHOLDS.MILLION) viewsStr = `${(views / VIEW_THRESHOLDS.MILLION).toFixed(1)}M+ views`;
    else if (views >= VIEW_THRESHOLDS.THOUSAND) viewsStr = `${(views / VIEW_THRESHOLDS.THOUSAND).toFixed(0)}K+ views`;
    else viewsStr = `${views} views`;
    
    // Add like rate if available
    if (likes > 0) {
      const likeRate = ((likes / views) * 100).toFixed(1);
      viewsStr += ` (like rate ${likeRate}%)`;
    }
    parts.push(viewsStr);
  }
  
  // Growth indicator
  if (growthRate && growthRate >= GROWTH_RATE_THRESHOLDS.VIRAL) {
    parts.push('Viral growth');
  } else if (growthRate && growthRate >= GROWTH_RATE_THRESHOLDS.HIGH_GROWTH) {
    parts.push('Fast growth');
  } else if (growthRate && growthRate >= GROWTH_RATE_THRESHOLDS.GROWING) {
    parts.push('Growing');
  }
  
  return parts.join(' • ');
}

/**
 * Determine display image URL with fallback chain
 */
function getDisplayImageUrl(row: DbNewsRow): string {
  // Try snapshot image first
  if (row.image_url) return row.image_url;
  
  // Then AI image
  if (row.ai_image_url) return row.ai_image_url;
  
  // Then raw display URL from view
  if (row.display_image_url_raw) return row.display_image_url_raw;
  
  // Finally placeholder
  return PLACEHOLDER_IMAGE;
}

/**
 * Map database row to UI news item
 * This is the canonical mapping function that ensures consistency
 */
export function mapDbToUi(row: DbNewsRow): UiNewsItem {
  const popularityScore = toNumber(row.popularity_score_precise || row.popularity_score, 0);
  const displayImageUrl = getDisplayImageUrl(row);
  const hasRealImage = displayImageUrl !== PLACEHOLDER_IMAGE;
  const isAIImage = Boolean(row.is_ai_image) || displayImageUrl === row.ai_image_url;
  
  return {
    // Core identifiers
    id: row.id,
    externalId: row.external_id,
    videoId: row.video_id,
    
    // Content fields
    title: row.title,
    summary: row.summary,
    summaryEn: row.summary_en,
    description: row.description,
    category: row.category,
    platform: row.platform,
    channelTitle: row.channel,
    
    // Dates
    publishedAt: row.published_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    summaryDate: row.summary_date || row.date,
    
    // Metrics
    views: toNumber(row.view_count, 0),
    likes: toNumber(row.like_count, 0),
    comments: toNumber(row.comment_count, 0),
    duration: row.duration,
    rawView: row.raw_view,
    
    // Scores
    popularityScore: Math.round(popularityScore),
    popularityScorePrecise: popularityScore,
    
    // Image fields
    displayImageUrl,
    isAIImage,
    aiImagePrompt: row.ai_image_prompt,
    
    // Analysis fields
    reason: row.reason,
    growthRate: row.growth_rate ? toNumber(row.growth_rate) : null,
    platformMentions: row.platform_mentions,
    platforms: extractPlatformsFromRow(row),
    keywords: parseKeywords(row.keywords),
    aiOpinion: row.ai_opinion && row.ai_opinion !== 'N/A' ? row.ai_opinion : null,
    scoreDetails: row.score_details || null,
    
    // UI-specific fields
    rank: toNumber(row.rank, 0),
    hasRealImage,
    popularitySubtext: getPopularitySubtext(row),
  };
}

/**
 * Legacy UI compatibility adapter
 * Provides snake_case aliases for components that expect them
 */
export function legacyUiCompat(item: UiNewsItem): UiNewsItem {
  return {
    ...item,
    // Legacy snake_case aliases
    summary_en: item.summaryEn,
    video_id: item.videoId || undefined,
    channel: item.channelTitle || undefined,
    published_date: item.publishedAt || undefined,
    date: item.summaryDate || undefined,
    view_count: item.views,
    like_count: item.likes,
    comment_count: item.comments,
    popularity_score: item.popularityScore,
    popularity_score_precise: item.popularityScorePrecise,
    ai_image_url: item.isAIImage ? item.displayImageUrl : null,
    growth_rate: item.growthRate ? item.growthRate.toString() : null,
    auto_category: item.category,
    ai_image_prompt: item.aiImagePrompt,
    ai_opinion: item.aiOpinion,
    score_details: item.scoreDetails,
    view_details: {
      views: item.views.toString(),
      growth_rate: item.growthRate?.toString() || '0',
      platform_mentions: item.platformMentions || '0',
      matched_keywords: item.keywords.join(', '),
      ai_opinion: item.aiOpinion || '',
      score: item.popularityScorePrecise.toString()
    }
  } as any;
}

/**
 * Batch processing helpers
 */
export function mapDbRowsToUi(rows: DbNewsRow[]): UiNewsItem[] {
  return rows.map(mapDbToUi);
}

export function applyLegacyCompat(items: UiNewsItem[]): UiNewsItem[] {
  return items.map(legacyUiCompat);
}

/**
 * Export getPopularitySubtext for use in components
 */
export { getPopularitySubtext };
