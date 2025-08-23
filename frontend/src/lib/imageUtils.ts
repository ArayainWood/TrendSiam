/**
 * Image utility functions for cache-busting and fallback handling
 */

/**
 * Adds cache-busting query parameter to image URLs to ensure fresh images
 * @param imageUrl - The original image URL
 * @returns The image URL with cache-busting parameter
 */
export function addCacheBusting(imageUrl: string): string {
  if (!imageUrl) return imageUrl
  
  // Add timestamp as query parameter to force cache refresh
  const separator = imageUrl.includes('?') ? '&' : '?'
  return `${imageUrl}${separator}ts=${Date.now()}`
}

/**
 * Handles image load errors by hiding the parent container
 * @param event - The image error event
 */
export function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
  const img = event.currentTarget
  const container = img.parentElement
  if (container) {
    container.style.display = 'none'
  }
}

/**
 * Normalizes AI image URLs to proper format with cache-busting
 * Handles all DB shapes: filename only, relative paths, and full URLs
 * Prioritizes Supabase Storage URLs as the primary source
 * @param imageUrl - The original AI image URL in any format
 * @returns Normalized URL with cache-busting, or empty string if invalid
 */
export function getFreshAIImageUrl(imageUrl: string | undefined | null): string {
  // Return empty string for any falsy values to trigger placeholder handling
  if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined' || imageUrl.trim() === '') return ''
  
  // Trim whitespace
  const trimmedUrl = imageUrl.trim()
  
  // Case 1: Already a full Supabase Storage URL - use as-is
  if (trimmedUrl.startsWith('https://') && trimmedUrl.includes('supabase.co/storage/')) {
    // Add cache-busting to Supabase URLs
    return addCacheBusting(trimmedUrl)
  }
  
  // Case 2: Full HTTPS URL (non-Supabase) - use as-is
  if (trimmedUrl.startsWith('https://') || trimmedUrl.startsWith('http://')) {
    return addCacheBusting(trimmedUrl)
  }
  
  // Case 3: Legacy local path - fallback only
  if (trimmedUrl.startsWith('/ai_generated_images/')) {
    console.warn('Legacy local image path detected:', trimmedUrl)
    return addCacheBusting(trimmedUrl)
  }
  
  // Case 4: Any other format - log error and return empty
  console.error('Invalid AI image URL format:', trimmedUrl)
  return ''
}

/**
 * Placeholder image URL for when AI generation is not available
 */
export const PLACEHOLDER_IMAGE_URL = '/placeholder-image.svg'

/**
 * Check if an image URL is valid and should be displayed
 * @param imageUrl - The image URL to check
 * @returns True if the image should be displayed
 */
export function isValidImageUrl(imageUrl: string | undefined | null): boolean {
  if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined' || imageUrl === '') return false
  
  // Check for placeholder or invalid URLs
  if (imageUrl.includes('placeholder') || imageUrl === PLACEHOLDER_IMAGE_URL) return false
  
  return true
}

/**
 * Get the appropriate image source with fallback handling
 * @param aiImageUrl - The AI-generated image URL
 * @returns Valid image URL or placeholder
 */
export function getImageSrc(aiImageUrl: string | undefined | null): string {
  const normalizedUrl = getFreshAIImageUrl(aiImageUrl)
  return normalizedUrl && isValidImageUrl(normalizedUrl) ? normalizedUrl : PLACEHOLDER_IMAGE_URL
}