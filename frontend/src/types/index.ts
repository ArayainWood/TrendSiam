export interface NewsItem {
  id?: string // Database ID
  rank: string | number
  title: string
  channel: string
  view_count: string // YouTube views (external)
  views?: number // Internal TrendSiam site views
  published_date: string
  date?: string // Date in YYYY-MM-DD format
  video_id: string
  description: string
  duration: string
  like_count: string
  comment_count: string
  summary: string
  summary_en: string
  popularity_score: number
  popularity_score_precise: number
  reason: string
  view_details: {
    views: string
    growth_rate: string
    platform_mentions: string
    matched_keywords: string
    ai_opinion: string
    score: string
  }
  auto_category: string
  platform: string
  ai_image_local?: string
  ai_image_url?: string | null
  ai_image_prompt?: string | null
  display_image_url?: string // [rank-sync-fix] Pre-resolved display image URL from server
  
  // NEW: Additional Analysis field
  analysis?: {
    text?: string;          // plain text or markdown
    html?: string;          // optional pre-rendered safe HTML
    bullets?: string[];     // optional bullet points
  } | string | null;
}

export interface FilterState {
  platform: string
  category: string
  date: string
  searchQuery: string
}

export interface ThemeConfig {
  mode: 'light' | 'dark'
  primaryColor: string
  accentColor: string
}

export interface LanguageConfig {
  code: 'th' | 'en'
  name: string
  flag: string
}

export interface UIState {
  developerMode: boolean
  currentPage: 'main' | 'weekly-report' | 'terms' | 'privacy' | 'legal'
  filters: FilterState
  language: LanguageConfig
  theme: ThemeConfig
}

export interface WeeklyReportData {
  totalStories: number
  avgViews: number
  categories: string[]
  topScore: number
  stories: NewsItem[]
  dateRange: {
    start: string
    end: string
  }
}

export interface APIResponse<T> {
  data: T
  success: boolean
  message?: string
  error?: string
}

export interface StatsData {
  totalNews: number
  avgPopularity: number
  topCategories: Array<{
    name: string
    count: number
  }>
  viewsRange: {
    min: number
    max: number
    avg: number
  }
}

// Supabase database interfaces with full metadata
export interface NewsTrend {
  id: string
  title: string
  summary: string | null
  summary_en: string | null
  platform: string | null
  popularity_score: number | null
  popularity_score_precise: number | null
  date: string | null
  category: string | null
  ai_image_url: string | null
  ai_image_prompt: string | null
  
  // Original metadata fields
  video_id: string | null
  channel: string | null
  view_count: string | null
  published_date: string | null
  description: string | null
  duration: string | null
  like_count: string | null
  comment_count: string | null
  reason: string | null
  
  // View details metadata
  raw_view: string | null
  growth_rate: string | null
  platform_mentions: string | null
  keywords: string | null
  ai_opinion: string | null
  score_details: string | null
  
  // System fields
  created_at?: string
  updated_at?: string
}

// Extended news trend interface for API responses
export interface NewsTrendWithMeta extends NewsTrend {
  rank?: number
  views?: number
}

// Re-export snapshot types for convenience
export type { SnapshotItem } from './snapshots';
export { toScoreString, toCountNumber, isSnapshotItem } from './snapshots';