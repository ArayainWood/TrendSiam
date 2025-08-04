export interface NewsItem {
  rank: string | number
  title: string
  channel: string
  view_count: string // YouTube views (external)
  views?: number // Internal TrendSiam site views
  published_date: string
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
  ai_image_local?: string
  ai_image_url?: string
  ai_image_prompt?: string
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