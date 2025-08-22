/**
 * Data normalization utilities for consistent type conversions
 */

/**
 * Safely converts a value to a number with a fallback
 */
export const toNumber = (v: unknown, fallback = 0): number =>
  Number.isFinite(Number(v)) ? Number(v) : fallback;

/**
 * Safely parses a date string, returning null for invalid dates
 */
export const safeDate = (s?: string | null): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return d && !isNaN(d.getTime()) && d.getFullYear() >= 2020 ? d : null;
};

/**
 * Safely parses an integer from a string or number
 */
export const toInteger = (v: unknown, fallback = 0): number => {
  const num = Number(v);
  return Number.isInteger(num) ? num : Math.floor(toNumber(v, fallback));
};

/**
 * Ensures a value is a string
 */
export const toString = (v: unknown, fallback = ''): string => {
  if (typeof v === 'string') return v;
  if (v == null) return fallback;
  return String(v);
};
