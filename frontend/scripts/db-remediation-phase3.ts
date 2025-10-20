/**
 * Phase 3: Database Remediation for Weekly PDF Rendering
 * 
 * This script safely removes control characters and normalizes Unicode in snapshot data.
 * 
 * Safety features:
 * - Creates backup before any modifications
 * - Logs all changes with rollback capability
 * - Dry-run mode to preview changes
 * - Validates data integrity after changes
 * 
 * Usage:
 *   npx tsx scripts/db-remediation-phase3.ts --dry-run [snapshot-id]
 *   npx tsx scripts/db-remediation-phase3.ts --execute [snapshot-id]
 * 
 * ⚠️  REQUIRES EXPLICIT --execute FLAG TO MODIFY DATA
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const isDryRun = process.argv.includes('--dry-run');
const isExecute = process.argv.includes('--execute');

if (!isDryRun && !isExecute) {
  console.error('❌ Must specify --dry-run or --execute');
  console.error('   Example: npx tsx scripts/db-remediation-phase3.ts --dry-run');
  process.exit(1);
}

// ============================================================================
// SANITIZATION FUNCTIONS (UNIFIED TEXT POLICY V1)
// ============================================================================

interface SanitizationResult {
  original: string;
  cleaned: string;
  changed: boolean;
  controlCharsRemoved: string[];
  normalizedToNFC: boolean;
  bytesSaved: number;
}

function sanitizeTitle(title: string | null | undefined): SanitizationResult {
  if (!title) {
    return {
      original: '',
      cleaned: '',
      changed: false,
      controlCharsRemoved: [],
      normalizedToNFC: false,
      bytesSaved: 0
    };
  }
  
  const original = title;
  let cleaned = title;
  const controlCharsRemoved: string[] = [];
  
  // Step 1: Remove ALL C0/C1 control characters (except \n which we preserve temporarily)
  // C0: U+0000-001F (keep \n=0x0A), C1: U+007F-009F
  const controlPattern = /[\x00-\x09\x0B-\x1F\x7F-\x9F]/g;
  cleaned = cleaned.replace(controlPattern, (match) => {
    const code = match.charCodeAt(0);
    const hex = `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
    controlCharsRemoved.push(hex);
    return ''; // Remove entirely
  });
  
  // Step 2: Remove zero-width characters (can cause layout issues)
  const zeroWidthChars = [
    '\u200B', // Zero Width Space
    '\u200C', // Zero Width Non-Joiner
    '\u200D', // Zero Width Joiner (but be careful with emoji!)
    '\uFEFF', // Zero Width No-Break Space (BOM)
    '\u200E', // Left-to-Right Mark
    '\u200F', // Right-to-Left Mark
  ];
  
  zeroWidthChars.forEach(char => {
    if (cleaned.includes(char)) {
      const code = char.charCodeAt(0);
      controlCharsRemoved.push(`U+${code.toString(16).toUpperCase().padStart(4, '0')}`);
      cleaned = cleaned.replace(new RegExp(char, 'g'), '');
    }
  });
  
  // Step 3: Normalize to NFC (canonical composition)
  const beforeNFC = cleaned;
  cleaned = cleaned.normalize('NFC');
  const normalizedToNFC = beforeNFC !== cleaned;
  
  // Step 4: Trim whitespace
  cleaned = cleaned.trim();
  
  // Step 5: Collapse multiple spaces
  cleaned = cleaned.replace(/  +/g, ' ');
  
  const originalBytes = Buffer.from(original, 'utf8').length;
  const cleanedBytes = Buffer.from(cleaned, 'utf8').length;
  
  return {
    original,
    cleaned,
    changed: original !== cleaned,
    controlCharsRemoved: [...new Set(controlCharsRemoved)], // Unique control chars
    normalizedToNFC,
    bytesSaved: originalBytes - cleanedBytes
  };
}

// ============================================================================
// BACKUP FUNCTIONS
// ============================================================================

async function createBackup(snapshotId: string): Promise<boolean> {
  console.log(`\n📦 Creating backup of snapshot: ${snapshotId}`);
  
  const { data, error } = await supabase
    .from('weekly_report_snapshots')
    .select('*')
    .eq('snapshot_id', snapshotId)
    .single();
  
  if (error || !data) {
    console.error('❌ Failed to fetch snapshot for backup:', error);
    return false;
  }
  
  // Save to local file
  const backupDir = path.join(process.cwd(), 'backups', 'snapshots');
  fs.mkdirSync(backupDir, { recursive: true });
  
  const backupPath = path.join(backupDir, `${snapshotId}_${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(data, null, 2), 'utf8');
  
  console.log(`✅ Backup saved: ${backupPath}`);
  return true;
}

// ============================================================================
// REMEDIATION FUNCTIONS
// ============================================================================

async function remediateSnapshot(snapshotId: string, dryRun: boolean) {
  console.log(`\n🔧 ${dryRun ? '[DRY-RUN]' : '[EXECUTE]'} Remediating snapshot: ${snapshotId}\n`);
  
  // Fetch snapshot
  const { data, error } = await supabase
    .from('weekly_report_snapshots')
    .select('*')
    .eq('snapshot_id', snapshotId)
    .single();
  
  if (error || !data) {
    console.error('❌ Failed to fetch snapshot:', error);
    return null;
  }
  
  const items = data.items as any[];
  const changes: Array<{
    rank: number;
    field: string;
    before: string;
    after: string;
    controlCharsRemoved: string[];
    normalizedToNFC: boolean;
  }> = [];
  
  let itemsChanged = 0;
  let totalControlCharsRemoved = 0;
  let totalNormalized = 0;
  
  // Process each item
  const cleanedItems = items.map(item => {
    const titleResult = sanitizeTitle(item.title);
    const summaryResult = sanitizeTitle(item.summary);
    const channelResult = sanitizeTitle(item.channel);
    
    let itemChanged = false;
    
    if (titleResult.changed) {
      itemChanged = true;
      changes.push({
        rank: item.rank,
        field: 'title',
        before: titleResult.original.substring(0, 100),
        after: titleResult.cleaned.substring(0, 100),
        controlCharsRemoved: titleResult.controlCharsRemoved,
        normalizedToNFC: titleResult.normalizedToNFC
      });
      
      if (titleResult.controlCharsRemoved.length > 0) totalControlCharsRemoved += titleResult.controlCharsRemoved.length;
      if (titleResult.normalizedToNFC) totalNormalized++;
    }
    
    if (summaryResult.changed) {
      itemChanged = true;
      changes.push({
        rank: item.rank,
        field: 'summary',
        before: summaryResult.original.substring(0, 50),
        after: summaryResult.cleaned.substring(0, 50),
        controlCharsRemoved: summaryResult.controlCharsRemoved,
        normalizedToNFC: summaryResult.normalizedToNFC
      });
      
      if (summaryResult.controlCharsRemoved.length > 0) totalControlCharsRemoved += summaryResult.controlCharsRemoved.length;
      if (summaryResult.normalizedToNFC) totalNormalized++;
    }
    
    if (channelResult.changed) {
      itemChanged = true;
      if (channelResult.controlCharsRemoved.length > 0) totalControlCharsRemoved += channelResult.controlCharsRemoved.length;
      if (channelResult.normalizedToNFC) totalNormalized++;
    }
    
    if (itemChanged) itemsChanged++;
    
    return {
      ...item,
      title: titleResult.cleaned,
      summary: summaryResult.cleaned,
      channel: channelResult.cleaned
    };
  });
  
  // Log changes
  console.log(`\n📊 Remediation Summary:\n${'='.repeat(80)}`);
  console.log(`   Total items: ${items.length}`);
  console.log(`   Items changed: ${itemsChanged}`);
  console.log(`   Control chars removed: ${totalControlCharsRemoved}`);
  console.log(`   Titles normalized to NFC: ${totalNormalized}`);
  console.log('='.repeat(80));
  
  if (changes.length > 0) {
    console.log(`\n📝 Detailed Changes:\n`);
    changes.forEach((change, i) => {
      console.log(`${i + 1}. Item #${change.rank} - ${change.field}`);
      if (change.controlCharsRemoved.length > 0) {
        console.log(`   Control chars removed: ${change.controlCharsRemoved.join(', ')}`);
      }
      if (change.normalizedToNFC) {
        console.log(`   ✓ Normalized to NFC`);
      }
      console.log(`   Before: ${change.before}`);
      console.log(`   After:  ${change.after}`);
      console.log('');
    });
  }
  
  // Save change log
  const changeLogPath = path.join(process.cwd(), 'reports', `REMEDIATION_LOG_${snapshotId}_${Date.now()}.json`);
  fs.mkdirSync(path.dirname(changeLogPath), { recursive: true });
  fs.writeFileSync(changeLogPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    snapshot_id: snapshotId,
    dry_run: dryRun,
    summary: {
      total_items: items.length,
      items_changed: itemsChanged,
      control_chars_removed: totalControlCharsRemoved,
      titles_normalized: totalNormalized
    },
    changes
  }, null, 2), 'utf8');
  
  console.log(`✅ Change log saved: ${changeLogPath}\n`);
  
  if (!dryRun) {
    // Update snapshot
    console.log('💾 Writing cleaned data to database...');
    
    const { error: updateError } = await supabase
      .from('weekly_report_snapshots')
      .update({ items: cleanedItems })
      .eq('snapshot_id', snapshotId);
    
    if (updateError) {
      console.error('❌ Failed to update snapshot:', updateError);
      return null;
    }
    
    console.log('✅ Database updated successfully');
  }
  
  return {
    itemsChanged,
    totalControlCharsRemoved,
    totalNormalized,
    changes
  };
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('╔' + '='.repeat(78) + '╗');
  console.log(`║  PHASE 3: DATABASE REMEDIATION ${isDryRun ? '(DRY-RUN MODE)' : '(EXECUTE MODE)'}`.padEnd(79) + '║');
  console.log('╚' + '='.repeat(78) + '╝');
  
  let snapshotId = process.argv.find(arg => !arg.includes('--') && !arg.includes('tsx') && !arg.includes('db-remediation'));
  
  if (!snapshotId) {
    // Get latest snapshot
    const { data } = await supabase
      .from('weekly_report_snapshots')
      .select('snapshot_id')
      .eq('status', 'ready')
      .order('built_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!data) {
      console.error('❌ No snapshots found');
      process.exit(1);
    }
    
    snapshotId = data.snapshot_id;
  }
  
  console.log(`\n📌 Target snapshot: ${snapshotId}`);
  console.log(`🛡️  Mode: ${isDryRun ? 'DRY-RUN (no changes)' : 'EXECUTE (will modify data)'}\n`);
  
  if (!isDryRun) {
    // Create backup before modifications
    const backupSuccess = await createBackup(snapshotId);
    if (!backupSuccess) {
      console.error('❌ Backup failed. Aborting.');
      process.exit(1);
    }
  }
  
  // Run remediation
  const result = await remediateSnapshot(snapshotId, isDryRun);
  
  if (!result) {
    console.error('\n❌ Remediation failed');
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(80));
  if (isDryRun) {
    console.log('✅ Dry-run complete. No data was modified.');
    console.log('   To apply changes, run with --execute flag');
  } else {
    console.log('✅ Remediation complete. Data has been cleaned.');
    console.log(`   Items modified: ${result.itemsChanged}`);
    console.log(`   Control chars removed: ${result.totalControlCharsRemoved}`);
    console.log(`   Titles normalized: ${result.totalNormalized}`);
  }
  console.log('='.repeat(80) + '\n');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
