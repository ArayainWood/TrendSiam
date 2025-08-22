#!/usr/bin/env npx tsx
/**
 * Publish Weekly Snapshot Script
 * 
 * Promotes a draft snapshot to published status
 * Usage: npx tsx scripts/publishWeeklySnapshot.ts <snapshot-id>
 */

import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../src/server/getEnv';

// Initialize Supabase client
function getSupabaseClient() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getEnv();
  
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  });
}

async function main() {
  const args = process.argv.slice(2);
  const snapshotId = args[0];
  
  if (!snapshotId) {
    console.error('❌ Error: Snapshot ID is required');
    console.log('Usage: npx tsx scripts/publishWeeklySnapshot.ts <snapshot-id>');
    process.exit(1);
  }
  
  console.log('='.repeat(60));
  console.log('Weekly Snapshot Publisher');
  console.log('='.repeat(60));
  console.log('Snapshot ID:', snapshotId);
  console.log('');
  
  try {
    // Validate environment
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    }
    
    const supabase = getSupabaseClient();
    
    // 1. Check if snapshot exists and get its current status
    console.log('Checking snapshot status...');
    const { data: snapshot, error: fetchError } = await supabase
      .from('weekly_report_snapshots')
      .select('snapshot_id, status, items, meta, built_at, range_start, range_end')
      .eq('snapshot_id', snapshotId)
      .single();
    
    if (fetchError || !snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }
    
    console.log('Current status:', snapshot.status);
    
    if (snapshot.status === 'published') {
      console.log('✅ Snapshot is already published!');
      process.exit(0);
    }
    
    if (snapshot.status === 'building') {
      throw new Error('Cannot publish a snapshot that is still building');
    }
    
    if (snapshot.status === 'failed') {
      throw new Error('Cannot publish a failed snapshot');
    }
    
    // 2. Get item count for validation
    const itemCount = (snapshot.items as any[])?.length || 0;
    console.log('Total items:', itemCount);
    
    if (itemCount === 0) {
      throw new Error('Cannot publish an empty snapshot');
    }
    
    // 3. Check for any existing published snapshot in the same range (optional safety check)
    const { data: existing } = await supabase
      .from('weekly_report_snapshots')
      .select('snapshot_id, built_at')
      .eq('status', 'published')
      .gte('range_start', snapshot.range_start)
      .lte('range_end', snapshot.range_end)
      .neq('snapshot_id', snapshotId)
      .order('built_at', { ascending: false })
      .limit(1)
      .single();
    
    if (existing) {
      console.warn('⚠️  Warning: Another published snapshot exists for this date range');
      console.warn('   Existing:', existing.snapshot_id, 'built at', existing.built_at);
      console.warn('   Continuing anyway...');
    }
    
    // 4. Publish the snapshot
    console.log('Publishing snapshot...');
    const { error: publishError } = await supabase
      .from('weekly_report_snapshots')
      .update({
        status: 'published',
        built_at: snapshot.built_at || new Date().toISOString()
      })
      .eq('snapshot_id', snapshotId)
      .eq('status', 'draft'); // Only publish if still draft
    
    if (publishError) {
      throw new Error(`Failed to publish snapshot: ${publishError.message}`);
    }
    
    console.log('\n✅ Snapshot published successfully!');
    console.log('Range:', snapshot.range_start, 'to', snapshot.range_end);
    
    // 5. Show metadata if available
    if (snapshot.meta) {
      const meta = snapshot.meta as any;
      console.log('\nMetadata:');
      console.log('- Average score:', meta.avgScore);
      console.log('- Score range:', meta.minScore, '-', meta.maxScore);
      console.log('- Sources:', JSON.stringify(meta.sources));
    }
    
    console.log('\n💡 The weekly report page should now show this snapshot');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
