/**
 * Type definitions for Home page data
 */

/**
 * Structure of a news item as returned by the home data API
 */
export interface HomeItem {
  id: string;
  title: string;
  summary?: string | null;
  summary_en?: string | null;
  platform?: string | null;
  popularity_score?: number | string | null;
  popularity_score_precise: number; // Required for sorting
  view_count: string | number; // Required for secondary sort
  published_date?: string | null;
  created_at?: string | null;
  date?: string | null;
  category?: string | null;
  ai_image_url?: string | null;
  ai_image_prompt?: string | null;
  video_id?: string | null;
  channel?: string | null;
  description?: string | null;
  duration?: string | null;
  like_count?: string | number | null;
  comment_count?: string | number | null;
  reason?: string | null;
  raw_view?: string | null;
  growth_rate?: string | null;
  platform_mentions?: string | null;
  keywords?: string | null;
  ai_opinion?: string | null;
  score_details?: any;
  updated_at?: string | null;
}

/**
 * Type guard to check if an object is a valid HomeItem
 */
export function isHomeItem(obj: any): obj is HomeItem {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.popularity_score_precise === 'number' &&
    (typeof obj.view_count === 'string' || typeof obj.view_count === 'number')
  );
}
