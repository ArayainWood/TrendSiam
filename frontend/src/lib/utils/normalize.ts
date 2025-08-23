/**
 * Normalization utilities for data consistency
 */

/**
 * Normalize text values, treating empty strings and placeholder text as null
 * @param value - The value to normalize
 * @returns Normalized string or null
 */
export function normalizeText(value: any): string | null {
  if (!value || typeof value !== 'string') return null;
  
  const trimmed = value.trim();
  const lowerCase = trimmed.toLowerCase();
  
  // Treat these as empty/null
  const emptyValues = ['', 'n/a', 'na', 'none', 'null', 'undefined', 'no analysis available', 'not available'];
  
  if (emptyValues.includes(lowerCase)) {
    return null;
  }
  
  return trimmed;
}

/**
 * Prefer first non-null value
 * @param primary - Primary value
 * @param fallback - Fallback value
 * @returns First non-null value
 */
export function prefer<T>(primary: T | null | undefined, fallback: T | null | undefined): T | null {
  if (primary !== null && primary !== undefined) {
    return primary;
  }
  return fallback !== null && fallback !== undefined ? fallback : null;
}

/**
 * Map auxiliary fields from flat structure to view_details structure
 * This ensures compatibility with components expecting nested structure
 */
export function mapToViewDetails(item: any): any {
  // If view_details already exists and has data, preserve it
  const existingViewDetails = item.view_details || {};
  
  // Create view_details from root-level fields
  const viewDetails = {
    views: item.view_count || existingViewDetails.views || '0',
    growth_rate: normalizeText(item.growth_rate) || normalizeText(existingViewDetails.growth_rate) || 'N/A',
    platform_mentions: normalizeText(item.platform_mentions) || normalizeText(existingViewDetails.platform_mentions) || 'N/A',
    matched_keywords: item.keywords || existingViewDetails.matched_keywords || '[]',
    ai_opinion: normalizeText(item.ai_opinion) || normalizeText(existingViewDetails.ai_opinion) || 'N/A',
    score: normalizeText(item.score_details) || normalizeText(existingViewDetails.score) || 'N/A'
  };
  
  return {
    ...item,
    view_details: viewDetails,
    // Also ensure root-level fields are normalized
    growth_rate: normalizeText(item.growth_rate),
    platform_mentions: normalizeText(item.platform_mentions),
    keywords: item.keywords,
    ai_opinion: normalizeText(item.ai_opinion),
    score_details: normalizeText(item.score_details)
  };
}

/**
 * Merge auxiliary fields from snapshot into news item
 * Used for server-side fallback when fields are missing
 */
export function mergeWithSnapshot(newsItem: any, snapshot: any): any {
  if (!snapshot) return newsItem;
  
  return {
    ...newsItem,
    // Merge auxiliary fields
    ai_opinion: prefer(newsItem.ai_opinion, snapshot.ai_opinion),
    score_details: prefer(newsItem.score_details, snapshot.score_details),
    keywords: newsItem.keywords || snapshot.keywords || '[]',
    growth_rate: prefer(newsItem.growth_rate, snapshot.growth_rate),
    platform_mentions: prefer(newsItem.platform_mentions, snapshot.platform_mentions),
    // Don't override primary fields
    view_count: newsItem.view_count || snapshot.view_count,
    like_count: newsItem.like_count || snapshot.like_count,
    comment_count: newsItem.comment_count || snapshot.comment_count
  };
}
