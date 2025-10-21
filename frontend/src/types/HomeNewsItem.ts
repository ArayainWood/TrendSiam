import { z } from 'zod'

// ---- ROBUST PAYLOAD NORMALIZER ----

// Core HomeNewsItem schema - flexible for API mapping
export const HomeNewsItemSchema = z.object({
  // Core required fields
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string(),
  
  // Dates - flexible
  sortDate: z.string().nullable().optional(),
  sort_date: z.string().nullable().optional(), // raw from DB
  
  // Popularity and ranking - flexible
  popularityScore: z.number().default(0),
  popularity_score: z.number().optional(), // raw from DB
  popularityScorePrevious: z.number().nullable().optional(),
  popularity_score_previous: z.number().nullable().optional(), // raw from DB
  
  // Growth metrics - nullable safe
  growthRateNum: z.number().nullable().optional(),
  growth_rate_num: z.number().nullable().optional(), // raw from DB
  growthRateLabel: z.string().default('Not enough data'),
  growth_rate_label: z.string().optional(), // raw from DB
  
  // Top-3 flags (computed by view) - flexible
  isTop3: z.boolean().default(false),
  is_top3: z.boolean().optional(), // raw from DB
  showImage: z.boolean().default(false),
  show_image: z.boolean().optional(), // raw from DB
  showAiPrompt: z.boolean().default(false),
  show_ai_prompt: z.boolean().optional(), // raw from DB
  imageUrl: z.string().nullable().optional(),
  display_image_url: z.string().nullable().optional(), // raw from DB
  
  // Engagement metrics - nullable safe
  views: z.number().nullable().optional(),
  likes: z.number().nullable().optional(),
  comments: z.number().nullable().optional(),
  view_count: z.string().nullable().optional(), // raw field from DB
  like_count: z.string().nullable().optional(), // raw field from DB
  comment_count: z.string().nullable().optional(), // raw field from DB
  
  // Additional fields
  summary: z.string().optional(),
  summary_en: z.string().optional(),
  category: z.string().optional(),
  platform: z.string().optional(),
  channel: z.string().optional(),
  video_id: z.string().optional(),
  rank_today: z.number().optional(),
  rank: z.number().optional(), // legacy alias
  
  // Raw image fields
  ai_image_url: z.string().nullable().optional(),
  ai_image_prompt: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  
  // Additional dates
  published_at: z.string().optional(),
  published_date: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  summary_date: z.string().optional(),
  
  // Additional fields
  reason: z.string().optional(),
  keywords: z.string().optional(),
  ai_opinion: z.string().optional(),
  external_id: z.string().optional(),
  
  // Legacy compatibility fields
  viewCount: z.number().nullable().optional(),
  
  // Debug field
  debug: z.any().optional(),
}).passthrough() // Allow additional fields

export type HomeNewsItem = z.infer<typeof HomeNewsItemSchema>

// Standardized API Response schema - matches the new API shape exactly
export const HomeApiResponseSchema = z.object({
  data: z.array(HomeNewsItemSchema),
  top3Ids: z.array(z.union([z.string(), z.number()])),
  meta: z.object({
    updatedAt: z.string(),
    error: z.string().optional(),
    message: z.string().optional(),
  }).optional(),
  debug: z.object({
    count: z.number(),
    nullablePrev: z.number(),
    top3Count: z.number().optional(),
    showImageCount: z.number().optional(),
    showAiPromptCount: z.number().optional(),
    availableColumns: z.array(z.string()).optional(),
    errorDetails: z.string().optional(),
    code: z.string().optional(),
    validationErrors: z.any().optional(),
    hint: z.string().optional(),
  }).optional(),
})

export type HomeApiResponse = z.infer<typeof HomeApiResponseSchema>

// ---- TIMEZONE-SAFE UTILITIES ----

function isoDayKey(iso: string): string {
  try {
    const d = new Date(iso);
    // UTC day key YYYY-MM-DD
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
  } catch {
    // Fallback for invalid dates
    return new Date().toISOString().split('T')[0] || '';
  }
}

