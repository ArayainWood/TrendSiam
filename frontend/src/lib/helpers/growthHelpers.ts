/**
 * Growth Rate helpers for UI components
 * 
 * Provides canonical functions for formatting growth rate data
 */

import { GROWTH_RATE_THRESHOLDS } from '@/lib/constants/businessRules';

/**
 * Format a number in human-readable format (K/M)
 */
export function formatHumanNumber(n: number): string {
  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(n >= 10000000 ? 0 : 1)}M`;
  } else if (n >= 1000) {
    return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  } else {
    return n.toString();
  }
}

/**
 * Get growth tier based on numeric rate
 */
export function getGrowthTier(n: number): 'Viral' | 'High' | 'Growing' | 'Low' {
  if (n >= GROWTH_RATE_THRESHOLDS.VIRAL) return 'Viral';
  if (n >= GROWTH_RATE_THRESHOLDS.HIGH_GROWTH) return 'High';
  if (n >= GROWTH_RATE_THRESHOLDS.GROWING) return 'Growing';
  return 'Low';
}

/**
 * Format growth rate for display
 */
export function formatGrowthRate(n?: number | null): { text: string; tier: string; debug: string } {
  // Handle missing/invalid data
  if (n === null || n === undefined || isNaN(n)) {
    return {
      text: 'Not enough data',
      tier: 'Low',
      debug: `input: ${n}, type: ${typeof n}`
    };
  }

  // Handle very low/zero growth
  if (n < 1) {
    return {
      text: '≈0/day (Low)',
      tier: 'Low',
      debug: `input: ${n}, rounded to zero`
    };
  }

  // Format positive growth
  const humanNumber = formatHumanNumber(n);
  const tier = getGrowthTier(n);
  
  return {
    text: `Est. +${humanNumber}/day (${tier})`,
    tier,
    debug: `input: ${n}, formatted: ${humanNumber}, tier: ${tier}`
  };
}
