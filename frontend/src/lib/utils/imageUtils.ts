/**
 * Image utility functions for handling AI-generated images
 */

/**
 * Pick the best available image URL for display
 * Priority: display_image_url > ai_image_url > null
 * 
 * @param row - The data row containing image URLs
 * @returns The selected image URL or null
 */
export function pickDisplayImage(row: {
  display_image_url?: string | null;
  ai_image_url?: string | null;
}): string | null {
  // 1. Try display_image_url first
  if (row.display_image_url && row.display_image_url.trim() !== '') {
    return row.display_image_url;
  }
  
  // 2. Fall back to ai_image_url
  if (row.ai_image_url && row.ai_image_url.trim() !== '') {
    return row.ai_image_url;
  }
  
  // 3. No image available
  return null;
}

/**
 * Check if a URL is valid and not empty
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return trimmed !== '' && trimmed !== 'null' && trimmed !== 'undefined';
}
