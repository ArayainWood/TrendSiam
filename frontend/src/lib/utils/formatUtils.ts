/**
 * Formatting utilities for Home page display
 */

/**
 * Humanize large numbers (11.8M, 1.2K format)
 */
export function humanize(n?: number | string | null): string {
  const num = typeof n === 'string' ? Number(n) || 0 : (n || 0);
  if (!num || !Number.isFinite(num)) return '0';
  if (num >= 1_000_000) return `${(num/1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num/1_000).toFixed(1)}K`;
  return `${num}`;
}

/**
 * Calculate like rate percentage
 */
export function likeRate(likes?: number | string | null, views?: number | string | null): number {
  const likeCount = typeof likes === 'string' ? Number(likes) || 0 : (likes || 0);
  const viewCount = typeof views === 'string' ? Number(views) || 0 : (views || 0);
  if (!viewCount || viewCount <= 0 || !likeCount || likeCount < 0) return 0;
  return Number(((likeCount / viewCount) * 100).toFixed(1));
}

/**
 * Get growth descriptor based on growth rate
 */
export function growthDescriptor(g?: number | null): string | null {
  if (g === null || g === undefined) return null;
  if (g >= 10) return 'Viral';
  if (g > 4) return 'Strong';
  if (g > 0) return 'Moderate';
  if (g === 0) return 'Flat';
  return 'Declining';
}

/**
 * Format growth rate with sign and percentage
 */
export function formatGrowthRate(g?: number | string | null): string {
  if (g === null || g === undefined) return 'N/A';
  
  // Handle string growth rates (legacy format)
  if (typeof g === 'string') {
    if (!g || g === 'N/A') return 'N/A';
    // Map to standardized display format
    if (g.includes('>100K/day') || g.includes('Viral')) {
      return 'Viral (>100K/day)';
    } else if (g.includes('≥10K/day') || g.includes('High')) {
      return 'High (≥10K/day)';
    } else if (g.includes('≥1K/day') || g.includes('Medium')) {
      return 'Medium (≥1K/day)';
    } else if (g.includes('Steady')) {
      return 'Steady';
    } else if (g.includes('New')) {
      return 'New (< 1 day)';
    }
    return g;
  }
  
  // Handle numeric growth rates
  const v = Number(g.toFixed(1));
  const sign = v > 0 ? '+' : v < 0 ? '–' : '';
  return `${sign}${Math.abs(v)}%`;
}

/**
 * Get growth rate color class
 */
export function getGrowthRateColor(g?: number | string | null): string {
  if (g === null || g === undefined) return 'text-zinc-400';
  
  // Handle string growth rates
  if (typeof g === 'string') {
    if (!g || g === 'N/A') return 'text-zinc-400';
    if (g.includes('Viral') || g.includes('High') || g.includes('Strong')) return 'text-emerald-400';
    if (g.includes('Declining')) return 'text-rose-400';
    return 'text-zinc-300';
  }
  
  // Handle numeric growth rates
  if (g > 0) return 'text-emerald-400';
  if (g < 0) return 'text-rose-400';
  return 'text-zinc-300';
}

/**
 * Get engagement label based on views and likes
 */
export function getEngagementLabel(views?: number | string | null, likes?: number | string | null): string {
  const rate = likeRate(likes, views);
  if (rate >= 8) return 'High engagement';
  if (rate >= 4) return 'Medium engagement';
  return 'Low engagement';
}
