/**
 * Shared types and utilities for Weekly Data
 * Used by both server-side data fetching and API routes
 */

export interface WeeklyStory {
  story_id: string;
  rank: number;
  title: string;
  summary: string;
  summary_en?: string;
  category: string;
  platform: string;
  video_id: string;
  popularity_score: number;
  popularity_score_precise: number;
  published_date: string;
  description: string;
  channel: string;
  view_count: string;
  like_count?: string;
  comment_count?: string;
  ai_image_url?: string;
  image_status?: string;
  image_updated_at?: string;
  ai_image_prompt?: string;
  summary_status?: string;
}

export interface WeeklyMetrics {
  totalStories: number;
  avgScore: number;
  categoryDistribution: Record<string, number>;
  imagesCoverage: number;
  summariesCoverage: number;
  timeRange: string;
}

export type DataSource = 'supabase' | 'json-fallback' | 'db' | 'json' | 'public-view' | 'error';

export interface WeeklyData {
  items: WeeklyStory[];
  metrics: WeeklyMetrics;
  generatedAt: string;
  dataVersion: string;
  source: DataSource;
}

/**
 * Calculate metrics from weekly stories
 */
export function calculateMetrics(items: WeeklyStory[]): WeeklyMetrics {
  const totalStories = items.length;
  const avgScore = totalStories > 0 
    ? items.reduce((sum, item) => sum + (item.popularity_score_precise || 0), 0) / totalStories 
    : 0;

  // Category distribution
  const categoryDistribution: Record<string, number> = {};
  items.forEach(item => {
    const category = item.category || 'Unknown';
    categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;
  });

  // Coverage metrics
  const itemsWithImages = items.filter(item => 
    item.ai_image_url && item.image_status === 'ready'
  ).length;
  const itemsWithSummaries = items.filter(item => 
    item.summary && item.summary_status === 'ready'
  ).length;

  const imagesCoverage = totalStories > 0 ? Math.round((itemsWithImages / totalStories) * 100) : 0;
  const summariesCoverage = totalStories > 0 ? Math.round((itemsWithSummaries / totalStories) * 100) : 0;

  return {
    totalStories,
    avgScore: Math.round(avgScore * 10) / 10,
    categoryDistribution,
    imagesCoverage,
    summariesCoverage,
    timeRange: 'Last 7 days'
  };
}
