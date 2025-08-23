/**
 * Date utility functions for diagnostics and general use
 * Minimal, safe implementation to prevent build failures
 */

/** 
 * Get date range for recent stories
 * @param hoursAgo Number of hours to go back from now
 * @returns Object with start and end dates
 */
export function getRecentDateRange(hoursAgo: number = 24): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getTime() - (hoursAgo * 60 * 60 * 1000));
  
  return { start, end: now };
}

/** 
 * Safely parse an ISO date string; returns null on invalid 
 */
export function safeParseISO(input?: string | null): Date | null {
  if (!input) return null;
  try {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/** 
 * Format date with native Intl.DateTimeFormat; returns 'N/A' on invalid 
 */
export function formatDate(input?: string | Date | null, options?: Intl.DateTimeFormatOptions): string {
  if (!input) return 'N/A';
  const d = typeof input === 'string' ? safeParseISO(input) : input;
  if (!d) return 'N/A';
  
  try {
    return new Intl.DateTimeFormat('en-US', options || {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch {
    return 'N/A';
  }
}

/** 
 * Returns 'today', 'yesterday', or formatted date for quick diagnostics 
 */
export function humanDate(input?: string | Date | null): string {
  const d = typeof input === 'string' ? safeParseISO(input) : input;
  if (!d) return 'N/A';
  
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  const diff = Math.floor((now.setHours(0,0,0,0) - d.setHours(0,0,0,0)) / oneDay);
  
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  
  return formatDate(d, { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/**
 * Get today's date in Asia/Bangkok timezone as YYYY-MM-DD string
 */
export function getTodayBangkok(): string {
  const now = new Date();
  // Create date in Bangkok timezone
  const bangkokTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  
  // Convert MM/DD/YYYY to YYYY-MM-DD format
  const [month, day, year] = bangkokTime.split('/');
  return `${year}-${month?.padStart(2, '0')}-${day?.padStart(2, '0')}`;
}
