/**
 * Database View Type Definitions
 * 
 * Strict types for all public views to ensure type safety
 * and prevent exposure of sensitive columns
 */

import { z } from 'zod';

// =============================================
// NEWS PUBLIC VIEW
// =============================================
export const NewsPublicViewSchema = z.object({
  // Core identifiers
  id: z.string(), // Changed from .uuid() to allow any string ID
  video_id: z.string().nullable(),
  external_id: z.string().nullable(),
  
  // Content fields
  title: z.string(),
  summary: z.string(),
  summary_en: z.string().nullable(),
  description: z.string().nullable(),
  category: z.string(),
  platform: z.string(),
  channel: z.string().nullable(),
  
  // Dates
  date: z.coerce.date().nullable(),
  published_date: z.coerce.date().nullable(),      // Actual column
  published_at: z.coerce.date().nullable(),        // Alias of published_date for compatibility
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  
  // Metrics - normalize to numbers
  view_count: z.coerce.number().nullable(),
  like_count: z.coerce.number().nullable(),
  comment_count: z.coerce.number().nullable(),
  duration: z.coerce.number().nullable(),
  
  // Scores
  popularity_score: z.coerce.number(),
  popularity_score_precise: z.coerce.number(),
  score: z.coerce.number(), // Computed COALESCE value
  
  // Image fields
  ai_image_url: z.string().nullable(),
  display_image_url: z.string().nullable(), // Alias of ai_image_url
  
  // Analysis fields
  reason: z.string().nullable(),
  keywords: z.union([
    z.string(),
    z.array(z.string()),
    z.null()
  ]).transform(val => {
    if (!val) return [];
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return [];
      }
    }
    return val;
  }),
  ai_opinion: z.string().nullable(),
  analysis: z.string().nullable(), // Alias of ai_opinion
  score_details: z.string().nullable(), // TEXT in DB
  view_details: z.record(z.string(), z.string()) // Computed jsonb object
});

export type NewsPublicView = z.infer<typeof NewsPublicViewSchema>;

// =============================================
// WEEKLY REPORT PUBLIC VIEW
// =============================================
export const WeeklyReportPublicViewSchema = z.object({
  snapshot_id: z.string().uuid(),
  status: z.literal('published'),
  range_start: z.coerce.date(),
  range_end: z.coerce.date(),
  built_at: z.coerce.date().nullable(),
  algo_version: z.string().nullable(),
  data_version: z.string().nullable(),
  items: z.array(z.any()), // jsonb array
  meta: z.record(z.string(), z.any()).nullable(), // jsonb object
  created_at: z.coerce.date()
});

export type WeeklyReportPublicView = z.infer<typeof WeeklyReportPublicViewSchema>;

// =============================================
// STORIES PUBLIC VIEW
// =============================================
export const StoriesPublicViewSchema = z.object({
  story_id: z.string(),          // Actual PK
  id: z.string(),                // Alias for backward compatibility
  source_id: z.string().nullable(),
  platform: z.string().nullable(),
  publish_time: z.coerce.date(),
  title: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  summary: z.string().nullable(),
  summary_en: z.string().nullable(),
  channel: z.string().nullable(),
  duration: z.coerce.number().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type StoriesPublicView = z.infer<typeof StoriesPublicViewSchema>;

// =============================================
// SNAPSHOTS PUBLIC VIEW
// =============================================
export const SnapshotsPublicViewSchema = z.object({
  id: z.string(), // Changed from .uuid() to allow hash IDs
  snapshot_id: z.string(),    // Alias of id
  story_id: z.string().nullable(),
  snapshot_date: z.coerce.date(),
  rank: z.coerce.number(),
  popularity_score: z.coerce.number(),
  popularity_score_precise: z.coerce.number().nullable(),
  score: z.coerce.number(),          // Computed value
  view_count: z.coerce.number().nullable(),
  like_count: z.coerce.number().nullable(),
  comment_count: z.coerce.number().nullable(),
  growth_rate: z.coerce.number().nullable(),
  platform_mentions: z.coerce.number().nullable(),
  keywords: z.union([
    z.string(),
    z.array(z.string()),
    z.null()
  ]).nullable(),
  matched_keywords: z.union([      // Alias of keywords
    z.string(),
    z.array(z.string()),
    z.null()
  ]).nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type SnapshotsPublicView = z.infer<typeof SnapshotsPublicViewSchema>;

// =============================================
// WEEKLY PUBLIC VIEW (Legacy)
// =============================================
export const WeeklyPublicViewSchema = z.object({
  // All fields from news_public_v
  id: z.string(), // Changed from .uuid() to allow hash IDs
  video_id: z.string().nullable(),
  title: z.string(),
  summary: z.string(),
  summary_en: z.string().nullable(),
  platform: z.string(),
  category: z.string(),
  popularity_score: z.coerce.number(),
  popularity_score_precise: z.coerce.number(),
  score: z.coerce.number(),
  date: z.coerce.date().nullable(),
  published_date: z.coerce.date().nullable(),
  published_at: z.coerce.date().nullable(),
  description: z.string().nullable(),
  channel: z.string().nullable(),
  view_count: z.coerce.number().nullable(),
  like_count: z.coerce.number().nullable(),
  comment_count: z.coerce.number().nullable(),
  duration: z.coerce.number().nullable(),
  reason: z.string().nullable(),
  keywords: z.union([z.string(), z.array(z.string()), z.null()]),
  score_details: z.string().nullable(),
  ai_image_url: z.string().nullable(),
  display_image_url: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  ai_opinion: z.string().nullable(),
  analysis: z.string().nullable(),
  view_details: z.record(z.string(), z.string()),
  
  // Additional computed fields
  views: z.coerce.number().nullable(),
  published_at_date: z.coerce.date().nullable()
});

export type WeeklyPublicView = z.infer<typeof WeeklyPublicViewSchema>;

// =============================================
// UTILITY TYPES
// =============================================

// Home page item with normalized fields
export interface HomeNewsItem {
  id: string;
  rank: number;
  title: string;
  summary: string;
  summary_en: string | null;
  category: string;
  platform: string;
  video_id: string | null;
  channel: string | null;
  description: string | null;
  popularity_score: number;
  popularity_score_precise: number;
  published_at: string | null;
  created_at: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  ai_image_url: string | null;
  display_image_url: string | null;
  keywords: string[];
  score_details: string | null;
  analysis?: string | null;
  view_details?: {
    views: string;
    growth_rate: string;
    platform_mentions: string;
    matched_keywords: string;
    ai_opinion: string;
    score: string;
  };
}

// Type guard helpers
export function isNewsPublicView(obj: unknown): obj is NewsPublicView {
  return NewsPublicViewSchema.safeParse(obj).success;
}

export function isWeeklyReportPublicView(obj: unknown): obj is WeeklyReportPublicView {
  return WeeklyReportPublicViewSchema.safeParse(obj).success;
}

// Strong typing for reducers
export function sumScores(items: Array<{ score?: string | number | null }>): number {
  return items.reduce<number>((sum, item) => {
    const score = typeof item.score === 'string' ? parseFloat(item.score) : Number(item.score ?? 0);
    return sum + (Number.isFinite(score) ? score : 0);
  }, 0);
}

export function countTotalStories(snapshot: { items?: any[] } | null): number {
  if (!snapshot || !Array.isArray(snapshot.items)) return 0;
  return snapshot.items.length;
}