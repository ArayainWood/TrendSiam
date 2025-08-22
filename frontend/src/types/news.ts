/**
 * News and Analysis Type Definitions
 * 
 * Defines types for news items with analysis capabilities
 * Used across API endpoints, stores, and UI components
 */

export type AnalysisBlock = {
  text?: string;          // plain text or markdown
  html?: string;          // optional pre-rendered safe HTML
  bullets?: string[];     // optional bullet points
};

export interface NewsItemAnalysis {
  // Core fields from existing NewsItem
  id: string;
  title: string;
  summary: string;
  summary_en: string;
  auto_category: string;
  platform: string;
  video_id: string;
  popularity_score: number;
  popularity_score_precise: number;
  published_date: string;
  description: string;
  channel: string;
  view_count: string;
  like_count: string;
  comment_count: string;
  reason: string;
  
  // AI & Image fields
  ai_image_url?: string;
  ai_image_prompt?: string;
  
  // View details (existing analytics)
  view_details: {
    views: string;
    growth_rate: string;
    platform_mentions: string;
    matched_keywords: string;
    ai_opinion: string;
    score: string;
  };
  
  // NEW: Additional Analysis field
  analysis?: AnalysisBlock | string | null;
  
  // System fields
  rank: string | number;
  duration: string;
  raw_view?: string;
  growth_rate?: string;
  platform_mentions?: string;
  keywords?: string;
  ai_opinion?: string;
  score_details?: string;
  date?: string;
  created_at?: string;
  updated_at?: string;
  views?: number;
}

// For backward compatibility, extend existing NewsItem
export interface NewsItemWithAnalysis extends NewsItemAnalysis {}

// Analysis response from API
export interface AnalysisApiResponse {
  analysis?: AnalysisBlock | string | null;
  source: 'database' | 'computed' | 'fallback';
  confidence?: number;
}
