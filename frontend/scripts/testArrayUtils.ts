#!/usr/bin/env npx tsx
/**
 * Test script for array utilities and type guards
 */

import { pairwise } from '../src/utils/array';
import { isDefined, hasRequiredFields } from '../src/utils/typeGuards';
import { toNumber } from '../src/utils/normalize';

console.log('Testing array utilities...\n');

// Test pairwise with different arrays
console.log('1. Testing pairwise function:');
console.log('   Empty array:', pairwise([])); // Should be []
console.log('   Single element:', pairwise([1])); // Should be []
console.log('   Two elements:', pairwise([1, 2])); // Should be [[1, 2]]
console.log('   Multiple elements:', pairwise([1, 2, 3, 4])); // Should be [[1, 2], [2, 3], [3, 4]]

// Test type guards
console.log('\n2. Testing isDefined:');
const mixedArray = [1, undefined, null, 2, 3, undefined];
console.log('   Original:', mixedArray);
console.log('   Filtered:', mixedArray.filter(isDefined)); // Should be [1, 2, 3]

// Test hasRequiredFields
console.log('\n3. Testing hasRequiredFields:');
const testData = [
  { created_at: '2024-01-01', view_count: 100, popularity_score_precise: 85 },
  { created_at: '2024-01-02', view_count: null, popularity_score_precise: 90 },
  null,
  { created_at: '2024-01-03', view_count: '200', popularity_score_precise: 75 },
  undefined,
  { created_at: null, view_count: 150, popularity_score_precise: 80 }
];
console.log('   Test data:', testData.length, 'items');
console.log('   Valid items:', testData.filter(hasRequiredFields).length); // Should be 2

// Test toNumber
console.log('\n4. Testing toNumber:');
console.log('   "123":', toNumber('123')); // Should be 123
console.log('   "abc":', toNumber('abc')); // Should be 0
console.log('   null:', toNumber(null)); // Should be 0
console.log('   undefined:', toNumber(undefined)); // Should be 0
console.log('   "45.67":', toNumber('45.67')); // Should be 45.67

// Test sorting validation with pairwise
console.log('\n5. Testing sort validation with pairwise:');
const sortedData = [
  { score: 100, views: '1000' },
  { score: 90, views: '2000' },
  { score: 90, views: '1500' },
  { score: 80, views: '3000' }
];

const pairs = pairwise(sortedData);
let violations = 0;

for (const [prev, curr] of pairs) {
  if (prev.score < curr.score) {
    console.log(`   ❌ Primary sort violation: ${prev.score} < ${curr.score}`);
    violations++;
  } else if (prev.score === curr.score) {
    const prevViews = toNumber(prev.views);
    const currViews = toNumber(curr.views);
    if (prevViews < currViews) {
      console.log(`   ❌ Secondary sort violation: ${prevViews} < ${currViews} (when scores equal)`);
      violations++;
    }
  }
}

if (violations === 0) {
  console.log('   ✅ Sort order is valid');
}

console.log('\n✅ All tests completed');
