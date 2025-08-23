/**
 * Unit tests for popularity helpers
 */

import { formatPopularityScore, getPopularitySubtext } from '../popularityHelpers';
import type { UINewsItem } from '../../normalizeNewsItem';

describe('popularityHelpers', () => {
  describe('formatPopularityScore', () => {
    it('should format score with 1 decimal place', () => {
      expect(formatPopularityScore(95.04465414100234)).toBe('95.0');
      expect(formatPopularityScore(89.6)).toBe('89.6');
      expect(formatPopularityScore(100)).toBe('100.0');
      expect(formatPopularityScore(0)).toBe('0.0');
    });
  });

  describe('getPopularitySubtext', () => {
    it('should return pre-computed subtext if available', () => {
      const item: Partial<UINewsItem> = {
        popularitySubtext: 'Pre-computed subtext'
      };
      
      expect(getPopularitySubtext(item as UINewsItem)).toBe('Pre-computed subtext');
    });

    it('should generate subtext from metrics when no pre-computed subtext', () => {
      const item: Partial<UINewsItem> = {
        views: 11800000,
        likes: 1200000,
        growthRate: 125000
      };
      
      const result = getPopularitySubtext(item as UINewsItem);
      
      // Should contain engagement level, views, like rate, and growth
      expect(result).toContain('engagement');
      expect(result).toContain('11.8M+ views');
      expect(result).toContain('like rate 10.2%');
      expect(result).toContain('Viral growth');
      expect(result).toContain('•'); // Should use bullet separator
    });

    it('should handle missing metrics gracefully', () => {
      const item: Partial<UINewsItem> = {
        views: null,
        likes: null,
        growthRate: null
      };
      
      const result = getPopularitySubtext(item as UINewsItem);
      
      // Should return empty string or minimal content when no metrics
      expect(typeof result).toBe('string');
    });

    it('should use centralized thresholds from businessRules', () => {
      // High engagement (like rate >= 5%)
      const highEngagementItem: Partial<UINewsItem> = {
        views: 1000000,
        likes: 60000, // 6% like rate
        growthRate: 50000
      };
      
      const result = getPopularitySubtext(highEngagementItem as UINewsItem);
      expect(result).toContain('High engagement');
    });
  });
});