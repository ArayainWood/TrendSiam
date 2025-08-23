import { describe, it, expect } from 'vitest';
import { mapDbToUi, type DbNewsRow } from '../canonical';

describe('DB to UI Mapping', () => {
  const mockDbRow: DbNewsRow = {
    id: 'test-123',
    title: 'Test Story',
    summary: 'ข่าวทดสอบภาษาไทย',
    summary_en: 'Test story in English',
    description: 'Full description',
    category: 'Technology',
    platform: 'youtube',
    date: '2025-08-21',
    created_at: '2025-08-21T12:00:00Z',
    updated_at: '2025-08-21T12:00:00Z',
    popularity_score: 85.5,
    popularity_score_precise: 85.567,
    view_count: 1500000,
    like_count: 75000,
    comment_count: 5000,
    published_date: '2025-08-20T10:00:00Z',
    video_id: 'abc123',
    channel: 'Test Channel',
    duration: '10:30',
    reason: 'Trending due to high engagement',
    raw_view: '1.5M',
    growth_rate: 125000,
    platform_mentions: '5',
    keywords: 'tech,ai,trending',
    ai_opinion: 'Interesting tech content',
    score_details: 'High engagement metrics',
    summary_date: '2025-08-21',
    external_id: 'ext123',
    ai_image_url: 'https://example.com/ai-image.jpg',
    ai_image_prompt: 'A futuristic tech scene with AI elements',
    image_url: null,
    rank: 1,
  };

  describe('core field mappings', () => {
    it('should map published_date to publishedAt', () => {
      const result = mapDbToUi(mockDbRow);
      expect(result.publishedAt).toBe('2025-08-20T10:00:00Z');
    });

    it('should map summary_en to summaryEn', () => {
      const result = mapDbToUi(mockDbRow);
      expect(result.summaryEn).toBe('Test story in English');
    });

    it('should map ai_image_prompt to aiImagePrompt', () => {
      const result = mapDbToUi(mockDbRow);
      expect(result.aiImagePrompt).toBe('A futuristic tech scene with AI elements');
    });

    it('should map numeric fields correctly', () => {
      const result = mapDbToUi(mockDbRow);
      expect(result.views).toBe(1500000);
      expect(result.likes).toBe(75000);
      expect(result.comments).toBe(5000);
      expect(result.growthRate).toBe(125000);
    });
  });

  describe('fallback handling', () => {
    it('should use publish_time as fallback for publishedAt', () => {
      const rowWithPublishTime = {
        ...mockDbRow,
        published_date: null,
        publish_time: '2025-08-19T08:00:00Z'
      } as any;
      
      const result = mapDbToUi(rowWithPublishTime);
      expect(result.publishedAt).toBe('2025-08-19T08:00:00Z');
    });

    it('should handle missing summary_en', () => {
      const rowWithoutEn = {
        ...mockDbRow,
        summary_en: null
      };
      
      const result = mapDbToUi(rowWithoutEn);
      expect(result.summaryEn).toBe(null);
    });

    it('should handle missing ai_image_prompt', () => {
      const rowWithoutPrompt = {
        ...mockDbRow,
        ai_image_prompt: null
      };
      
      const result = mapDbToUi(rowWithoutPrompt);
      expect(result.aiImagePrompt).toBe(null);
    });
  });

  describe('popularity subtext generation', () => {
    it('should generate meaningful popularity subtext', () => {
      const result = mapDbToUi(mockDbRow);
      expect(result.popularitySubtext).toContain('High engagement');
      expect(result.popularitySubtext).toContain('1.5M+ views');
      expect(result.popularitySubtext).toContain('like rate 5.0%');
      expect(result.popularitySubtext).toContain('Viral growth');
    });

    it('should handle low engagement', () => {
      const lowEngagement = {
        ...mockDbRow,
        view_count: 1000,
        like_count: 10,
        growth_rate: 100
      };
      
      const result = mapDbToUi(lowEngagement);
      expect(result.popularitySubtext).toContain('Low engagement');
      expect(result.popularitySubtext).toContain('1K+ views');
      expect(result.popularitySubtext).toContain('like rate 1.0%');
    });
  });

  describe('image handling', () => {
    it('should use ai_image_url when available', () => {
      const result = mapDbToUi(mockDbRow);
      expect(result.displayImageUrl).toBe('https://example.com/ai-image.jpg');
      expect(result.isAIImage).toBe(true);
    });

    it('should use snapshot image_url as fallback', () => {
      const rowWithSnapshot = {
        ...mockDbRow,
        ai_image_url: null,
        image_url: 'https://example.com/snapshot.jpg'
      };
      
      const result = mapDbToUi(rowWithSnapshot);
      expect(result.displayImageUrl).toBe('https://example.com/snapshot.jpg');
      expect(result.isAIImage).toBe(false);
    });

    it('should use placeholder when no images available', () => {
      const rowNoImages = {
        ...mockDbRow,
        ai_image_url: null,
        image_url: null
      };
      
      const result = mapDbToUi(rowNoImages);
      expect(result.displayImageUrl).toBe('/placeholder-image.svg');
      expect(result.isAIImage).toBe(false);
    });
  });
});
