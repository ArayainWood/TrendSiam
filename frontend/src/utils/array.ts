/**
 * Array utility functions for safe operations
 */

import { isDefined } from './typeGuards';

/**
 * Creates pairs of consecutive elements from an array
 * Guarantees that both elements in each pair are defined
 * 
 * @example
 * pairwise([1, 2, 3, 4]) // => [[1, 2], [2, 3], [3, 4]]
 * pairwise([1]) // => []
 * pairwise([]) // => []
 */
export function pairwise<T>(arr: readonly T[]): ReadonlyArray<readonly [T, T]> {
  const out: Array<[T, T]> = [];
  for (let i = 1; i < arr.length; i++) {
    const prev = arr[i - 1];
    const curr = arr[i];
    // With noUncheckedIndexedAccess, we must verify both elements exist
    if (isDefined(prev) && isDefined(curr)) {
      out.push([prev, curr]);
    }
  }
  return out;
}

/**
 * Safely gets an element at index, returning undefined if out of bounds
 */
export function safeGet<T>(arr: readonly T[], index: number): T | undefined {
  if (index >= 0 && index < arr.length) {
    return arr[index];
  }
  return undefined;
}

/**
 * Groups array elements into chunks of specified size
 */
export function chunk<T>(arr: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
