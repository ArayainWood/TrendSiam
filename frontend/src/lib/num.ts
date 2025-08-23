/**
 * Numeric Utilities
 * 
 * Safe numeric conversion and validation helpers
 */

/**
 * Safely convert any value to a number with fallback
 * @param value - Value to convert (string, number, null, undefined)
 * @param fallback - Fallback value if conversion fails (default: 0)
 * @returns Numeric value or fallback
 */
export function toNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === 'number') {
    return isNaN(value) ? fallback : value
  }
  
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return isNaN(parsed) ? fallback : parsed
  }
  
  return fallback
}

/**
 * Safely convert to integer with fallback
 * @param value - Value to convert
 * @param fallback - Fallback value if conversion fails (default: 0)
 * @returns Integer value or fallback
 */
export function toInteger(value: unknown, fallback: number = 0): number {
  const num = toNumber(value, fallback)
  return Math.floor(num)
}

/**
 * Check if a value is a valid finite number
 * @param value - Value to check
 * @returns true if value is a finite number
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value)
}

/**
 * Clamp a number between min and max values
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Safe division with fallback for division by zero
 * @param numerator - Numerator
 * @param denominator - Denominator
 * @param fallback - Fallback value if denominator is zero (default: 0)
 * @returns Division result or fallback
 */
export function safeDivide(numerator: number, denominator: number, fallback: number = 0): number {
  if (denominator === 0 || !isFinite(denominator)) {
    return fallback
  }
  const result = numerator / denominator
  return isFinite(result) ? result : fallback
}

/**
 * Format number with specified decimal places
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted number string
 */
export function formatNumber(value: number, decimals: number = 2): string {
  if (!isFinite(value)) {
    return '0'
  }
  return value.toFixed(decimals)
}

/**
 * Parse rank value safely (handles string ranks from database)
 * @param rank - Rank value (string, number, null, undefined)
 * @returns Numeric rank or undefined
 */
export function parseRank(rank: unknown): number | undefined {
  if (rank === null || rank === undefined) {
    return undefined
  }
  
  const parsed = toNumber(rank, NaN)
  return isNaN(parsed) ? undefined : Math.max(1, Math.floor(parsed))
}

/**
 * Compare two numeric values safely (handles string numbers)
 * @param a - First value
 * @param b - Second value
 * @returns Comparison result (-1, 0, 1)
 */
export function compareNumbers(a: unknown, b: unknown): number {
  const numA = toNumber(a, 0)
  const numB = toNumber(b, 0)
  
  if (numA < numB) return -1
  if (numA > numB) return 1
  return 0
}
