/**
 * Canonical Mapping Tests
 * 
 * Tests for the canonical mapping between database rows and UI items,
 * including platform extraction and fallback chain functionality.
 */

import { describe, it, expect } from '@jest/globals';
import { DbNewsRow, mapDbToUi } from '../canonical';

describe('Canonical Mapping', () => {
  const createMockDbRow = (overrides: Partial<DbNewsRow> = {}): DbNewsRow => ({
    id: 'test-id',
    external_id: 'test-external',
    video_id: 'test-video',
    title: 'Test Title',
    summary: 'Test Summary',
    summary_en: 'Test Summary EN',
    description: 'Test Description',
    category: 'Test Category',
    platform: 'youtube',
    channel: 'Test Channel',
    date: '2024-01-01',
    published_date: '2024-01-01T00:00:00Z',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    summary_date: '2024-01-01',
    view_count: '1000',
    like_count: '100',
    comment_count: '10',
    duration: '5:00',
    raw_view: '1000',
    popularity_score: 75,
    popularity_score_precise: 75.5,
    ai_image_url: null,
    ai_image_prompt: null,
    reason: null,
    growth_rate: null,
    platform_mentions: null,
    keywords: null,
    ai_opinion: null,
    score_details: null,
    platforms_raw: null,
    rank: 1,
    image_url: null,
    display_image_url_raw: null,
    is_ai_image: false,
    ...overrides
  });

  describe('Platform Extraction', () => {
    it('should extract platforms from platforms_raw (primary source)', () => {
      const dbRow = createMockDbRow({
        platforms_raw: 'facebook, instagram',
        platform: 'youtube',
        platform_mentions: 'twitter'
      });

      const uiItem = mapDbToUi(dbRow);

      expect(uiItem.platforms).toEqual(['Facebook', 'Instagram']);
    });

    it('should fall back to platform and platform_mentions when platforms_raw is null', () => {
      const dbRow = createMockDbRow({
        platforms_raw: null,
        platform: 'youtube',
        platform_mentions: 'facebook, instagram'
      });

      const uiItem = mapDbToUi(dbRow);

      expect(uiItem.platforms).toEqual(['YouTube', 'Facebook', 'Instagram']);
    });

    it('should handle empty platforms gracefully', () => {
      const dbRow = createMockDbRow({
        platforms_raw: null,
        platform: null,
        platform_mentions: null
      });

      const uiItem = mapDbToUi(dbRow);

      expect(uiItem.platforms).toEqual([]);
    });

    it('should normalize platform aliases correctly', () => {
      const dbRow = createMockDbRow({
        platforms_raw: 'fb, ig, twitter, tiktok'
      });

      const uiItem = mapDbToUi(dbRow);

      expect(uiItem.platforms).toEqual(['Facebook', 'Instagram', 'Twitter/X', 'TikTok']);
    });

    it('should deduplicate platforms', () => {
      const dbRow = createMockDbRow({
        platforms_raw: 'facebook, fb, Facebook, instagram'
      });

      const uiItem = mapDbToUi(dbRow);

      expect(uiItem.platforms).toEqual(['Facebook', 'Instagram']);
    });

    it('should handle unknown platforms by title-casing them', () => {
      const dbRow = createMockDbRow({
        platforms_raw: 'custom platform, unknown app'
      });

      const uiItem = mapDbToUi(dbRow);

      expect(uiItem.platforms).toEqual(['Custom Platform', 'Unknown App']);
    });

    it('should handle Thai platform names', () => {
      const dbRow = createMockDbRow({
        platforms_raw: 'ไลน์, ทุกแพลตฟอร์ม'
      });

      const uiItem = mapDbToUi(dbRow);

      expect(uiItem.platforms).toEqual(['Line', 'Multiple Platforms']);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing fields for legacy compatibility', () => {
      const dbRow = createMockDbRow({
        platform: 'youtube',
        platform_mentions: 'facebook, instagram',
        platforms_raw: 'twitter, tiktok'
      });

      const uiItem = mapDbToUi(dbRow);

      // New field
      expect(uiItem.platforms).toEqual(['Twitter/X', 'TikTok']);
      
      // Legacy fields should still exist
      expect(uiItem.platform).toBe('youtube');
      expect(uiItem.platformMentions).toBe('facebook, instagram');
    });

    it('should work with legacy UI compatibility adapter', () => {
      const dbRow = createMockDbRow({
        platforms_raw: 'facebook, instagram'
      });

      const uiItem = mapDbToUi(dbRow);
      const { legacyUiCompat } = require('../canonical');
      const compatItem = legacyUiCompat(uiItem);

      expect(compatItem.platforms).toEqual(['Facebook', 'Instagram']);
      expect(compatItem.platform_mentions).toBe('facebook, instagram');
    });
  });

  describe('Integration with Other Fields', () => {
    it('should work correctly with all other canonical mapping fields', () => {
      const dbRow = createMockDbRow({
        platforms_raw: 'facebook, instagram',
        ai_image_prompt: 'Test AI prompt',
        keywords: '["test", "keywords"]',
        growth_rate: '1000'
      });

      const uiItem = mapDbToUi(dbRow);

      expect(uiItem.platforms).toEqual(['Facebook', 'Instagram']);
      expect(uiItem.aiImagePrompt).toBe('Test AI prompt');
      expect(uiItem.keywords).toEqual(['test', 'keywords']);
      expect(uiItem.growthRate).toBe(1000);
    });

    it('should handle complex real-world data structure', () => {
      const dbRow = createMockDbRow({
        title: 'Stray Kids - CEREMONY (Official Music Video)',
        platforms_raw: 'youtube, spotify, apple music',
        ai_image_prompt: 'K-pop music video illustration with vibrant colors',
        is_ai_image: true,
        rank: 1,
        popularity_score_precise: 85.7
      });

      const uiItem = mapDbToUi(dbRow);

      expect(uiItem.title).toBe('Stray Kids - CEREMONY (Official Music Video)');
      expect(uiItem.platforms).toEqual(['YouTube', 'Spotify', 'Apple Music']);
      expect(uiItem.aiImagePrompt).toBe('K-pop music video illustration with vibrant colors');
      expect(uiItem.isAIImage).toBe(true);
      expect(uiItem.rank).toBe(1);
      expect(uiItem.popularityScorePrecise).toBe(85.7);
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed platform data', () => {
      const dbRow = createMockDbRow({
        platforms_raw: ',,facebook,,,instagram,,'
      });

      const uiItem = mapDbToUi(dbRow);

      expect(uiItem.platforms).toEqual(['Facebook', 'Instagram']);
    });

    it('should handle very long platform lists', () => {
      const longPlatformList = Array(20).fill('facebook').join(', ');
      const dbRow = createMockDbRow({
        platforms_raw: longPlatformList
      });

      const uiItem = mapDbToUi(dbRow);

      expect(uiItem.platforms).toEqual(['Facebook']); // Should deduplicate
    });

    it('should handle special characters in platform names', () => {
      const dbRow = createMockDbRow({
        platforms_raw: 'platform-name, platform_name, platform.name'
      });

      const uiItem = mapDbToUi(dbRow);

      expect(uiItem.platforms).toEqual(['Platform-name', 'Platform_name', 'Platform.name']);
    });
  });
});