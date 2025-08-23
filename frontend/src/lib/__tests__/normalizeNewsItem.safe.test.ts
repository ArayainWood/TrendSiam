/**
 * Unit tests for normalizeNewsItem - Safe Image Fallback
 * Ensures normalizer never returns null/undefined images
 */

import { normalizeNewsItem } from '../normalizeNewsItem';
import { PLACEHOLDER_NEWS_IMAGE } from '../imageUrl';

describe('normalizeNewsItem - Safe Image Fallback', () => {
  it('should never return null or undefined display_image_url', () => {
    const testCases = [
      // Case 1: No image data at all
      {},
      
      // Case 2: Null image fields
      { ai_image_url: null, display_image_url_raw: null },
      
      // Case 3: Empty string image fields
      { ai_image_url: '', display_image_url_raw: '' },
      
      // Case 4: Undefined image fields
      { ai_image_url: undefined, display_image_url_raw: undefined },
      
      // Case 5: Only placeholder from DB
      { display_image_url_raw: '/placeholder-image.svg', is_ai_image: false },
      
      // Case 6: Valid AI image
      { ai_image_url: 'https://example.com/ai-image.jpg', display_image_url_raw: 'https://example.com/ai-image.jpg', is_ai_image: true },
      
      // Case 7: Relative path that needs conversion
      { ai_image_url: 'relative/path/image.jpg', display_image_url_raw: 'relative/path/image.jpg', is_ai_image: true }
    ];

    testCases.forEach((testCase, index) => {
      const result = normalizeNewsItem(testCase);
      
      // Must always have a display_image_url
      expect(result.display_image_url).toBeDefined();
      expect(result.display_image_url).not.toBeNull();
      expect(result.display_image_url).not.toBe('');
      expect(typeof result.display_image_url).toBe('string');
      
      // Must always have is_ai_image boolean
      expect(typeof result.is_ai_image).toBe('boolean');
      
      console.log(`Test case ${index + 1}:`, {
        input: testCase,
        output: {
          display_image_url: result.display_image_url,
          is_ai_image: result.is_ai_image
        }
      });
    });
  });

  it('should use placeholder for cases with no valid image', () => {
    const noImageCases = [
      {},
      { ai_image_url: null },
      { display_image_url_raw: null },
      { display_image_url_raw: '/placeholder-image.svg' }
    ];

    noImageCases.forEach((testCase) => {
      const result = normalizeNewsItem(testCase);
      expect(result.display_image_url).toBe(PLACEHOLDER_NEWS_IMAGE);
      expect(result.is_ai_image).toBe(false);
    });
  });

  it('should preserve AI image flag when provided by database', () => {
    const aiImageCase = {
      ai_image_url: 'https://example.com/ai-image.jpg',
      display_image_url_raw: 'https://example.com/ai-image.jpg',
      is_ai_image: true
    };

    const result = normalizeNewsItem(aiImageCase);
    expect(result.display_image_url).toBe('https://example.com/ai-image.jpg');
    expect(result.is_ai_image).toBe(true);
  });

  it('should handle numeric fields safely', () => {
    const testCase = {
      popularity_score: '85.5',
      popularity_score_precise: 87.2,
      growth_rate: '12.3',
      view_count: '1500000',
      like_count: '25000'
    };

    const result = normalizeNewsItem(testCase);
    
    expect(result.scorePrecise).toBe(87.2);
    expect(result.scoreRounded).toBe(87);
    expect(result.growth_rate).toBe(12.3);
    expect(result.view_count).toBe(1500000);
    expect(result.like_count).toBe(25000);
  });

  it('should provide safe defaults for missing numeric fields', () => {
    const testCase = {
      // No numeric fields provided
    };

    const result = normalizeNewsItem(testCase);
    
    expect(result.scorePrecise).toBe(0);
    expect(result.scoreRounded).toBe(0);
    expect(result.growth_rate).toBeNull();
    expect(result.view_count).toBeNull();
    expect(result.like_count).toBeNull();
  });
});