export function filterLatestDay(items: HomeNewsItem[]): HomeNewsItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  
  console.log('[filterLatestDay] Input items:', items.length);
  
  // Find the item with the latest sortDate
  const latest = items.reduce((a, b) => {
    const dateA = new Date(a.sortDate || a.sort_date || a.summary_date || a.created_at || 0);
    const dateB = new Date(b.sortDate || b.sort_date || b.summary_date || b.created_at || 0);
    return dateA > dateB ? a : b;
  });
  
  const latestDateStr = latest.sortDate || latest.sort_date || latest.summary_date || latest.created_at;
  if (!latestDateStr) {
    console.log('[filterLatestDay] No date info found, returning all items');
    return items; // No date info, return all
  }
  
  const key = isoDayKey(latestDateStr);
  console.log('[filterLatestDay] Latest date key:', key, 'from date:', latestDateStr);
  
  const filtered = items.filter(item => {
    const itemDateStr = item.sortDate || item.sort_date || item.summary_date || item.created_at;
    const itemKey = itemDateStr ? isoDayKey(itemDateStr) : null;
    const matches = itemKey === key;
    if (!matches && itemDateStr) {
      console.log('[filterLatestDay] Item filtered out:', { itemKey, expectedKey: key, date: itemDateStr });
    }
    return matches;
  });
  
  console.log('[filterLatestDay] Filtered to:', filtered.length, 'items');
  
  // CRITICAL: If timezone filtering results in empty array, return all items as fallback
  if (filtered.length === 0 && items.length > 0) {
    console.warn('[filterLatestDay] ⚠️ Timezone filter resulted in empty array, returning all items as fallback');
    return items;
  }
  
  return filtered;
}

// ---- ROBUST PAYLOAD NORMALIZER ----

const ItemsArray = z.array(HomeNewsItemSchema);

export function normalizeHomePayload(payload: any): {
  data: HomeNewsItem[];
  top3Ids: string[];
  meta?: any;
  debug?: any;
} {
  console.log('[normalizeHomePayload] Input payload type:', typeof payload, 'isArray:', Array.isArray(payload));
  
  // Accept either { data: [...] } or raw [...]
  const rawList = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload) ? payload : [];

  console.log('[normalizeHomePayload] Raw list length:', rawList.length);

  const parsed = ItemsArray.safeParse(rawList);
  if (!parsed.success) {
    console.error("[normalizeHomePayload] validation_error:", parsed.error.issues);
    // Return empty but valid structure
    return { 
      data: [], 
      top3Ids: [], 
      meta: payload?.meta, 
      debug: { 
        ...payload?.debug, 
        validationError: parsed.error.issues,
        rawListLength: rawList.length,
        rawListType: typeof rawList
      } 
    };
  }

  console.log('[normalizeHomePayload] Successfully parsed', parsed.data.length, 'items');

  // Prefer server-provided top3Ids; otherwise compute from parsed data
  const top3Ids = Array.isArray(payload?.top3Ids) && payload.top3Ids.length > 0
    ? payload.top3Ids.map((id: any) => String(id))
    : parsed.data
        .filter(it => it.isTop3)
        .map(it => String(it.id))
        .slice(0, 3);

  console.log('[normalizeHomePayload] Top3 IDs:', top3Ids);

  return {
    data: parsed.data,
    top3Ids,
    meta: payload?.meta,
    debug: payload?.debug,
  };
}

// Validation function
export function validateHomeApiResponse(response: any): { valid: boolean; errors?: string[] } {
  try {
    HomeApiResponseSchema.parse(response)
    return { valid: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: (error as any).errors.map((e: any) => `${e.path.join('.')}: ${e.message}`)
      }
    }
    return {
      valid: false,
      errors: ['Unknown validation error']
    }
  }
}

// Type guards
export function isHomeNewsItem(item: any): item is HomeNewsItem {
  try {
    HomeNewsItemSchema.parse(item)
    return true
  } catch {
    return false
  }
}
