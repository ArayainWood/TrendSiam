/**
 * Platform Helpers Tests
 * 
 * Tests for platform normalization, fallback chain extraction,
 * and display formatting functionality.
 */

import { describe, it, expect } from '@jest/globals';
import { 
  normalizePlatforms, 
  extractPlatformsFromRow, 
  formatPlatformsForDisplay,
  getPlatformSourceInfo 
} from '../platformHelpers';

describe('Platform Helpers', () => {
  describe('normalizePlatforms', () => {
    it('should normalize single platform aliases', () => {
      expect(normalizePlatforms('youtube')).toEqual(['YouTube']);
      expect(normalizePlatforms('fb')).toEqual(['Facebook']);
      expect(normalizePlatforms('ig')).toEqual(['Instagram']);
      expect(normalizePlatforms('twitter')).toEqual(['Twitter/X']);
      expect(normalizePlatforms('x')).toEqual(['Twitter/X']);
      expect(normalizePlatforms('tiktok')).toEqual(['TikTok']);
    });

    it('should handle comma-separated platforms', () => {
      expect(normalizePlatforms('facebook, instagram')).toEqual(['Facebook', 'Instagram']);
      expect(normalizePlatforms('youtube,twitter,tiktok')).toEqual(['YouTube', 'Twitter/X', 'TikTok']);
    });

    it('should handle mixed case and whitespace', () => {
      expect(normalizePlatforms('  FACEBOOK  ,  instagram  ')).toEqual(['Facebook', 'Instagram']);
      expect(normalizePlatforms('YouTube, Twitter/X')).toEqual(['YouTube', 'Twitter/X']);
    });

    it('should deduplicate platforms', () => {
      expect(normalizePlatforms('facebook, fb, Facebook')).toEqual(['Facebook']);
      expect(normalizePlatforms('twitter, x, Twitter/X')).toEqual(['Twitter/X']);
    });

    it('should handle unknown platforms by title-casing them', () => {
      expect(normalizePlatforms('unknown platform')).toEqual(['Unknown Platform']);
      expect(normalizePlatforms('custom app')).toEqual(['Custom App']);
    });

    it('should handle array input', () => {
      expect(normalizePlatforms(['facebook', 'instagram'])).toEqual(['Facebook', 'Instagram']);
      expect(normalizePlatforms(['youtube', 'unknown platform'])).toEqual(['YouTube', 'Unknown Platform']);
    });

    it('should handle empty/null input', () => {
      expect(normalizePlatforms(null)).toEqual([]);
      expect(normalizePlatforms(undefined)).toEqual([]);
      expect(normalizePlatforms('')).toEqual([]);
      expect(normalizePlatforms([])).toEqual([]);
    });

    it('should handle special separators', () => {
      expect(normalizePlatforms('facebook;instagram')).toEqual(['Facebook', 'Instagram']);
      expect(normalizePlatforms('youtube|twitter')).toEqual(['YouTube', 'Twitter/X']);
    });

    it('should handle Thai platform names', () => {
      expect(normalizePlatforms('ไลน์')).toEqual(['Line']);
      expect(normalizePlatforms('ทุกแพลตฟอร์ม')).toEqual(['Multiple Platforms']);
    });

    it('should handle special cases', () => {
      expect(normalizePlatforms('multiple platforms')).toEqual(['Multiple Platforms']);
      expect(normalizePlatforms('all platforms')).toEqual(['Multiple Platforms']);
      expect(normalizePlatforms('primary platform only')).toEqual(['YouTube']);
    });
  });

  describe('extractPlatformsFromRow', () => {
    it('should use platforms_raw when available', () => {
      const row = {
        platforms_raw: 'facebook, instagram',
        platform: 'youtube',
        platform_mentions: 'twitter'
      };
      expect(extractPlatformsFromRow(row)).toEqual(['Facebook', 'Instagram']);
    });

    it('should fall back to platform when platforms_raw is null', () => {
      const row = {
        platforms_raw: null,
        platform: 'youtube',
        platform_mentions: 'twitter'
      };
      expect(extractPlatformsFromRow(row)).toEqual(['YouTube', 'Twitter/X']);
    });

    it('should fall back to platform_mentions when both platforms_raw and platform are null', () => {
      const row = {
        platforms_raw: null,
        platform: null,
        platform_mentions: 'facebook, instagram'
      };
      expect(extractPlatformsFromRow(row)).toEqual(['Facebook', 'Instagram']);
    });

    it('should return empty array when all sources are null', () => {
      const row = {
        platforms_raw: null,
        platform: null,
        platform_mentions: null
      };
      expect(extractPlatformsFromRow(row)).toEqual([]);
    });

    it('should combine multiple sources when platforms_raw is not available', () => {
      const row = {
        platforms_raw: null,
        platform: 'youtube',
        platform_mentions: 'facebook, instagram'
      };
      expect(extractPlatformsFromRow(row)).toEqual(['YouTube', 'Facebook', 'Instagram']);
    });
  });

  describe('formatPlatformsForDisplay', () => {
    it('should format platforms with commas', () => {
      expect(formatPlatformsForDisplay(['Facebook', 'Instagram'])).toBe('Facebook, Instagram');
      expect(formatPlatformsForDisplay(['YouTube'])).toBe('YouTube');
    });

    it('should truncate when exceeding maxDisplay', () => {
      const platforms = ['Facebook', 'Instagram', 'Twitter/X', 'TikTok'];
      expect(formatPlatformsForDisplay(platforms, 3)).toBe('Facebook, Instagram, Twitter/X +1 more');
      expect(formatPlatformsForDisplay(platforms, 2)).toBe('Facebook, Instagram +2 more');
    });

    it('should handle empty array', () => {
      expect(formatPlatformsForDisplay([])).toBe('');
    });

    it('should use default maxDisplay of 3', () => {
      const platforms = ['Facebook', 'Instagram', 'Twitter/X', 'TikTok'];
      expect(formatPlatformsForDisplay(platforms)).toBe('Facebook, Instagram, Twitter/X +1 more');
    });
  });

  describe('getPlatformSourceInfo', () => {
    it('should identify platforms_raw as source', () => {
      const row = {
        platforms_raw: 'facebook, instagram',
        platform: 'youtube',
        platform_mentions: 'twitter'
      };
      const info = getPlatformSourceInfo(row);
      expect(info.source).toBe('platforms_raw (fallback chain)');
      expect(info.rawValue).toBe('facebook, instagram');
      expect(info.fallbackUsed).toBe(true);
    });

    it('should identify platform as source when platforms_raw is null', () => {
      const row = {
        platforms_raw: null,
        platform: 'youtube',
        platform_mentions: 'twitter'
      };
      const info = getPlatformSourceInfo(row);
      expect(info.source).toBe('platform');
      expect(info.rawValue).toBe('youtube');
      expect(info.fallbackUsed).toBe(false);
    });

    it('should identify platform_mentions as source when others are null', () => {
      const row = {
        platforms_raw: null,
        platform: null,
        platform_mentions: 'facebook, instagram'
      };
      const info = getPlatformSourceInfo(row);
      expect(info.source).toBe('platform_mentions');
      expect(info.rawValue).toBe('facebook, instagram');
      expect(info.fallbackUsed).toBe(false);
    });

    it('should return none when all sources are null', () => {
      const row = {
        platforms_raw: null,
        platform: null,
        platform_mentions: null
      };
      const info = getPlatformSourceInfo(row);
      expect(info.source).toBe('none');
      expect(info.rawValue).toBeNull();
      expect(info.fallbackUsed).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed input gracefully', () => {
      expect(normalizePlatforms(',,,')).toEqual([]);
      expect(normalizePlatforms('   ,  ,  ')).toEqual([]);
      expect(normalizePlatforms('facebook,,,instagram')).toEqual(['Facebook', 'Instagram']);
    });

    it('should handle very long platform names', () => {
      const longName = 'a'.repeat(100);
      const expected = 'A' + 'a'.repeat(99);
      expect(normalizePlatforms(longName)).toEqual([expected]);
    });

    it('should handle numeric-like platform names', () => {
      expect(normalizePlatforms('platform123')).toEqual(['Platform123']);
      expect(normalizePlatforms('123platform')).toEqual(['123platform']);
    });

    it('should handle special characters in platform names', () => {
      expect(normalizePlatforms('platform-name')).toEqual(['Platform-name']);
      expect(normalizePlatforms('platform_name')).toEqual(['Platform_name']);
    });
  });
});
