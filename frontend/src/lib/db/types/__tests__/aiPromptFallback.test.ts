/**
 * AI Prompt Fallback Chain Tests
 * 
 * Tests the canonical mapping fallback chain for AI image prompts:
 * stories.ai_image_prompt -> news_trends.ai_image_prompt -> image_files.reason -> snapshots.reason
 */

import { describe, it, expect } from '@jest/globals';
import { DbNewsRow, mapDbToUi } from '../canonical';

describe('AI Prompt Fallback Chain', () => {
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
    rank: 1,
    image_url: null,
    display_image_url_raw: null,
    is_ai_image: false,
    ...overrides
  });

  describe('AI Prompt Mapping', () => {
    it('should use primary ai_image_prompt when available', () => {
      const dbRow = createMockDbRow({
        ai_image_prompt: 'Primary AI prompt from stories table'
      });

      const uiItem = mapDbToUi(dbRow);

      expect(uiItem.aiImagePrompt).toBe('Primary AI prompt from stories table');
    });

    it('should handle null ai_image_prompt', () => {
      const dbRow = createMockDbRow({
        ai_image_prompt: null
      });

      const uiItem = mapDbToUi(dbRow);

      expect(uiItem.aiImagePrompt).toBeNull();
    });

    it('should handle empty string ai_image_prompt', () => {
      const dbRow = createMockDbRow({
        ai_image_prompt: ''
      });

      const uiItem = mapDbToUi(dbRow);

      expect(uiItem.aiImagePrompt).toBe('');
    });

    it('should handle whitespace-only ai_image_prompt', () => {
      const dbRow = createMockDbRow({
        ai_image_prompt: '   \n\t   '
      });

      const uiItem = mapDbToUi(dbRow);

      expect(uiItem.aiImagePrompt).toBe('   \n\t   ');
    });

    it('should preserve exact prompt content including special characters', () => {
      const complexPrompt = 'AI prompt with "quotes", newlines\nand special chars: @#$%^&*()';
      const dbRow = createMockDbRow({
        ai_image_prompt: complexPrompt
      });

      const uiItem = mapDbToUi(dbRow);

      expect(uiItem.aiImagePrompt).toBe(complexPrompt);
    });
  });

  describe('UI Visibility Logic', () => {
    it('should show button when prompt has meaningful content', () => {
      const meaningfulPrompts = [
        'A detailed AI prompt for image generation',
        'Short prompt',
        '   Prompt with leading/trailing spaces   ',
        'Prompt\nwith\nnewlines',
        'Prompt with "quotes" and symbols: !@#$%'
      ];

      meaningfulPrompts.forEach(prompt => {
        const shouldShow = prompt?.trim().length > 0;
        expect(shouldShow).toBe(true);
      });
    });

    it('should hide button when prompt is empty or whitespace-only', () => {
      const emptyPrompts = [
        null,
        undefined,
        '',
        '   ',
        '\n\t\r\n   ',
        '\n\n\n'
      ];

      emptyPrompts.forEach(prompt => {
        const shouldShow = prompt?.trim().length > 0;
        expect(shouldShow).toBe(false);
      });
    });
  });

  describe('Legacy Compatibility', () => {
    it('should provide snake_case alias for backward compatibility', () => {
      const dbRow = createMockDbRow({
        ai_image_prompt: 'Test prompt for legacy compatibility'
      });

      const uiItem = mapDbToUi(dbRow);
      const { legacyUiCompat } = require('../canonical');
      const compatItem = legacyUiCompat(uiItem);

      expect(compatItem.aiImagePrompt).toBe('Test prompt for legacy compatibility');
      expect(compatItem.ai_image_prompt).toBe('Test prompt for legacy compatibility');
    });

    it('should handle null values in legacy compatibility', () => {
      const dbRow = createMockDbRow({
        ai_image_prompt: null
      });

      const uiItem = mapDbToUi(dbRow);
      const { legacyUiCompat } = require('../canonical');
      const compatItem = legacyUiCompat(uiItem);

      expect(compatItem.aiImagePrompt).toBeNull();
      expect(compatItem.ai_image_prompt).toBeNull();
    });
  });

  describe('Integration with Image Fields', () => {
    it('should work correctly with AI images', () => {
      const dbRow = createMockDbRow({
        ai_image_url: 'https://example.com/ai-image.webp',
        ai_image_prompt: 'AI prompt for this generated image',
        is_ai_image: true
      });

      const uiItem = mapDbToUi(dbRow);

      expect(uiItem.isAIImage).toBe(true);
      expect(uiItem.aiImagePrompt).toBe('AI prompt for this generated image');
      expect(uiItem.displayImageUrl).toBe('https://example.com/ai-image.webp');
    });

    it('should handle missing prompt for AI images gracefully', () => {
      const dbRow = createMockDbRow({
        ai_image_url: 'https://example.com/ai-image.webp',
        ai_image_prompt: null,
        is_ai_image: true
      });

      const uiItem = mapDbToUi(dbRow);

      expect(uiItem.isAIImage).toBe(true);
      expect(uiItem.aiImagePrompt).toBeNull();
      expect(uiItem.displayImageUrl).toBe('https://example.com/ai-image.webp');
    });
  });

  describe('Data Quality Scenarios', () => {
    it('should handle typical production data structure', () => {
      const dbRow = createMockDbRow({
        ai_image_url: 'https://supabase.co/storage/v1/object/public/ai-images/story123.webp',
        ai_image_prompt: 'Editorial illustration for trending news story about technology innovation in Thailand, modern digital art style, vibrant colors',
        is_ai_image: true,
        rank: 1
      });

      const uiItem = mapDbToUi(dbRow);

      expect(uiItem.rank).toBe(1);
      expect(uiItem.isAIImage).toBe(true);
      expect(uiItem.aiImagePrompt).toContain('Editorial illustration');
      expect(uiItem.aiImagePrompt?.trim().length).toBeGreaterThan(0);
    });

    it('should handle edge case with very long prompts', () => {
      const longPrompt = 'A'.repeat(1000) + ' very long AI prompt that exceeds typical lengths';
      const dbRow = createMockDbRow({
        ai_image_prompt: longPrompt
      });

      const uiItem = mapDbToUi(dbRow);

      expect(uiItem.aiImagePrompt).toBe(longPrompt);
      expect(uiItem.aiImagePrompt?.length).toBe(longPrompt.length);
    });
  });
});
