/**
 * Shared date formatting utilities
 * 
 * Can be used in both client and server components
 */

/**
 * Parse and validate a date string
 */
export function parseValidDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  
  try {
    const date = new Date(dateStr);
    
    // Check for invalid date or epoch time (Jan 1, 1970)
    if (isNaN(date.getTime()) || date.getFullYear() < 2020) {
      return null;
    }
    
    return date;
  } catch (e) {
    return null;
  }
}

/**
 * Format date for display with fallback
 * Uses published_at with fallback to created_at
 */
export function formatDisplayDate(
  publishedAt?: string | null,
  createdAt?: string | null
): string {
  const date = parseValidDate(publishedAt) ?? parseValidDate(createdAt);
  
  if (!date) return '—';
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
