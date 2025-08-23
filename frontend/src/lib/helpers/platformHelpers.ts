/**
 * Platform Helpers
 * 
 * Utilities for normalizing and processing platform data from various sources
 * with centralized alias mapping and robust fallback handling.
 */

import { PLATFORM_ALIASES } from '@/lib/constants/businessRules';

/**
 * Normalize platform names using centralized alias mapping
 * 
 * @param input - String or array of platform names to normalize
 * @returns Array of canonical platform names, deduplicated and filtered
 */
export function normalizePlatforms(input: string[] | string | null | undefined): string[] {
  if (!input) return [];
  
  // Convert to array if string
  const inputArray = Array.isArray(input) ? input : [input];
  
  // Process each platform string
  const platforms: string[] = [];
  
  for (const platformString of inputArray) {
    if (!platformString || typeof platformString !== 'string') continue;
    
    // Split on common separators and process each part
    const parts = platformString
      .split(/[,;|]/) // Split on comma, semicolon, or pipe
      .map(part => part.trim().toLowerCase()) // Normalize case and whitespace
      .filter(part => part.length > 0); // Remove empty parts
    
    for (const part of parts) {
      // Look up in alias map
      const canonical = PLATFORM_ALIASES[part];
      if (canonical) {
        platforms.push(canonical);
      } else {
        // Keep unknown platforms but title-case them
        const titleCased = part
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        platforms.push(titleCased);
      }
    }
  }
  
  // Deduplicate and return
  return [...new Set(platforms)];
}

/**
 * Extract platforms from database row using fallback chain
 * 
 * @param row - Database row with platform fields
 * @returns Array of normalized platform names
 */
export function extractPlatformsFromRow(row: {
  platforms_raw?: string | null;
  platform?: string | null;
  platform_mentions?: string | null;
}): string[] {
  // Use the fallback chain result from the view if available
  if (row.platforms_raw) {
    return normalizePlatforms(row.platforms_raw);
  }
  
  // Manual fallback if platforms_raw is not available
  const sources = [
    row.platform,
    row.platform_mentions
  ].filter(Boolean);
  
  if (sources.length === 0) return [];
  
  // Combine all sources and normalize
  return normalizePlatforms(sources.join(', '));
}

/**
 * Format platforms for display
 * 
 * @param platforms - Array of platform names
 * @param maxDisplay - Maximum number of platforms to display before truncating
 * @returns Formatted string for display
 */
export function formatPlatformsForDisplay(platforms: string[], maxDisplay: number = 3): string {
  if (platforms.length === 0) return '';
  
  if (platforms.length <= maxDisplay) {
    return platforms.join(', ');
  }
  
  const displayed = platforms.slice(0, maxDisplay);
  const remaining = platforms.length - maxDisplay;
  return `${displayed.join(', ')} +${remaining} more`;
}

/**
 * Get platform source information for diagnostics
 * 
 * @param row - Database row with platform fields
 * @returns Object with source information
 */
export function getPlatformSourceInfo(row: {
  platforms_raw?: string | null;
  platform?: string | null;
  platform_mentions?: string | null;
}) {
  if (row.platforms_raw) {
    return {
      source: 'platforms_raw (fallback chain)',
      rawValue: row.platforms_raw,
      fallbackUsed: true
    };
  }
  
  if (row.platform) {
    return {
      source: 'platform',
      rawValue: row.platform,
      fallbackUsed: false
    };
  }
  
  if (row.platform_mentions) {
    return {
      source: 'platform_mentions',
      rawValue: row.platform_mentions,
      fallbackUsed: false
    };
  }
  
  return {
    source: 'none',
    rawValue: null,
    fallbackUsed: false
  };
}
