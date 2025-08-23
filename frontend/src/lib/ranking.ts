/**
 * Ranking Utilities
 * 
 * Safe ranking and top-N detection with proper numeric handling
 */

import { toNumber, parseRank } from './num'

/**
 * Item with rank property (flexible input)
 */
export interface RankableItem {
  rank?: unknown // Can be string, number, null, undefined
  [key: string]: any
}

/**
 * Determines if an item or rank value is in the top N
 * @param itemOrRank - Either an object with rank property or a direct rank value
 * @param n - Top N threshold (default: 3)
 * @returns true if item/rank is in top N
 */
export function isTopN(itemOrRank: RankableItem | unknown, n: number = 3): boolean {
  let rank: number | undefined
  
  // Handle object with rank property
  if (typeof itemOrRank === 'object' && itemOrRank !== null && 'rank' in itemOrRank) {
    rank = parseRank((itemOrRank as RankableItem).rank)
  } else {
    // Handle direct rank value
    rank = parseRank(itemOrRank)
  }
  
  // Return false if rank is invalid or undefined
  if (rank === undefined || rank < 1) {
    return false
  }
  
  return rank <= n
}

/**
 * Determines if an item is in the top 3
 * @param itemOrRank - Either an object with rank property or a direct rank value
 * @returns true if item/rank is in top 3
 */
export function isTop3(itemOrRank: RankableItem | unknown): boolean {
  return isTopN(itemOrRank, 3)
}

/**
 * Determines if an item is the #1 ranked item
 * @param itemOrRank - Either an object with rank property or a direct rank value
 * @returns true if item/rank is #1
 */
export function isTop1(itemOrRank: RankableItem | unknown): boolean {
  return isTopN(itemOrRank, 1)
}

/**
 * Get numeric rank from item or value
 * @param itemOrRank - Either an object with rank property or a direct rank value
 * @returns Numeric rank or undefined if invalid
 */
export function getRank(itemOrRank: RankableItem | unknown): number | undefined {
  if (typeof itemOrRank === 'object' && itemOrRank !== null && 'rank' in itemOrRank) {
    return parseRank((itemOrRank as RankableItem).rank)
  }
  return parseRank(itemOrRank)
}

/**
 * Sort items by rank (ascending: 1, 2, 3, ...)
 * @param items - Array of items with rank property
 * @returns Sorted array (items without valid ranks go to end)
 */
export function sortByRank<T extends RankableItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const rankA = getRank(a)
    const rankB = getRank(b)
    
    // Items without valid ranks go to the end
    if (rankA === undefined && rankB === undefined) return 0
    if (rankA === undefined) return 1
    if (rankB === undefined) return -1
    
    return rankA - rankB
  })
}

/**
 * Sort items by popularity score (descending: highest first)
 * @param items - Array of items with popularity_score property
 * @returns Sorted array
 */
export function sortByPopularity<T extends { popularity_score?: unknown }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const scoreA = toNumber(a.popularity_score, 0)
    const scoreB = toNumber(b.popularity_score, 0)
    return scoreB - scoreA // Descending order
  })
}

/**
 * Filter items to top N by rank
 * @param items - Array of items with rank property
 * @param n - Number of top items to return
 * @returns Top N items by rank
 */
export function getTopN<T extends RankableItem>(items: T[], n: number): T[] {
  return sortByRank(items)
    .filter(item => isTopN(item, n))
    .slice(0, n)
}

/**
 * Get top 3 items by rank
 * @param items - Array of items with rank property
 * @returns Top 3 items by rank
 */
export function getTop3<T extends RankableItem>(items: T[]): T[] {
  return getTopN(items, 3)
}
