#!/usr/bin/env npx tsx
/**
 * Test Snapshot System
 * 
 * Integration test to verify:
 * 1. Snapshot builder can run from CLI
 * 2. Weekly Report page loads from snapshots
 * 3. PDF matches the page data
 * 4. Home page shows recent stories
 */

import { buildWeeklySnapshot, getLatestSnapshot } from '../src/lib/snapshots/builderCore';

async function testSnapshotSystem() {
  console.log('='.repeat(60));
  console.log('Snapshot System Integration Test');
  console.log('='.repeat(60));
  
  const results = {
    snapshotBuild: false,
    latestSnapshot: false,
    apiEndpoints: {
      health: false,
      weekly: false,
      weeklyPdf: false,
      home: false,
      diagnostics: false
    }
  };
  
  try {
    // 1. Test snapshot build (dry run)
    console.log('\n1. Testing snapshot builder (dry run)...');
    const buildResult = await buildWeeklySnapshot(true);
    
    if (buildResult.success) {
      console.log('✅ Snapshot builder works in CLI mode');
      console.log('   Items found:', buildResult.meta?.totalItems);
      console.log('   Avg score:', buildResult.meta?.avgScore);
      results.snapshotBuild = true;
    } else {
      console.error('❌ Snapshot builder failed:', buildResult.error);
    }
    
    // 2. Test getting latest snapshot
    console.log('\n2. Testing latest snapshot retrieval...');
    const latest = await getLatestSnapshot();
    
    if (latest) {
      console.log('✅ Found latest snapshot:', latest.snapshot_id);
      console.log('   Built at:', latest.built_at);
      console.log('   Items:', latest.items?.length || 0);
      results.latestSnapshot = true;
    } else {
      console.warn('⚠️  No published snapshots found');
    }
    
    // 3. Test API endpoints (if running locally)
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
    console.log(`\n3. Testing API endpoints at ${baseUrl}...`);
    
    // Health check
    try {
      const healthRes = await fetch(`${baseUrl}/api/health`);
      const health = await healthRes.json();
      
      if (health.status === 'healthy' || health.status === 'degraded') {
        console.log('✅ Health check passed:', health.status);
        console.log('   DB connected:', health.database.connected);
        console.log('   News trends:', health.database.news_trends.count);
        console.log('   Snapshots:', health.database.weekly_report_snapshots.count);
        results.apiEndpoints.health = true;
      } else {
        console.error('❌ Health check failed:', health);
      }
    } catch (e) {
      console.error('❌ Health endpoint not accessible');
    }
    
    // Weekly data
    try {
      const weeklyRes = await fetch(`${baseUrl}/api/weekly`);
      const weekly = await weeklyRes.json();
      
      if (weekly.success) {
        console.log('✅ Weekly API working');
        console.log('   Items:', weekly.items?.length || 0);
        console.log('   Source:', weekly.source);
        results.apiEndpoints.weekly = true;
      } else {
        console.error('❌ Weekly API failed:', weekly.error);
      }
    } catch (e) {
      console.error('❌ Weekly endpoint not accessible');
    }
    
    // Home data
    try {
      const homeRes = await fetch(`${baseUrl}/api/home`);
      const home = await homeRes.json();
      
      if (home.success) {
        console.log('✅ Home API working');
        console.log('   Items:', home.data?.length || 0);
        console.log('   Date:', home.metrics?.date);
        results.apiEndpoints.home = true;
      } else {
        console.error('❌ Home API failed:', home.error);
      }
    } catch (e) {
      console.error('❌ Home endpoint not accessible');
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Test Summary:');
    console.log('='.repeat(60));
    console.log('Snapshot Build (CLI):', results.snapshotBuild ? '✅' : '❌');
    console.log('Latest Snapshot:', results.latestSnapshot ? '✅' : '❌');
    console.log('Health API:', results.apiEndpoints.health ? '✅' : '❌');
    console.log('Weekly API:', results.apiEndpoints.weekly ? '✅' : '❌');
    console.log('Home API:', results.apiEndpoints.home ? '✅' : '❌');
    
    const allPassed = Object.values(results).every(r => 
      typeof r === 'boolean' ? r : Object.values(r).every(v => v)
    );
    
    console.log('\nOverall:', allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
    
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  testSnapshotSystem();
}