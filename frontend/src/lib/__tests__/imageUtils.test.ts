/**
 * Unit tests for image URL normalization
 */

import { getFreshAIImageUrl, isValidImageUrl, getImageSrc, PLACEHOLDER_IMAGE_URL } from '../imageUtils'

describe('getFreshAIImageUrl', () => {
  beforeEach(() => {
    // Mock Date.now() for consistent cache-busting timestamps
    jest.spyOn(Date, 'now').mockReturnValue(1234567890)
  })
  
  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Case A: filename only', () => {
    it('should normalize filename to local URL', () => {
      const result = getFreshAIImageUrl('abcd.webp')
      expect(result).toBe('/ai_generated_images/abcd.webp?ts=1234567890')
    })

    it('should handle different file extensions', () => {
      expect(getFreshAIImageUrl('test.png')).toBe('/ai_generated_images/test.png?ts=1234567890')
      expect(getFreshAIImageUrl('image.jpg')).toBe('/ai_generated_images/image.jpg?ts=1234567890')
    })
  })

  describe('Case B: relative paths', () => {
    it('should keep /ai_generated_images/ path as-is', () => {
      const result = getFreshAIImageUrl('/ai_generated_images/abcd.webp')
      expect(result).toBe('/ai_generated_images/abcd.webp?ts=1234567890')
    })

    it('should convert public/ai-images/ path to local', () => {
      const result = getFreshAIImageUrl('public/ai-images/abcd.webp')
      expect(result).toBe('/ai_generated_images/abcd.webp?ts=1234567890')
    })
  })

  describe('Case C: full Supabase URLs', () => {
    it('should add cache-busting to existing Supabase URLs', () => {
      const fullUrl = 'https://rerlurdiamxuziiqdmoi.supabase.co/storage/v1/object/public/ai-images/abcd.webp'
      const result = getFreshAIImageUrl(fullUrl)
      expect(result).toBe(`${fullUrl}?ts=1234567890`)
    })

    it('should handle URLs with existing query parameters', () => {
      const urlWithParams = 'https://rerlurdiamxuziiqdmoi.supabase.co/storage/v1/object/public/ai-images/abcd.webp?existing=param'
      const result = getFreshAIImageUrl(urlWithParams)
      expect(result).toBe(`${urlWithParams}&ts=1234567890`)
    })
  })

  describe('Invalid inputs', () => {
    it('should return empty string for falsy values', () => {
      expect(getFreshAIImageUrl(null)).toBe('')
      expect(getFreshAIImageUrl(undefined)).toBe('')
      expect(getFreshAIImageUrl('')).toBe('')
      expect(getFreshAIImageUrl('null')).toBe('')
      expect(getFreshAIImageUrl('undefined')).toBe('')
    })
  })

  describe('Fallback handling', () => {
    it('should treat unknown strings as filenames', () => {
      const result = getFreshAIImageUrl('unknown-format')
      expect(result).toBe('/ai_generated_images/unknown-format?ts=1234567890')
    })
  })
})

describe('isValidImageUrl', () => {
  it('should return false for invalid URLs', () => {
    expect(isValidImageUrl('')).toBe(false)
    expect(isValidImageUrl(null)).toBe(false)
    expect(isValidImageUrl(undefined)).toBe(false)
    expect(isValidImageUrl('null')).toBe(false)
    expect(isValidImageUrl('undefined')).toBe(false)
    expect(isValidImageUrl(PLACEHOLDER_IMAGE_URL)).toBe(false)
    expect(isValidImageUrl('some-placeholder-url')).toBe(false)
  })

  it('should return true for valid URLs', () => {
    expect(isValidImageUrl('https://example.com/image.jpg')).toBe(true)
    expect(isValidImageUrl('https://rerlurdiamxuziiqdmoi.supabase.co/storage/v1/object/public/ai-images/test.webp')).toBe(true)
  })
})

describe('getImageSrc', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1234567890)
  })
  
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should return normalized URL for valid input', () => {
    const result = getImageSrc('/ai_generated_images/test.webp')
    expect(result).toBe('/ai_generated_images/test.webp?ts=1234567890')
  })

  it('should return placeholder for invalid input', () => {
    expect(getImageSrc(null)).toBe(PLACEHOLDER_IMAGE_URL)
    expect(getImageSrc('')).toBe(PLACEHOLDER_IMAGE_URL)
    expect(getImageSrc(undefined)).toBe(PLACEHOLDER_IMAGE_URL)
  })
})
