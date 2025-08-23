/**
 * Centralized image policy for TrendSiam
 * Enforces "AI Images only for Top 3" rule across all components
 */

import { getFreshAIImageUrl } from './imageUtils'
import { isTop3 as isTop3Rank } from './ranking'

export interface NewsStory {
  rank?: number
  ai_image_url?: string | null
  display_image_url?: string | null
  youtube_thumbnail_url?: string | null
  [key: string]: any
}

export interface ImageSelection {
  src: string
  isAI: boolean
  hasImage: boolean
}

/**
 * Determines if a story is in the Top 3
 * @param story - The news story object
 * @param index - Optional: index in the list (0-based)
 * @param listContext - Optional: context about the list being rendered
 * @returns true if story should be treated as Top 3
 */
export function isTop3(story: NewsStory, index?: number, listContext?: string): boolean {
  // Use the centralized ranking utility which handles string/number conversion
  const isRankTop3 = isTop3Rank(story)
  if (isRankTop3) {
    return true
  }
  
  // Fallback to index-based detection (0, 1, 2 = Top 3)
  if (typeof index === 'number') {
    return index <= 2
  }
  
  // Default to false if we can't determine
  return false
}

/**
 * Selects the appropriate image for a story card based on Top 3 policy
 * @param story - The news story object
 * @param options - Configuration options
 * @returns Image selection with source, type, and availability info
 */
export function selectCardImage(
  story: NewsStory, 
  options: { isTop3: boolean }
): ImageSelection {
  const { isTop3: shouldShowAI } = options
  
  // For Top 3 stories, try AI image first
  if (shouldShowAI && story.ai_image_url) {
    const aiImageSrc = getFreshAIImageUrl(story.ai_image_url)
    if (aiImageSrc) {
      return {
        src: aiImageSrc,
        isAI: true,
        hasImage: true
      }
    }
  }
  
  // For Top-3 stories, also check display_image_url as it contains the same AI image
  if (shouldShowAI && story.display_image_url) {
    const displayImageSrc = getFreshAIImageUrl(story.display_image_url)
    if (displayImageSrc) {
      return {
        src: displayImageSrc,
        isAI: true,  // Mark as AI since Top-3 display_image_url is always AI
        hasImage: true
      }
    }
  }
  
  // For non-Top-3 or when no image available, use fallback
  const fallbackSrc = '/placeholder-image.svg'
  
  return {
    src: fallbackSrc,
    isAI: false,
    hasImage: false
  }
}

/**
 * Debug helper to log image selection decisions (REMOVE AFTER TESTING)
 * @param story - The news story
 * @param index - Index in list
 * @param component - Component name for debugging
 * @param selection - The image selection result
 */
export function debugImageSelection(
  story: NewsStory,
  index: number | undefined,
  component: string,
  selection: ImageSelection
): void {
  // TODO: Remove this debug function after testing is complete
  if (process.env.NODE_ENV === 'development') {
    console.debug(`🖼️ [${component}] Image Selection:`, {
      id: story.video_id || story.id,
      rank: story.rank,
      index,
      ai_image_url: story.ai_image_url,
      youtube_thumbnail_url: story.youtube_thumbnail_url,
      isTop3: isTop3(story, index),
      chosen: selection
    })
  }
}
