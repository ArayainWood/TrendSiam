/**
 * Tests for formatting utilities
 */

import { humanize, likeRate, growthDescriptor, formatGrowthRate, getEngagementLabel } from '../formatUtils';

describe('humanize', () => {
  it('should format large numbers correctly', () => {
    expect(humanize(1500000)).toBe('1.5M');
    expect(humanize(1200)).toBe('1.2K');
    expect(humanize(500)).toBe('500');
    expect(humanize('2500000')).toBe('2.5M');
    expect(humanize(null)).toBe('0');
    expect(humanize(undefined)).toBe('0');
  });
});

describe('likeRate', () => {
  it('should calculate like rate correctly', () => {
    expect(likeRate(1000, 50)).toBe('5.0');
    expect(likeRate(0, 10)).toBe('0.0');
    expect(likeRate(null, 10)).toBe('0.0');
    expect(likeRate('1000', '25')).toBe('2.5');
  });
});

describe('growthDescriptor', () => {
  it('should return correct descriptors', () => {
    expect(growthDescriptor(150000)).toBe('Viral growth');
    expect(growthDescriptor(15000)).toBe('Strong growth');
    expect(growthDescriptor(5000)).toBe('Moderate growth');
    expect(growthDescriptor(0)).toBe('Flat');
    expect(growthDescriptor(-100)).toBe('Declining');
    expect(growthDescriptor(null)).toBe('N/A');
    expect(growthDescriptor(undefined)).toBe('N/A');
    expect(growthDescriptor('')).toBe('N/A');
  });
});

describe('formatGrowthRate', () => {
  it('should format growth rates with correct signs and colors', () => {
    const positive = formatGrowthRate(12.5);
    expect(positive.formatted).toBe('+12.5%');
    expect(positive.color).toBe('green');
    expect(positive.sign).toBe('+');

    const negative = formatGrowthRate(-5.2);
    expect(negative.formatted).toBe('−5.2%');
    expect(negative.color).toBe('red');
    expect(negative.sign).toBe('−');

    const zero = formatGrowthRate(0);
    expect(zero.formatted).toBe('±0.0%');
    expect(zero.color).toBe('gray');
    expect(zero.sign).toBe('±');

    const nullValue = formatGrowthRate(null);
    expect(nullValue.formatted).toBe('N/A');
    expect(nullValue.color).toBe('gray');
  });
});

describe('getEngagementLabel', () => {
  it('should return correct engagement labels', () => {
    expect(getEngagementLabel(90)).toBe('High engagement');
    expect(getEngagementLabel(65)).toBe('Medium engagement');
    expect(getEngagementLabel(30)).toBe('Low engagement');
    expect(getEngagementLabel(80)).toBe('High engagement');
    expect(getEngagementLabel(50)).toBe('Medium engagement');
  });
});
