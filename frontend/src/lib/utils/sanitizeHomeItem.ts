/**
 * Sanitizer for Home items to ensure data consistency
 * Handles edge cases like null/empty display_image_url before Zod validation
 */

/**
 * Sanitize display_image_url to ensure it's either a valid string or undefined
 * @param url - The raw URL value from database
 * @returns Sanitized URL string or undefined
 */
export function sanitizeImageUrl(url: any): string | undefined {
  // Handle null, undefined, empty string
  if (url === null || url === undefined || url === '') {
    return undefined;
  }
  
  // Handle non-string values
  if (typeof url !== 'string') {
    console.warn('[sanitizeImageUrl] Non-string image URL encountered:', typeof url);
    return undefined;
  }
  
  // Trim whitespace
  const trimmed = url.trim();
  if (trimmed === '') {
    return undefined;
  }
  
  return trimmed;
}

/**
 * Sanitize a raw home item before schema validation
 * @param item - Raw item from database/API
 * @returns Sanitized item ready for Zod validation
 */
export function sanitizeHomeItem(item: any): any {
  if (!item || typeof item !== 'object') {
    return item;
  }
  
  // Create a shallow copy to avoid mutations
  const sanitized = { ...item };
  
  // Sanitize display_image_url
  if ('display_image_url' in sanitized) {
    sanitized.display_image_url = sanitizeImageUrl(sanitized.display_image_url);
  }
  
  // Sanitize ai_image_url as well for consistency
  if ('ai_image_url' in sanitized) {
    sanitized.ai_image_url = sanitizeImageUrl(sanitized.ai_image_url);
  }
  
  return sanitized;
}

/**
 * Sanitize an array of home items
 * @param items - Array of raw items
 * @returns Array of sanitized items
 */
export function sanitizeHomeItems(items: any[]): any[] {
  if (!Array.isArray(items)) {
    return [];
  }
  
  return items.map(sanitizeHomeItem);
}
