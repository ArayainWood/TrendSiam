/**
 * Standardized types for Weekly Report Snapshot System
 * 
 * Single source of truth for snapshot item types used across:
 * - Weekly Report page
 * - PDF generator
 * - API responses
 */

/**
 * Canonical SnapshotItem type with all possible fields
 * Used for items stored in weekly_report_snapshots.items JSONB array
 */
export interface SnapshotItem {
  // Core identifiers
  id: string;
  rank: number;
  
  // Platform & source
  platform: 'YouTube' | 'X' | string;
  video_id?: string | null;
  url?: string | null;
  
  // Content
  title: string;
  channel?: string | null;
  category?: string | null;
  summary?: string | null;
  summary_en?: string | null;
  description?: string | null;
  
  // Keywords can be array or comma-separated string
  keywords?: string[] | string | null;
  
  // Images
  image_url?: string | null;
  ai_image_url?: string | null;
  ai_image_prompt?: string | null;
  
  // Dates - ISO strings
  published_at?: string | null;
  created_at?: string | null;
  ingested_at?: string | null;
  
  // Metrics - can be number or string from API
  view_count?: string | number | null;
  like_count?: string | number | null;
  comment_count?: string | number | null;
  
  // Scores - can be number or string
  popularity_score?: number | string | null;
  popularity_score_precise?: number | string | null;
  
  // Additional metadata
  score_details?: any;
  
  // Legacy/compatibility fields
  metrics?: {
    views?: number | string;
    likes?: number | string;
    comments?: number | string;
  } | null;
}

/**
 * Utility to convert score values to string
 * Handles null, undefined, NaN cases
 */
export function toScoreString(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '0';
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  
  return num.toString();
}

/**
 * Utility to convert view/like/comment counts to number
 * Handles string with commas, null, undefined
 */
export function toCountNumber(value: string | number | null | undefined): number {
  if (!value) return 0;
  
  if (typeof value === 'string') {
    // Remove commas and parse
    const cleaned = value.replace(/,/g, '');
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? 0 : num;
  }
  
  return value;
}

/**
 * Type guard to check if an object is a valid SnapshotItem
 */
export function isSnapshotItem(obj: any): obj is SnapshotItem {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.rank === 'number'
  );
}
