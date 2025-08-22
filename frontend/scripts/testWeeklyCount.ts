#!/usr/bin/env npx tsx
/**
 * Test Weekly Snapshot Counting
 * 
 * Verifies that Total Stories count is consistent across the pipeline
 * Usage: npx tsx scripts/testWeeklyCount.ts
 */

import { fetchLatestPublishedWeekly, countTotalStories } from '../src/lib/weekly/weeklyRepo';
import { fetchWeeklySnapshot } from '../src/lib/data/weeklySnapshot';

async function main() {
  console.log('='.repeat(60));
  console.log('Weekly Snapshot Count Test');
  console.log('='.repeat(60));
  console.log('');
  
  try {
    // Test 1: Repository direct fetch
    console.log('Test 1: Repository Layer');
    console.log('-'.repeat(30));
    
    const repoSnapshot = await fetchLatestPublishedWeekly();
    if (!repoSnapshot) {
      console.error('❌ No snapshot found via repository');
      process.exit(1);
    }
    
    const repoCount = countTotalStories(repoSnapshot);
    console.log('Snapshot ID:', repoSnapshot.snapshot_id);
    console.log('Status:', repoSnapshot.status);
    console.log('Items array length:', repoSnapshot.items?.length ?? 'null');
    console.log('Meta totalItems:', repoSnapshot.meta?.totalItems ?? 'null');
    console.log('Count function result:', repoCount);
    console.log('');
    
    // Test 2: UI data fetcher
    console.log('Test 2: UI Data Layer');
    console.log('-'.repeat(30));
    
    const uiData = await fetchWeeklySnapshot();
    console.log('Snapshot ID:', uiData.snapshotId);
    console.log('Success:', uiData.success);
    console.log('Items array length:', uiData.items?.length ?? 'null');
    console.log('Metrics totalStories:', uiData.metrics.totalStories);
    console.log('');
    
    // Test 3: Consistency check
    console.log('Test 3: Consistency Check');
    console.log('-'.repeat(30));
    
    const allMatch = 
      repoSnapshot.snapshot_id === uiData.snapshotId &&
      repoCount === uiData.metrics.totalStories &&
      repoSnapshot.items.length === uiData.items.length;
    
    if (allMatch) {
      console.log('✅ All counts match!');
      console.log(`   Total Stories: ${uiData.metrics.totalStories}`);
    } else {
      console.error('❌ Count mismatch detected!');
      console.log('   Repository count:', repoCount);
      console.log('   UI totalStories:', uiData.metrics.totalStories);
      console.log('   Items length (repo):', repoSnapshot.items.length);
      console.log('   Items length (UI):', uiData.items.length);
    }
    
    // Test 4: Check for common issues
    console.log('');
    console.log('Test 4: Common Issues Check');
    console.log('-'.repeat(30));
    
    // Check for null/undefined items
    if (!repoSnapshot.items || !Array.isArray(repoSnapshot.items)) {
      console.error('❌ Items array is null or not an array');
    } else {
      console.log('✅ Items array is valid');
    }
    
    // Check for zero items with non-zero meta
    if (repoSnapshot.items.length === 0 && repoSnapshot.meta?.totalItems > 0) {
      console.warn('⚠️  Items array empty but meta.totalItems is', repoSnapshot.meta.totalItems);
    }
    
    // Check date ranges
    const start = new Date(repoSnapshot.range_start);
    const end = new Date(repoSnapshot.range_end);
    const rangeDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    console.log(`Date range: ${rangeDays.toFixed(1)} days`);
    
    if (Math.abs(rangeDays - 7) > 0.5) {
      console.warn('⚠️  Date range is not exactly 7 days');
    }
    
    // Summary
    console.log('');
    console.log('='.repeat(60));
    console.log('Summary:');
    console.log(`Snapshot ${repoSnapshot.snapshot_id.substring(0, 8)}...`);
    console.log(`Contains ${uiData.metrics.totalStories} stories`);
    console.log(`Built at: ${new Date(repoSnapshot.built_at || '').toLocaleString()}`);
    console.log('='.repeat(60));
    
    process.exit(allMatch ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
