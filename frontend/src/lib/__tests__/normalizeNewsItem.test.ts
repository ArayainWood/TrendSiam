/**
 * Unit tests for normalizeNewsItem
 * Ensures robust handling of partial data and safe defaults
 */

import { normalizeNewsItem, normalizeNewsItems, UINewsItem } from '../normalizeNewsItem'

describe('normalizeNewsItem', () => {
  
  test('should normalize a complete news item', () => {
    const rawItem = {
      id: 'test-123',
      title: 'Test News Title',
      summary: 'Test summary',
      category: 'ENTERTAINMENT',
      platform: 'YouTube',
      display_image_url_raw: 'https://example.com/image.jpg',
      ai_image_url: 'https://example.com/ai-image.jpg',
      is_ai_image: true,
      popularity_score: 85,
      popularity_score_precise: 85.7,
      growth_rate: 150000,
      view_count: 1000000,
      views: 1000000,
      like_count: 50000,
      likes: 50000,
      comment_count: 5000,
      comments: 5000,
      published_at: '2024-01-15T10:00:00Z',
      channel_title: 'Test Channel',
      video_id: 'abc123',
      reason: 'High engagement and viral growth',
      keywords: 'music, viral, trending',
      ai_opinion: 'This content shows strong viral potential',
      score_details: 'Detailed scoring explanation',
      updated_at: '2024-01-15T12:00:00Z',
      summary_date: '2024-01-15',
      ai_image_prompt: 'A vibrant music scene'
    }

    const result = normalizeNewsItem(rawItem)

    expect(result).toMatchObject({
      id: 'test-123',
      title: 'Test News Title',
      summary: 'Test summary',
      category: 'ENTERTAINMENT',
      platform: 'YouTube',
      displayImageUrl: 'https://example.com/image.jpg',
      isAIImage: true,
      popularityScore: 85.7,
      growthRate: 150000,
      views: 1000000,
      likes: 50000,
      comments: 5000,
      publishedAt: '2024-01-15T10:00:00Z',
      channelTitle: 'Test Channel',
      originalUrl: 'https://www.youtube.com/watch?v=abc123',
      reason: 'High engagement and viral growth',
      keywords: ['music', 'viral', 'trending'],
      aiOpinion: 'This content shows strong viral potential',
      scoreDetails: 'Detailed scoring explanation',
      updatedAt: '2024-01-15T12:00:00Z',
      summaryDate: '2024-01-15',
      externalId: 'abc123'
    })

    // Legacy compatibility fields
    expect(result.video_id).toBe('abc123')
    expect(result.channel).toBe('Test Channel')
    expect(result.popularity_score).toBe(85.7)
    expect(result.is_ai_image).toBe(true)
  })

  test('should handle minimal data with safe defaults', () => {
    const rawItem = {
      id: 'minimal-123',
      title: 'Minimal Title'
    }

    const result = normalizeNewsItem(rawItem)

    expect(result.id).toBe('minimal-123')
    expect(result.title).toBe('Minimal Title')
    expect(result.summary).toBeNull()
    expect(result.category).toBeNull()
    expect(result.platform).toBeNull()
    expect(result.displayImageUrl).toBe('/placeholder-image.svg')
    expect(result.isAIImage).toBe(false)
    expect(result.popularityScore).toBe(0)
    expect(result.growthRate).toBeNull()
    expect(result.views).toBeNull()
    expect(result.likes).toBeNull()
    expect(result.comments).toBeNull()
    expect(result.publishedAt).toBeNull()
    expect(result.channelTitle).toBeNull()
    expect(result.originalUrl).toBeNull()
    expect(result.reason).toBeNull()
    expect(result.keywords).toEqual([])
    expect(result.aiOpinion).toBeNull()
    expect(result.scoreDetails).toBeNull()
    expect(result.updatedAt).toBeNull()
    expect(result.summaryDate).toBeNull()
    expect(result.externalId).toBeNull()
  })

  test('should parse keywords from different formats', () => {
    const testCases = [
      { input: 'music, viral, trending', expected: ['music', 'viral', 'trending'] },
      { input: '["music", "viral", "trending"]', expected: ['music', 'viral', 'trending'] },
      { input: 'music viral trending', expected: ['music', 'viral', 'trending'] },
      { input: '', expected: [] },
      { input: 'N/A', expected: [] },
      { input: null, expected: [] },
      { input: undefined, expected: [] }
    ]

    testCases.forEach(({ input, expected }) => {
      const rawItem = {
        id: 'test-keywords',
        title: 'Test Keywords',
        keywords: input
      }

      const result = normalizeNewsItem(rawItem)
      expect(result.keywords).toEqual(expected)
    })
  })

  test('should handle numeric field coercion', () => {
    const rawItem = {
      id: 'numeric-test',
      title: 'Numeric Test',
      popularity_score: '85.5',
      growth_rate: '150000',
      view_count: '1,000,000',
      like_count: 50000,
      comment_count: null
    }

    const result = normalizeNewsItem(rawItem)

    expect(result.popularityScore).toBe(85.5)
    expect(result.growthRate).toBe(150000)
    expect(result.views).toBe(1000000)
    expect(result.likes).toBe(50000)
    expect(result.comments).toBeNull()
  })

  test('should detect AI images correctly', () => {
    const testCases = [
      {
        display_image_url_raw: 'https://example.com/ai_generated_images/test.jpg',
        is_ai_image: false,
        expected: true // Should detect from path
      },
      {
        display_image_url_raw: 'https://example.com/regular-image.jpg',
        is_ai_image: true,
        expected: true // Should use is_ai_image flag
      },
      {
        display_image_url_raw: '/placeholder-image.svg',
        is_ai_image: false,
        expected: false // Placeholder is not AI
      }
    ]

    testCases.forEach(({ display_image_url_raw, is_ai_image, expected }, index) => {
      const rawItem = {
        id: `ai-test-${index}`,
        title: 'AI Test',
        display_image_url_raw,
        is_ai_image
      }

      const result = normalizeNewsItem(rawItem)
      expect(result.isAIImage).toBe(expected)
    })
  })

  test('should throw error for missing required fields', () => {
    expect(() => normalizeNewsItem(null)).toThrow('Cannot normalize null/undefined news item')
    expect(() => normalizeNewsItem({})).toThrow('News item missing required id field')
    expect(() => normalizeNewsItem({ id: 'test' })).toThrow('News item missing required title field')
  })

  test('should filter N/A values for optional fields', () => {
    const rawItem = {
      id: 'na-test',
      title: 'N/A Test',
      ai_opinion: 'N/A',
      reason: 'N/A',
      keywords: 'N/A'
    }

    const result = normalizeNewsItem(rawItem)

    expect(result.aiOpinion).toBeNull()
    expect(result.reason).toBeNull()
    expect(result.keywords).toEqual([])
  })
})

