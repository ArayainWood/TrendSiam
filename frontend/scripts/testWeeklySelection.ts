#!/usr/bin/env npx tsx
/**
 * Test Weekly Selection Logic
 * 
 * Verifies that the weekly report can fetch snapshots correctly
 * Usage: npx tsx scripts/testWeeklySelection.ts
 */

import { 
  fetchLatestWeekly, 
  countTotalStories,
  getDiagnosticCounts,
  fetchDiagnosticData
} from '../src/lib/weekly/weeklyRepo';
import { fetchWeeklySnapshot } from '../src/lib/data/weeklySnapshot';
import { extractProjectRef } from '../src/utils/envProjectRef';

async function main() {
  console.log('='.repeat(60));
  console.log('Weekly Selection Logic Test');
  console.log('='.repeat(60));
  console.log('');
  
  try {
    // Test 1: Environment check
    console.log('Test 1: Environment Check');
    console.log('-'.repeat(30));
    
    const projectRef = extractProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('Project Ref:', projectRef || 'Could not extract');
    console.log('Has URL:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('Has Anon Key:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    console.log('');
    
    // Test 2: Diagnostic counts
    console.log('Test 2: Diagnostic Counts');
    console.log('-'.repeat(30));
    
    const counts = await getDiagnosticCounts();
    console.log('View count:', counts.viewCount);
    console.log('Table published count:', counts.tablePublishedCount);
    console.log('Table total count:', counts.tableTotalCount);
    console.log('');
    
    // Test 3: Repository fetch
    console.log('Test 3: Repository Fetch');
    console.log('-'.repeat(30));
    
    const repoSnapshot = await fetchLatestWeekly();
    if (repoSnapshot) {
      console.log('✅ Found snapshot via repository');
      console.log('Snapshot ID:', repoSnapshot.snapshot_id);
      console.log('Status:', repoSnapshot.status);
      console.log('Built at:', repoSnapshot.built_at);
      console.log('Items count:', countTotalStories(repoSnapshot));
    } else {
      console.error('❌ No snapshot found via repository');
    }
    console.log('');
    
    // Test 4: UI fetch
    console.log('Test 4: UI Data Fetch');
    console.log('-'.repeat(30));
    
    try {
      const uiData = await fetchWeeklySnapshot();
      console.log('✅ UI fetch successful');
      console.log('Snapshot ID:', uiData.snapshotId);
      console.log('Total stories:', uiData.metrics.totalStories);
      console.log('Success:', uiData.success);
    } catch (error) {
      console.error('❌ UI fetch failed:', error instanceof Error ? error.message : error);
    }
    console.log('');
    
    // Test 5: Diagnostic data
    console.log('Test 5: Diagnostic Data');
    console.log('-'.repeat(30));
    
    const diagnostics = await fetchDiagnosticData();
    console.log('Latest from view:', diagnostics.latestFromView ? {
      id: diagnostics.latestFromView.snapshot_id,
      count: diagnostics.latestFromView.item_count
    } : 'None');
    console.log('Latest from table:', diagnostics.latestPublishedFromTable ? {
      id: diagnostics.latestPublishedFromTable.snapshot_id,
      count: diagnostics.latestPublishedFromTable.item_count
    } : 'None');
    console.log('');
    
    // Summary
    console.log('='.repeat(60));
    console.log('Summary:');
    
    if (counts.tablePublishedCount > 0 && !repoSnapshot) {
      console.error('⚠️  Published snapshots exist but cannot be fetched!');
      console.error('    This suggests a permission issue or environment mismatch.');
      console.error('    Check that your .env.local points to the same Supabase project');
      console.error('    that was used to build the snapshots.');
    } else if (counts.tablePublishedCount === 0) {
      console.log('ℹ️  No published snapshots found.');
      console.log('    Run: npm run snapshot:build:publish');
    } else if (repoSnapshot) {
      console.log('✅ Selection logic working correctly!');
      console.log(`    Found snapshot: ${repoSnapshot.snapshot_id}`);
    }
    
    console.log('');
    console.log('For more details, visit: /api/weekly/diagnostics');
    console.log('='.repeat(60));
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
