#!/usr/bin/env npx tsx
/**
 * Build Weekly Snapshot Script
 * 
 * Can be run manually or via cron job to build a new weekly snapshot
 * Usage: npx tsx scripts/buildWeeklySnapshot.ts [--dry-run]
 */

import { buildWeeklySnapshot } from '../src/lib/snapshots/builderCore';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const shouldPublish = args.includes('--publish');
  
  console.log('='.repeat(60));
  console.log('Weekly Snapshot Builder');
  console.log('='.repeat(60));
  console.log('Start time:', new Date().toISOString());
  console.log('Mode:', dryRun ? 'DRY RUN' : 'PRODUCTION');
  console.log('Publish:', shouldPublish ? 'YES' : 'NO (draft)');
  console.log('');
  
  try {
    // Validate environment
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    }
    
    // Build snapshot with publish flag
    console.log('Building snapshot...');
    const result = await buildWeeklySnapshot(dryRun, shouldPublish);
    
    if (result.success) {
      console.log('\n✅ Snapshot build successful!');
      console.log('Snapshot ID:', result.snapshotId);
      console.log('Status:', shouldPublish ? 'published' : 'draft');
      if (result.meta) {
        console.log('\nMetadata:');
        console.log('- Total items:', result.meta.totalItems);
        console.log('- Average score:', result.meta.avgScore);
        console.log('- Score range:', result.meta.minScore, '-', result.meta.maxScore);
        console.log('- Build duration:', result.meta.buildDuration, 'ms');
        console.log('- Sources:', JSON.stringify(result.meta.sources));
      }
      
      if (!shouldPublish && !dryRun) {
        console.log('\n💡 Tip: To publish this snapshot, run:');
        console.log(`   npm run snapshot:publish -- ${result.snapshotId}`);
      }
    } else {
      console.error('\n❌ Snapshot build failed!');
      console.error('Error:', result.error);
    }
    
    process.exit(result.success ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
