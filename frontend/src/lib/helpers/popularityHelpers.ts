/**
 * Popularity helpers for UI components
 * 
 * Provides canonical functions for formatting popularity data
 */

import { 
  ENGAGEMENT_THRESHOLDS, 
  ENGAGEMENT_LABELS, 
  GROWTH_RATE_THRESHOLDS, 
  VIEW_THRESHOLDS,
  getGrowthRateLabel 
} from '@/lib/constants/businessRules';
import type { UINewsItem } from '@/lib/normalizeNewsItem';

/**
 * Get popularity subtext for a UI news item
 * Returns a formatted string like: "High engagement • 11.8M+ views (like rate 10.2%) • Viral growth"
 */
export function getPopularitySubtext(item: UINewsItem): string {
  const parts = [];
  
  // Use the pre-computed popularitySubtext if available
  if (item.popularitySubtext) {
    return item.popularitySubtext;
  }
  
  // Otherwise compute it from the item's metrics
  const views = item.views || 0;
  const likes = item.likes || 0;
  const growthRate = item.growthRate;
  
  // Engagement level first (based on like rate)
  if (views > 0 && likes > 0) {
    const likeRate = (likes / views) * 100;
    if (likeRate >= ENGAGEMENT_THRESHOLDS.HIGH) {
      parts.push(ENGAGEMENT_LABELS.HIGH);
    } else if (likeRate >= ENGAGEMENT_THRESHOLDS.MEDIUM) {
      parts.push(ENGAGEMENT_LABELS.MEDIUM);
    } else {
      parts.push(ENGAGEMENT_LABELS.LOW);
    }
  }
  
  // Views with like rate in parentheses
  if (views > 0) {
    let viewsStr = '';
    if (views >= VIEW_THRESHOLDS.MILLION) {
      viewsStr = `${(views / VIEW_THRESHOLDS.MILLION).toFixed(1)}M+ views`;
    } else if (views >= VIEW_THRESHOLDS.THOUSAND) {
      viewsStr = `${(views / VIEW_THRESHOLDS.THOUSAND).toFixed(0)}K+ views`;
    } else {
      viewsStr = `${views} views`;
    }
    
    // Add like rate if available
    if (likes > 0) {
      const likeRate = ((likes / views) * 100).toFixed(1);
      viewsStr += ` (like rate ${likeRate}%)`;
    }
    parts.push(viewsStr);
  }
  
  // Growth indicator
  if (growthRate) {
    if (growthRate >= GROWTH_RATE_THRESHOLDS.VIRAL) {
      parts.push('Viral growth');
    } else if (growthRate >= GROWTH_RATE_THRESHOLDS.HIGH_GROWTH) {
      parts.push('Fast growth');
    } else if (growthRate >= GROWTH_RATE_THRESHOLDS.GROWING) {
      parts.push('Growing');
    }
  }
  
  return parts.join(' • ');
}

/**
 * Format popularity score with proper decimal places
 */
export function formatPopularityScore(score: number): string {
  return score.toFixed(1);
}

/**
 * Get color class for popularity score
 */
export function getPopularityColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Get background class for popularity score
 */
export function getPopularityBg(score: number): string {
  if (score >= 80) return 'bg-emerald-100 dark:bg-emerald-900/30';
  if (score >= 60) return 'bg-amber-100 dark:bg-amber-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
}

/**
 * Format growth rate with legacy-style labels
 */
export function formatGrowthRate(rate: number | null): string {
  const label = getGrowthRateLabel(rate);
  return label || '—';
}
