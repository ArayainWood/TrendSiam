/**
 * Weekly Report TypeScript Definitions
 * 
 * Strict types to prevent arbitrary string sources and ensure type safety
 */

export type WeeklySource = 'supabase' | 'json-fallback' | 'db' | 'json' | 'public-view' | 'error';

export interface WeeklyStory {
  id: string;
  title: string;
  summary?: string;
  category: string;
  platform: string;
  published_at: string;
  popularity_score: number;
  popularity_score_precise?: number;
  ai_image_url?: string;
  video_id?: string;
  channel_title?: string;
  view_count?: number;
  like_count?: number;
  rank?: number;
  story_id?: string;
  auto_category?: string;
  date?: string;
  image_status?: 'ready' | 'pending' | 'failed';
  summary_status?: 'ready' | 'pending' | 'failed';
}

export interface WeeklyMetrics {
  totalStories: number;
  avgScore: number;
  categoryDistribution: Record<string, number>;
  imagesCoverage: number;
  summariesCoverage: number;
  timeRange: string;
}

export interface WeeklyApiResponse {
  success: boolean;
  source: WeeklySource;
  origin?: string;
  items: WeeklyStory[];
  metrics: WeeklyMetrics;
  generatedAt: string;
  dataVersion: string;
  totalCount?: number;
  filteredCount?: number;
  limit?: number;
  error?: string;
}

export interface WeeklyData {
  items: WeeklyStory[];
  metrics: WeeklyMetrics;
  generatedAt: string;
  dataVersion: string;
  source: WeeklySource;
}

// API Headers for instrumentation
export interface ApiHeaders {
  'X-TS-API': string;
  'X-TS-Source': WeeklySource;
  'X-TS-Processing-Time': string;
  'X-TS-Generation-Time'?: string;
  'Cache-Control': string;
}

// Font resolver types
export interface ThaiFontPaths {
  REG: string;
  BOLD: string;
  base: string;
}

// Health check response
export interface HealthCheckResponse {
  ok: boolean;
  timestamp: string;
  database?: {
    connected: boolean;
    viewExists: boolean;
    rowCount?: number;
  };
  error?: string;
}