describe('normalizeNewsItems', () => {
  
  test('should normalize array of items', () => {
    const rawItems = [
      { id: '1', title: 'Title 1' },
      { id: '2', title: 'Title 2' }
    ]

    const result = normalizeNewsItems(rawItems)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('1')
    expect(result[1].id).toBe('2')
  })

  test('should handle invalid items gracefully', () => {
    const rawItems = [
      { id: '1', title: 'Valid Title' },
      null, // Invalid item
      { id: '3', title: 'Another Valid Title' }
    ]

    const result = normalizeNewsItems(rawItems)

    // Should have 2 valid items + 1 fallback item
    expect(result).toHaveLength(3)
    expect(result[0].id).toBe('1')
    expect(result[1].id).toBe('fallback-1') // Fallback for null item
    expect(result[2].id).toBe('3')
  })

  test('should filter out completely invalid items', () => {
    const rawItems = [
      { id: '1', title: 'Valid Title' },
      { id: '2' }, // Missing title - should create fallback but then be filtered
      { title: 'Missing ID' } // Missing ID - should create fallback but then be filtered
    ]

    const result = normalizeNewsItems(rawItems)

    // Only the valid item should remain after filtering
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  test('should handle non-array input', () => {
    expect(normalizeNewsItems(null as any)).toEqual([])
    expect(normalizeNewsItems(undefined as any)).toEqual([])
    expect(normalizeNewsItems('not an array' as any)).toEqual([])
  })
})

// Runtime assertion test
describe('Runtime Safety', () => {
  
  test('normalized item should always have displayImageUrl', () => {
    const testCases = [
      { id: '1', title: 'No Image' },
      { id: '2', title: 'Null Image', display_image_url_raw: null },
      { id: '3', title: 'Empty Image', display_image_url_raw: '' }
    ]

    testCases.forEach(rawItem => {
      const result = normalizeNewsItem(rawItem)
      expect(result.displayImageUrl).toBeTruthy()
      expect(typeof result.displayImageUrl).toBe('string')
    })
  })

  test('normalized item should always have valid popularityScore', () => {
    const testCases = [
      { id: '1', title: 'No Score' },
      { id: '2', title: 'Invalid Score', popularity_score: 'invalid' },
      { id: '3', title: 'Null Score', popularity_score: null }
    ]

    testCases.forEach(rawItem => {
      const result = normalizeNewsItem(rawItem)
      expect(typeof result.popularityScore).toBe('number')
      expect(result.popularityScore).toBeGreaterThanOrEqual(0)
    })
  })
})