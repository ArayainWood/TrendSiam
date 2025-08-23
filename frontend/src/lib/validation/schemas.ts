/**
 * Validation Schemas for API Endpoints
 * 
 * Uses Zod for runtime type checking and validation
 */

import { z } from 'zod';

// Common schemas
export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email();
export const urlSchema = z.string().url();
export const dateSchema = z.string().datetime();

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(['date', 'views', 'score']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// Search schema
export const searchSchema = z.object({
  q: z.string().min(1).max(100),
  category: z.string().optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});

// News item schema
export const newsItemSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  url: urlSchema,
  category: z.string(),
  source: z.string(),
  publishedAt: dateSchema,
  views: z.number().int().nonnegative().optional(),
  score: z.number().optional(),
  imageUrl: urlSchema.optional(),
  videoId: z.string().optional(),
});

// Revalidation schema
export const revalidateSchema = z.object({
  tag: z.enum(['home', 'weekly', 'all']),
  token: z.string().min(1),
});

// Environment configuration schema
export const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: urlSchema,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().startsWith('sk-').optional(),
  YOUTUBE_API_KEY: z.string().startsWith('AIza').optional(),
  REVALIDATE_SECRET: z.string().min(8).optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

// Request validation helpers
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map(e => `${e.path.join('.')}: ${e.message}`);
      return { success: false, error: messages.join(', ') };
    }
    return { success: false, error: 'Invalid request data' };
  }
}

// Async validation with custom logic
export async function validateWithRules<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  customRules?: (data: T) => Promise<string | null>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  // First validate schema
  const schemaResult = validateRequest(schema, data);
  if (!schemaResult.success) {
    return schemaResult;
  }
  
  // Then apply custom rules
  if (customRules) {
    const customError = await customRules(schemaResult.data);
    if (customError) {
      return { success: false, error: customError };
    }
  }
  
  return schemaResult;
}

// Sanitization helpers
export const sanitizeString = (str: string): string => {
  return str
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .slice(0, 1000); // Limit length
};

export const sanitizeUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    // Only allow http(s) protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    // Prevent localhost/private IPs in production
    if (process.env.NODE_ENV === 'production') {
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')
      ) {
        return null;
      }
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

// File path validation (prevent directory traversal)
export const sanitizeFilePath = (path: string): string | null => {
  // Remove any directory traversal attempts
  const cleaned = path.replace(/\.\./g, '').replace(/[\\\/]+/g, '/');
  
  // Must not start with / or contain suspicious patterns
  if (
    cleaned.startsWith('/') ||
    cleaned.includes('://') ||
    /[<>:"|?*\x00-\x1F]/.test(cleaned)
  ) {
    return null;
  }
  
  return cleaned;
};

// SQL injection prevention (for raw queries if needed)
export const sanitizeSqlIdentifier = (identifier: string): string => {
  // Only allow alphanumeric and underscore
  return identifier.replace(/[^a-zA-Z0-9_]/g, '');
};

// Export all schemas
export const schemas = {
  pagination: paginationSchema,
  search: searchSchema,
  newsItem: newsItemSchema,
  revalidate: revalidateSchema,
  env: envSchema,
} as const;
