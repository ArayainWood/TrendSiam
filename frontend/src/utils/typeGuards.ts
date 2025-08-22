/**
 * Type guard utilities for null-safe TypeScript operations
 */

/**
 * Type guard to check if a value is defined (not null or undefined)
 */
export const isDefined = <T>(x: T | undefined | null): x is T =>
  x !== undefined && x !== null;

/**
 * Type guard to check if an object has required fields for news data
 */
export function hasRequiredFields<T extends { created_at?: any; view_count?: any; popularity_score_precise?: any }>(
  x: T | null | undefined
): x is T & { created_at: string; view_count: string | number; popularity_score_precise: number } {
  return (
    !!x && 
    x.created_at != null && 
    x.view_count != null &&
    x.popularity_score_precise != null
  );
}

/**
 * Type guard for checking if an array element at index is defined
 */
export function isDefinedAt<T>(arr: ReadonlyArray<T>, index: number): arr is ReadonlyArray<T> & { [K in typeof index]: T } {
  return index >= 0 && index < arr.length;
}
