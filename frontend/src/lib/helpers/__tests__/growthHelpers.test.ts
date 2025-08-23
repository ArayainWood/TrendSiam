/**
 * Unit tests for growth helpers
 */

import { formatHumanNumber, getGrowthTier, formatGrowthRate } from '../growthHelpers';

describe('growthHelpers', () => {
  describe('formatHumanNumber', () => {
    it('should format numbers with K/M suffixes', () => {
      expect(formatHumanNumber(1500)).toBe('1.5K');
      expect(formatHumanNumber(15000)).toBe('15K');
      expect(formatHumanNumber(1500000)).toBe('1.5M');
      expect(formatHumanNumber(15000000)).toBe('15M');
      expect(formatHumanNumber(500)).toBe('500');
    });

    it('should handle edge cases', () => {
      expect(formatHumanNumber(1000)).toBe('1K');
      expect(formatHumanNumber(1000000)).toBe('1M');
      expect(formatHumanNumber(0)).toBe('0');
    });
  });

  describe('getGrowthTier', () => {
    it('should classify growth tiers correctly', () => {
      expect(getGrowthTier(150000)).toBe('Viral');
      expect(getGrowthTier(50000)).toBe('High');
      expect(getGrowthTier(5000)).toBe('Growing');
      expect(getGrowthTier(500)).toBe('Low');
      expect(getGrowthTier(0)).toBe('Low');
    });

    it('should handle threshold boundaries', () => {
      expect(getGrowthTier(100000)).toBe('Viral');
      expect(getGrowthTier(99999)).toBe('High');
      expect(getGrowthTier(10000)).toBe('High');
      expect(getGrowthTier(9999)).toBe('Growing');
      expect(getGrowthTier(1000)).toBe('Growing');
      expect(getGrowthTier(999)).toBe('Low');
    });
  });

  describe('formatGrowthRate', () => {
    it('should format positive growth rates', () => {
      const result = formatGrowthRate(125000);
      expect(result.text).toBe('Est. +125K/day (Viral)');
      expect(result.tier).toBe('Viral');
    });

    it('should handle small growth rates', () => {
      const result = formatGrowthRate(500);
      expect(result.text).toBe('Est. +500/day (Low)');
      expect(result.tier).toBe('Low');
    });

    it('should handle very low growth rates', () => {
      const result = formatGrowthRate(0.5);
      expect(result.text).toBe('≈0/day (Low)');
      expect(result.tier).toBe('Low');
    });

    it('should handle missing/invalid data', () => {
      expect(formatGrowthRate(null).text).toBe('Not enough data');
      expect(formatGrowthRate(undefined).text).toBe('Not enough data');
      expect(formatGrowthRate(NaN).text).toBe('Not enough data');
    });

    it('should include debug information', () => {
      const result = formatGrowthRate(125000);
      expect(result.debug).toContain('input: 125000');
      expect(result.debug).toContain('formatted: 125K');
      expect(result.debug).toContain('tier: Viral');
    });
  });
});
