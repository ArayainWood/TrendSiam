/**
 * Business Rules and Constants
 * 
 * Centralized configuration for all thresholds, limits, and business logic
 * to ensure consistency across the application and eliminate hardcoding.
 */

// =============================================
// AI IMAGE RULES
// =============================================
export const AI_IMAGE_RULES = {
  // Number of top stories that get AI-generated images
  TOP_STORIES_COUNT: 3,
  
  // Image file size validation
  MIN_IMAGE_SIZE_BYTES: 15 * 1024, // 15KB minimum
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_BACKOFF_SECONDS: 2.0,
} as const;

// =============================================
// PLATFORM ALIASES AND NORMALIZATION
// =============================================
export const PLATFORM_ALIASES: Record<string, string> = {
  // YouTube variants
  'youtube': 'YouTube',
  'yt': 'YouTube',
  'primary platform only': 'YouTube',
  'youtube only': 'YouTube',
  
  // Facebook variants
  'facebook': 'Facebook',
  'fb': 'Facebook',
  'fb.com': 'Facebook',
  
  // Instagram variants
  'instagram': 'Instagram',
  'ig': 'Instagram',
  'insta': 'Instagram',
  
  // Twitter/X variants
  'twitter': 'Twitter/X',
  'x': 'Twitter/X',
  'twitter/x': 'Twitter/X',
  'x.com': 'Twitter/X',
  
  // TikTok variants
  'tiktok': 'TikTok',
  'tik tok': 'TikTok',
  
  // Other platforms
  'spotify': 'Spotify',
  'apple music': 'Apple Music',
  'applemusic': 'Apple Music',
  'twitch': 'Twitch',
  'weibo': 'Weibo',
  'bilibili': 'Bilibili',
  'line': 'Line',
  'ไลน์': 'Line',
  
  // Special cases
  'multiple platforms': 'Multiple Platforms',
  'all platforms': 'Multiple Platforms',
  'ทุกแพลตฟอร์ม': 'Multiple Platforms',
  'streaming platforms': 'Multiple Platforms',
} as const;

// Canonical platform names (for validation)
export const CANONICAL_PLATFORMS = [
  'YouTube',
  'Facebook', 
  'Instagram',
  'Twitter/X',
  'TikTok',
  'Spotify',
  'Apple Music',
  'Twitch',
  'Weibo',
  'Bilibili',
  'Line',
  'Multiple Platforms'
] as const;

// =============================================
// POPULARITY SCORE THRESHOLDS
// =============================================
export const POPULARITY_THRESHOLDS = {
  VIRAL: 80,      // Score >= 80
  TRENDING: 60,   // Score >= 60
  POPULAR: 40,    // Score >= 40
  RISING: 0,      // Score < 40
} as const;

export const POPULARITY_LABELS = {
  VIRAL: 'Viral',
  TRENDING: 'Trending', 
  POPULAR: 'Popular',
  RISING: 'Rising',
} as const;

// =============================================
// GROWTH RATE THRESHOLDS
// =============================================
export const GROWTH_RATE_THRESHOLDS = {
  VIRAL: 100000,      // >100K views/day
  HIGH_GROWTH: 10000, // >10K views/day
  GROWING: 1000,      // >1K views/day
  POSITIVE: 0,        // Any positive growth
} as const;

export const GROWTH_RATE_LABELS = {
  VIRAL: 'Viral (>100K/day)',
  HIGH_GROWTH: 'High Growth (>10K/day)',
  GROWING: 'Growing (>1K/day)',
} as const;

// =============================================
// ENGAGEMENT RATE THRESHOLDS
// =============================================
export const ENGAGEMENT_THRESHOLDS = {
  HIGH: 5.0,    // Like rate >= 5%
  MEDIUM: 2.0,  // Like rate >= 2%
  LOW: 0,       // Like rate < 2%
} as const;

