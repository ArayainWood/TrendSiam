#!/usr/bin/env npx tsx
/**
 * Test script for tuple type safety with pairwise function
 */

import { pairwise } from '../src/utils/array';
import type { HomeItem } from '../src/types/home';

console.log('Testing tuple type safety...\n');

// Test 1: Basic tuple destructuring
console.log('1. Testing basic tuple destructuring:');
const numbers = [1, 2, 3, 4, 5];
const numberPairs = pairwise(numbers);

// This should work with proper tuple typing
for (const [prev, curr] of numberPairs) {
  console.log(`   Pair: ${prev} -> ${curr}`);
}

// Test 2: HomeItem type
console.log('\n2. Testing HomeItem type:');
const testData: HomeItem[] = [
  {
    id: '1',
    title: 'Story 1',
    popularity_score_precise: 100,
    view_count: '1000'
  },
  {
    id: '2', 
    title: 'Story 2',
    popularity_score_precise: 90,
    view_count: '2000'
  },
  {
    id: '3',
    title: 'Story 3',
    popularity_score_precise: 90,
    view_count: '1500'
  }
];

const homePairs = pairwise(testData);

// Test both iteration methods
console.log('   Using for...of:');
for (const [prev, curr] of homePairs) {
  console.log(`   ${prev.title} (${prev.popularity_score_precise}) -> ${curr.title} (${curr.popularity_score_precise})`);
}

console.log('   Using index access:');
for (let i = 0; i < homePairs.length; i++) {
  const [prev, curr] = homePairs[i]; // This should work with proper tuple typing
  console.log(`   ${prev.title} -> ${curr.title}`);
}

// Test 3: Type safety
console.log('\n3. Testing type safety:');
const firstPair = homePairs[0];
if (firstPair) {
  const [item1, item2] = firstPair;
  console.log(`   First pair: ${item1.title} -> ${item2.title}`);
  console.log(`   Types preserved: id is ${typeof item1.id}, score is ${typeof item1.popularity_score_precise}`);
}

// Test 4: Empty and single-item arrays
console.log('\n4. Testing edge cases:');
console.log('   Empty array pairs:', pairwise([]).length); // Should be 0
console.log('   Single item pairs:', pairwise(['only']).length); // Should be 0

console.log('\n✅ All tuple type tests completed');
