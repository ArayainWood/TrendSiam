import { describe, it, expect } from 'vitest';
import {
  AI_IMAGE_RULES,
  POPULARITY_THRESHOLDS,
  GROWTH_RATE_THRESHOLDS,
  ENGAGEMENT_THRESHOLDS,
  VIEW_THRESHOLDS,
  calculateAIImagesCount,
  getPopularityLabel,
  getGrowthRateLabel,
  getEngagementLabel,
  shouldHaveAIImage,
} from '../businessRules';

describe('Business Rules', () => {
  describe('calculateAIImagesCount', () => {
    it('should count only AI images from top 3 stories', () => {
      const stories = [
        { rank: 1, isAIImage: true },
        { rank: 2, isAIImage: true },
        { rank: 3, isAIImage: false },
        { rank: 4, isAIImage: true },
        { rank: 5, isAIImage: true },
      ];
      expect(calculateAIImagesCount(stories)).toBe(2);
    });

    it('should handle stories without explicit rank', () => {
      const stories = [
        { isAIImage: true },   // position 1
        { isAIImage: false },  // position 2
        { isAIImage: true },   // position 3
        { isAIImage: true },   // position 4
      ];
      expect(calculateAIImagesCount(stories)).toBe(2);
    });

    it('should return 0 for empty array', () => {
      expect(calculateAIImagesCount([])).toBe(0);
    });

    it('should return 3 when all top 3 have AI images', () => {
      const stories = [
        { rank: 1, isAIImage: true },
        { rank: 2, isAIImage: true },
        { rank: 3, isAIImage: true },
        { rank: 4, isAIImage: false },
      ];
      expect(calculateAIImagesCount(stories)).toBe(3);
    });
  });

  describe('getGrowthRateLabel', () => {
    it('should return Viral label for >100K/day', () => {
      expect(getGrowthRateLabel(100001)).toBe('Viral (>100K/day)');
      expect(getGrowthRateLabel(500000)).toBe('Viral (>100K/day)');
    });

    it('should return High Growth label for >10K/day', () => {
      expect(getGrowthRateLabel(10001)).toBe('High Growth (>10K/day)');
      expect(getGrowthRateLabel(50000)).toBe('High Growth (>10K/day)');
    });

    it('should return Growing label for >1K/day', () => {
      expect(getGrowthRateLabel(1001)).toBe('Growing (>1K/day)');
      expect(getGrowthRateLabel(5000)).toBe('Growing (>1K/day)');
    });

    it('should return percentage for positive values below 1K', () => {
      expect(getGrowthRateLabel(500)).toBe('+500.0%');
      expect(getGrowthRateLabel(50.5)).toBe('+50.5%');
    });

    it('should return null for null/zero/negative values', () => {
      expect(getGrowthRateLabel(null)).toBe(null);
      expect(getGrowthRateLabel(0)).toBe(null);
      expect(getGrowthRateLabel(-100)).toBe(null);
    });
  });

  describe('getPopularityLabel', () => {
    it('should return correct labels based on score', () => {
      expect(getPopularityLabel(90)).toBe('Viral');
      expect(getPopularityLabel(80)).toBe('Viral');
      expect(getPopularityLabel(70)).toBe('Trending');
      expect(getPopularityLabel(60)).toBe('Trending');
      expect(getPopularityLabel(50)).toBe('Popular');
      expect(getPopularityLabel(40)).toBe('Popular');
      expect(getPopularityLabel(30)).toBe('Rising');
      expect(getPopularityLabel(0)).toBe('Rising');
    });
  });

  describe('getEngagementLabel', () => {
    it('should return High engagement for >= 5% like rate', () => {
      expect(getEngagementLabel(1000, 50)).toBe('High engagement');
      expect(getEngagementLabel(1000, 100)).toBe('High engagement');
    });

    it('should return Medium engagement for >= 2% like rate', () => {
      expect(getEngagementLabel(1000, 20)).toBe('Medium engagement');
      expect(getEngagementLabel(1000, 40)).toBe('Medium engagement');
    });

    it('should return Low engagement for < 2% like rate', () => {
      expect(getEngagementLabel(1000, 10)).toBe('Low engagement');
      expect(getEngagementLabel(1000, 0)).toBe('Low engagement');
    });

    it('should return Low engagement for zero/invalid views', () => {
      expect(getEngagementLabel(0, 100)).toBe('Low engagement');
      expect(getEngagementLabel(null as any, 100)).toBe('Low engagement');
    });
  });

  describe('shouldHaveAIImage', () => {
    it('should return true for ranks 1-3', () => {
      expect(shouldHaveAIImage(1)).toBe(true);
      expect(shouldHaveAIImage(2)).toBe(true);
      expect(shouldHaveAIImage(3)).toBe(true);
    });

    it('should return false for rank > 3 or <= 0', () => {
      expect(shouldHaveAIImage(4)).toBe(false);
      expect(shouldHaveAIImage(10)).toBe(false);
      expect(shouldHaveAIImage(0)).toBe(false);
      expect(shouldHaveAIImage(-1)).toBe(false);
    });
  });

  describe('Constants', () => {
    it('should have correct AI image rules', () => {
      expect(AI_IMAGE_RULES.TOP_STORIES_COUNT).toBe(3);
      expect(AI_IMAGE_RULES.MIN_IMAGE_SIZE_BYTES).toBe(15 * 1024);
    });

    it('should have correct popularity thresholds', () => {
      expect(POPULARITY_THRESHOLDS.VIRAL).toBe(80);
      expect(POPULARITY_THRESHOLDS.TRENDING).toBe(60);
      expect(POPULARITY_THRESHOLDS.POPULAR).toBe(40);
      expect(POPULARITY_THRESHOLDS.RISING).toBe(0);
    });

    it('should have correct growth rate thresholds', () => {
      expect(GROWTH_RATE_THRESHOLDS.VIRAL).toBe(100000);
      expect(GROWTH_RATE_THRESHOLDS.HIGH_GROWTH).toBe(10000);
      expect(GROWTH_RATE_THRESHOLDS.GROWING).toBe(1000);
    });

    it('should have correct engagement thresholds', () => {
      expect(ENGAGEMENT_THRESHOLDS.HIGH).toBe(5.0);
      expect(ENGAGEMENT_THRESHOLDS.MEDIUM).toBe(2.0);
      expect(ENGAGEMENT_THRESHOLDS.LOW).toBe(0);
    });

    it('should have correct view thresholds', () => {
      expect(VIEW_THRESHOLDS.MILLION).toBe(1000000);
      expect(VIEW_THRESHOLDS.THOUSAND).toBe(1000);
    });
  });
});