/**
 * Unit tests for keywords helpers
 */

import { collectDisplayKeywords, STOP_WORDS } from '../keywords';
import type { UiNewsItem } from '../../db/types/canonical';

describe('keywords', () => {
  describe('STOP_WORDS', () => {
    it('should contain common English and Thai stop words', () => {
      expect(STOP_WORDS).toContain('the');
      expect(STOP_WORDS).toContain('and');
      expect(STOP_WORDS).toContain('ที่');
      expect(STOP_WORDS).toContain('และ');
    });
  });

  describe('collectDisplayKeywords', () => {
    it('should use DB keywords first', () => {
      const item: Partial<UiNewsItem> = {
        keywords: ['Gaming', 'Warhammer', 'Strategy'],
        title: 'Some other title',
        summary: 'Some other content'
      };

      const result = collectDisplayKeywords(item as UiNewsItem);
      
      expect(result.source).toBe('db');
      expect(result.keywords).toEqual(['Gaming', 'Warhammer', 'Strategy']);
    });

    it('should fall back to platform mentions', () => {
      const item: Partial<UiNewsItem> = {
        keywords: [],
        platform_mentions: 'Facebook, Instagram, Twitter',
        title: 'Social media post',
        summary: 'About social platforms'
      };

      const result = collectDisplayKeywords(item as UiNewsItem);
      
      expect(result.source).toBe('platform');
      expect(result.keywords).toContain('Facebook');
      expect(result.keywords).toContain('Instagram');
      expect(result.keywords).toContain('Twitter');
    });

    it('should derive keywords from title and summary', () => {
      const item: Partial<UiNewsItem> = {
        keywords: [],
        platform_mentions: 'Primary platform only',
        title: 'Warhammer 40K Dawn War Gaming Strategy',
        summary: 'Epic battles and tactical gameplay'
      };

      const result = collectDisplayKeywords(item as UiNewsItem);
      
      expect(result.source).toBe('derived');
      expect(result.keywords).toContain('Warhammer');
      expect(result.keywords).toContain('Gaming');
      expect(result.keywords).toContain('Strategy');
      expect(result.keywords).toContain('Epic');
    });

    it('should fall back to category and channel', () => {
      const item: Partial<UiNewsItem> = {
        keywords: [],
        platform_mentions: 'Primary platform only',
        title: 'The and or but',  // All stop words
        summary: 'A very simple text',  // Mostly stop words
        category: 'Entertainment',
        channelTitle: 'Gaming Channel',
        platform: 'YouTube'
      };

      const result = collectDisplayKeywords(item as UiNewsItem);
      
      expect(result.source).toBe('fallback');
      expect(result.keywords).toContain('Entertainment');
      expect(result.keywords).toContain('Gaming Channel');
      expect(result.keywords).toContain('Youtube');
    });

    it('should normalize keywords to Title Case', () => {
      const item: Partial<UiNewsItem> = {
        keywords: ['gaming', 'STRATEGY', 'WaRhAmMeR'],
        title: 'Test',
        summary: 'Test'
      };

      const result = collectDisplayKeywords(item as UiNewsItem);
      
      expect(result.keywords).toContain('Gaming');
      expect(result.keywords).toContain('Strategy');
      expect(result.keywords).toContain('Warhammer');
    });

    it('should filter out stop words and short tokens', () => {
      const item: Partial<UiNewsItem> = {
        keywords: [],
        platform_mentions: '',
        title: 'The big gaming strategy and war',
        summary: 'A very good game'
      };

      const result = collectDisplayKeywords(item as UiNewsItem);
      
      // Should not contain stop words
      expect(result.keywords).not.toContain('The');
      expect(result.keywords).not.toContain('And');
      expect(result.keywords).not.toContain('A');
      
      // Should contain meaningful words
      expect(result.keywords).toContain('Gaming');
      expect(result.keywords).toContain('Strategy');
      expect(result.keywords).toContain('War');
    });

    it('should limit to 6 keywords maximum', () => {
      const item: Partial<UiNewsItem> = {
        keywords: ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'],
        title: 'Test',
        summary: 'Test'
      };

      const result = collectDisplayKeywords(item as UiNewsItem);
      
      expect(result.keywords).toHaveLength(6);
      expect(result.keywords).toEqual(['One', 'Two', 'Three', 'Four', 'Five', 'Six']);
    });

    it('should deduplicate keywords', () => {
      const item: Partial<UiNewsItem> = {
        keywords: [],
        platform_mentions: '',
        title: 'Gaming gaming GAMING strategy Strategy',
        summary: 'More gaming content'
      };

      const result = collectDisplayKeywords(item as UiNewsItem);
      
      // Should only have one instance of each keyword
      const gamingCount = result.keywords.filter(k => k.toLowerCase() === 'gaming').length;
      const strategyCount = result.keywords.filter(k => k.toLowerCase() === 'strategy').length;
      
      expect(gamingCount).toBe(1);
      expect(strategyCount).toBe(1);
    });

    it('should handle empty/null inputs gracefully', () => {
      const item: Partial<UiNewsItem> = {
        keywords: null as any,
        platform_mentions: null,
        title: null,
        summary: null,
        category: null,
        channelTitle: null,
        platform: null
      };

      const result = collectDisplayKeywords(item as UiNewsItem);
      
      expect(result.keywords).toEqual([]);
      expect(result.source).toBe('fallback');
    });
  });
});
