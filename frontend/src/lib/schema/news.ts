/**
 * Central News Domain Schema
 * 
 * Single source of truth for news data types with proper numeric coercion
 * Ensures rank and other numeric fields are always numbers after parsing
 */

import { z } from 'zod'

// Base numeric coercion helper
const numericField = z.union([z.string(), z.number()]).pipe(z.coerce.number())
const optionalNumericField = z.union([z.string(), z.number(), z.null(), z.undefined()])
  .transform(val => val === null || val === undefined ? undefined : Number(val))
  .optional()

// View details schema
const ViewDetailsSchema = z.object({
  views: z.string(),
  growth_rate: z.string(), 
  platform_mentions: z.string(),
  matched_keywords: z.string(),
  ai_opinion: z.string(),
  score: z.string()
})

// Analysis schema (flexible format)
const AnalysisSchema = z.union([
  z.object({
    text: z.string().optional(),
    html: z.string().optional(), 
    bullets: z.array(z.string()).optional()
  }),
  z.string(),
  z.null()
]).optional()

// Core NewsStory schema - normalized with numeric fields
export const NewsStorySchema = z.object({
  id: z.string().optional(),
  rank: optionalNumericField, // Always number | undefined after parsing
  title: z.string(),
  channel: z.string(),
  view_count: z.union([z.string(), z.number()]).nullable().optional(), // Can be string or normalized number
  views: optionalNumericField, // Internal TrendSiam views as number
  published_date: z.string(),
  date: z.string().optional(),
  video_id: z.string(),
  description: z.string(),
  duration: z.string(),
  like_count: z.union([z.string(), z.number()]).nullable().optional(), // Can be string or normalized number
  comment_count: z.union([z.string(), z.number()]).nullable().optional(), // Can be string or normalized number
  summary: z.string(),
  summary_en: z.string(),
  popularity_score: numericField, // Always number after parsing
  popularity_score_precise: numericField, // Always number after parsing
  reason: z.string(),
  view_details: ViewDetailsSchema,
  auto_category: z.string(),
  platform: z.string(),
  ai_image_local: z.string().optional(),
  ai_image_url: z.string().nullable().optional(),
  ai_image_prompt: z.string().nullable().optional(),
  display_image_url: z.string().nullable().optional(),
  // Normalized fields (added by normalizeNewsItem)
  is_ai_image: z.boolean().optional(),
  scorePrecise: z.number().optional(),
  scoreRounded: z.number().optional(),
  growth_rate: z.number().nullable().optional(),
  analysis: AnalysisSchema
})

// Legacy NewsItem schema - for backward compatibility during migration
export const NewsItemSchema = z.object({
  id: z.string().optional(),
  rank: z.union([z.string(), z.number()]), // Keep flexible for legacy data
  title: z.string(),
  channel: z.string(),
  view_count: z.union([z.string(), z.number()]).nullable().optional(), // Can be string or normalized number
  views: optionalNumericField,
  published_date: z.string(),
  date: z.string().optional(),
  video_id: z.string(),
  description: z.string(),
  duration: z.string(),
  like_count: z.union([z.string(), z.number()]).nullable().optional(), // Can be string or normalized number
  comment_count: z.union([z.string(), z.number()]).nullable().optional(), // Can be string or normalized number
  summary: z.string(),
  summary_en: z.string(),
  popularity_score: z.number(),
  popularity_score_precise: z.number(),
  reason: z.string(),
  view_details: ViewDetailsSchema,
  auto_category: z.string(),
  platform: z.string(),
  ai_image_local: z.string().optional(),
  ai_image_url: z.string().nullable().optional(),
  ai_image_prompt: z.string().nullable().optional(),
  display_image_url: z.string().nullable().optional(),
  // Normalized fields (added by normalizeNewsItem)
  is_ai_image: z.boolean().optional(),
  scorePrecise: z.number().optional(),
  scoreRounded: z.number().optional(),
  growth_rate: z.number().nullable().optional(),
  analysis: AnalysisSchema
})

// Supabase database row schema
export const NewsTrendSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  summary_en: z.string().nullable(),
  platform: z.string().nullable(),
  popularity_score: optionalNumericField,
  popularity_score_precise: optionalNumericField,
  date: z.string().nullable(),
  category: z.string().nullable(),
  ai_image_url: z.string().nullable(),
  ai_image_prompt: z.string().nullable(),
  video_id: z.string().nullable(),
  channel: z.string().nullable(),
  view_count: z.string().nullable(),
  published_date: z.string().nullable(),
  description: z.string().nullable(),
  duration: z.string().nullable(),
  like_count: z.string().nullable(),
  comment_count: z.string().nullable(),
  reason: z.string().nullable(),
  raw_view: z.string().nullable(),
  growth_rate: z.string().nullable(),
  platform_mentions: z.string().nullable(),
  keywords: z.string().nullable(),
  ai_opinion: z.string().nullable(),
  score_details: z.string().nullable(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
})

// Export TypeScript types derived from schemas
export type NewsStory = z.infer<typeof NewsStorySchema>
export type NewsItem = z.infer<typeof NewsItemSchema>
export type NewsTrend = z.infer<typeof NewsTrendSchema>

// Parsing functions with error handling
export function parseNewsStory(data: unknown): NewsStory {
  return NewsStorySchema.parse(data)
}

export function parseNewsItem(data: unknown): NewsItem {
  return NewsItemSchema.parse(data)
}

export function parseNewsTrend(data: unknown): NewsTrend {
  return NewsTrendSchema.parse(data)
}

// Safe parsing functions that return null on error
export function safeParseNewsStory(data: unknown): NewsStory | null {
  const result = NewsStorySchema.safeParse(data)
  return result.success ? result.data : null
}

export function safeParseNewsItem(data: unknown): NewsItem | null {
  const result = NewsItemSchema.safeParse(data)
  return result.success ? result.data : null
}

// Conversion function: NewsItem -> NewsStory (normalize numeric fields)
export function newsItemToStory(item: NewsItem): NewsStory {
  return NewsStorySchema.parse({
    ...item,
    rank: typeof item.rank === 'string' ? parseFloat(item.rank) || undefined : item.rank
  })
}

// Safe conversion function: NewsItem -> NewsStory (returns null on error)
export function safeNewsItemToStory(item: NewsItem): NewsStory | null {
  const result = NewsStorySchema.safeParse({
    ...item,
    rank: typeof item.rank === 'string' ? parseFloat(item.rank) || undefined : item.rank
  })
  return result.success ? result.data : null
}

// Array parsing helpers
export function parseNewsStories(data: unknown[]): NewsStory[] {
  return data.map(parseNewsStory)
}

export function parseNewsItems(data: unknown[]): NewsItem[] {
  return data.map(parseNewsItem)
}

// Safe array parsing
export function safeParseNewsStories(data: unknown[]): NewsStory[] {
  return data.map(safeParseNewsStory).filter((item): item is NewsStory => item !== null)
}

export function safeParseNewsItems(data: unknown[]): NewsItem[] {
  return data.map(safeParseNewsItem).filter((item): item is NewsItem => item !== null)
}
