/**
 * Type tests for SnapshotItem
 * 
 * These tests ensure type safety and consistency across the snapshot system
 */

import { SnapshotItem, isSnapshotItem, toScoreString, toCountNumber } from '../snapshots';

// Type test: Ensure SnapshotItem has all required fields
const validItem: SnapshotItem = {
  id: 'test-id',
  rank: 1,
  title: 'Test Title',
  platform: 'YouTube',
  video_id: 'abc123',
  channel: 'Test Channel',
  category: 'Entertainment',
  summary: 'Test summary',
  summary_en: 'Test summary in English',
  description: 'Full description',
  keywords: ['test', 'keywords'],
  ai_image_url: 'https://example.com/image.jpg',
  ai_image_prompt: 'Test prompt',
  published_at: '2024-01-01T00:00:00Z',
  created_at: '2024-01-01T00:00:00Z',
  ingested_at: '2024-01-01T00:00:00Z',
  view_count: '1000',
  like_count: '100',
  comment_count: '10',
  popularity_score: 85,
  popularity_score_precise: 85.5,
  score_details: { raw: 85.5 }
};

// Type test: Ensure minimal item works
const minimalItem: SnapshotItem = {
  id: 'min-id',
  rank: 2,
  title: 'Minimal Title',
  platform: 'X'
};

// Utility tests
describe('SnapshotItem utilities', () => {
  describe('toScoreString', () => {
    it('converts numbers to strings', () => {
      expect(toScoreString(85.5)).toBe('85.5');
      expect(toScoreString(100)).toBe('100');
      expect(toScoreString(0)).toBe('0');
    });

    it('handles null and undefined', () => {
      expect(toScoreString(null)).toBe('0');
      expect(toScoreString(undefined)).toBe('0');
    });

    it('handles string inputs', () => {
      expect(toScoreString('85.5')).toBe('85.5');
      expect(toScoreString('invalid')).toBe('0');
    });
  });

  describe('toCountNumber', () => {
    it('converts strings to numbers', () => {
      expect(toCountNumber('1000')).toBe(1000);
      expect(toCountNumber('1,000')).toBe(1000);
      expect(toCountNumber('1,000,000')).toBe(1000000);
    });

    it('handles null and undefined', () => {
      expect(toCountNumber(null)).toBe(0);
      expect(toCountNumber(undefined)).toBe(0);
    });

    it('handles number inputs', () => {
      expect(toCountNumber(1000)).toBe(1000);
      expect(toCountNumber(0)).toBe(0);
    });
  });

  describe('isSnapshotItem', () => {
    it('validates valid items', () => {
      expect(isSnapshotItem(validItem)).toBe(true);
      expect(isSnapshotItem(minimalItem)).toBe(true);
    });

    it('rejects invalid items', () => {
      expect(isSnapshotItem(null)).toBe(false);
      expect(isSnapshotItem(undefined)).toBe(false);
      expect(isSnapshotItem({})).toBe(false);
      expect(isSnapshotItem({ id: 'test' })).toBe(false);
      expect(isSnapshotItem({ id: 'test', title: 'Test' })).toBe(false);
      expect(isSnapshotItem({ id: 'test', title: 'Test', rank: 'not-a-number' })).toBe(false);
    });
  });
});

// Type assertion tests to ensure compatibility
function acceptsSnapshotItems(items: SnapshotItem[]): void {
  // This function ensures arrays of SnapshotItem work correctly
  items.forEach(item => {
    console.log(item.id, item.title, item.rank);
  });
}

// Test that our types work with the function
acceptsSnapshotItems([validItem, minimalItem]);