// =============================================
// VIEW COUNT FORMATTING
// =============================================
export const VIEW_THRESHOLDS = {
  MILLION: 1000000,
  THOUSAND: 1000,
} as const;

export const ENGAGEMENT_LABELS = {
  HIGH: 'High engagement',
  MEDIUM: 'Medium engagement',
  LOW: 'Low engagement',
} as const;

// =============================================
// DISPLAY LIMITS
// =============================================
export const DISPLAY_LIMITS = {
  // Maximum keywords to show
  MAX_KEYWORDS_DISPLAY: 6,
  MAX_KEYWORDS_CARD: 4,
  
  // Default items per page
  DEFAULT_PAGE_SIZE: 20,
  
  // Title/summary truncation
  TITLE_MAX_LENGTH: 150,
  SUMMARY_PREVIEW_LENGTH: 200,
} as const;

// =============================================
// TIME WINDOWS
// =============================================
export const TIME_WINDOWS = {
  // Auto-refresh interval (milliseconds)
  AUTO_REFRESH_INTERVAL: 30000, // 30 seconds
  
  // Data freshness windows (hours)
  TODAY_WINDOW_HOURS: 24,
  RECENT_WINDOW_HOURS: 48,
  FALLBACK_WINDOW_DAYS: 7,
} as const;

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Get popularity label based on score
 */
export function getPopularityLabel(score: number): string {
  if (score >= POPULARITY_THRESHOLDS.VIRAL) return POPULARITY_LABELS.VIRAL;
  if (score >= POPULARITY_THRESHOLDS.TRENDING) return POPULARITY_LABELS.TRENDING;
  if (score >= POPULARITY_THRESHOLDS.POPULAR) return POPULARITY_LABELS.POPULAR;
  return POPULARITY_LABELS.RISING;
}

/**
 * Get growth rate label based on rate
 */
export function getGrowthRateLabel(rate: number | null): string | null {
  if (rate === null || rate === undefined) return null;
  if (rate >= GROWTH_RATE_THRESHOLDS.VIRAL) return GROWTH_RATE_LABELS.VIRAL;
  if (rate >= GROWTH_RATE_THRESHOLDS.HIGH_GROWTH) return GROWTH_RATE_LABELS.HIGH_GROWTH;
  if (rate >= GROWTH_RATE_THRESHOLDS.GROWING) return GROWTH_RATE_LABELS.GROWING;
  if (rate > 0) return `+${rate.toFixed(1)}%`;
  return null;
}

/**
 * Get engagement label based on views and likes
 */
export function getEngagementLabel(views: number, likes: number): string {
  if (!views || views === 0) return ENGAGEMENT_LABELS.LOW;
  
  const likeRate = (likes / views) * 100;
  if (likeRate >= ENGAGEMENT_THRESHOLDS.HIGH) return ENGAGEMENT_LABELS.HIGH;
  if (likeRate >= ENGAGEMENT_THRESHOLDS.MEDIUM) return ENGAGEMENT_LABELS.MEDIUM;
  return ENGAGEMENT_LABELS.LOW;
}

/**
 * Check if a story should have an AI image based on rank
 */
export function shouldHaveAIImage(rank: number): boolean {
  return rank > 0 && rank <= AI_IMAGE_RULES.TOP_STORIES_COUNT;
}

/**
 * Calculate AI images count for a list of stories
 * Only counts AI images from Top 3 stories
 */
export function calculateAIImagesCount(stories: Array<{ rank?: number; isAIImage?: boolean }>): number {
  // Get the top 3 stories by rank or by position if no rank
  const sortedStories = [...stories].sort((a, b) => {
    const rankA = a.rank || stories.indexOf(a) + 1;
    const rankB = b.rank || stories.indexOf(b) + 1;
    return rankA - rankB;
  });
  
  // Take only the top 3 and count how many have AI images
  const top3 = sortedStories.slice(0, AI_IMAGE_RULES.TOP_STORIES_COUNT);
  return top3.filter(story => story.isAIImage === true).length;
}
