/**
 * Phase 1: Database Forensic Audit for Weekly PDF Rendering
 * 
 * This script runs comprehensive read-only queries to diagnose data integrity issues
 * affecting PDF rendering (Thai graphemes, CJK, special characters, control chars).
 * 
 * Usage: npx tsx scripts/db-forensic-audit-phase1.ts [snapshot-id]
 * 
 * Safety: READ-ONLY operations. No data modifications.
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
  console.error('❌ Missing required environment variables:');
  console.error('   - SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function toHex(str: string): string {
  return Array.from(str).map(c => {
    const code = c.charCodeAt(0);
    return `U+${code.toString(16).toUpperCase().padStart(4, '0')}:${c}`;
  }).join(' ');
}

function detectControlChars(str: string): { has: boolean; chars: string[] } {
  const controlPattern = /[\x00-\x1F\x7F-\x9F]/g;
  const matches = str.match(controlPattern);
  return {
    has: matches !== null,
    chars: matches ? matches.map(m => `U+${m.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`) : []
  };
}

function analyzeString(str: string) {
  const nfc = str.normalize('NFC');
  const nfd = str.normalize('NFD');
  
  let normForm = 'OTHER';
  if (str === nfc) normForm = 'NFC';
  else if (str === nfd) normForm = 'NFD';
  
  const controlInfo = detectControlChars(str);
  
  return {
    length: str.length,
    bytes: Buffer.from(str, 'utf8').length,
    normalization: normForm,
    needsNFC: str !== nfc,
    hasControlChars: controlInfo.has,
    controlChars: controlInfo.chars,
    hasRuble: str.includes('₽'), // U+20BD
    hasWeierstrass: str.includes('℘'), // U+2118
    hasTilde: str.includes('~'),
    hasCurlyBrace: str.includes('{'),
    hasAtSign: str.includes('@')
  };
}

// ============================================================================
// FORENSIC QUERIES
// ============================================================================

async function getLatestSnapshots() {
  console.log('\n📊 Section 1: Latest Snapshots\n' + '='.repeat(80));
  
  const { data, error } = await supabase
    .from('weekly_report_snapshots')
    .select('snapshot_id, status, range_start, range_end, built_at, algo_version, data_version, created_at')
    .eq('status', 'ready')
    .order('built_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('❌ Error fetching snapshots:', error);
    return null;
  }
  
  if (!data || data.length === 0) {
    console.error('❌ No ready snapshots found');
    return null;
  }
  
  console.table(data);
  return data[0].snapshot_id;
}

async function analyzeProblematicItems(snapshotId: string) {
  console.log('\n📊 Section 2: Problematic Items (#4, #6, #11, #16, #18, #19, #20)\n' + '='.repeat(80));
  
  const { data, error } = await supabase
    .from('weekly_report_snapshots')
    .select('items')
    .eq('snapshot_id', snapshotId)
    .eq('status', 'ready')
    .single();
  
  if (error || !data) {
    console.error('❌ Error fetching snapshot items:', error);
    return [];
  }
  
  const items = data.items as any[];
  const problematicRanks = [4, 6, 11, 16, 18, 19, 20];
  const filtered = items.filter(item => problematicRanks.includes(item.rank));
  
  const results = filtered.map(item => ({
    rank: item.rank,
    title: item.title?.substring(0, 100) + (item.title?.length > 100 ? '...' : ''),
    title_length: item.title?.length || 0,
    video_id: item.video_id,
    channel: item.channel,
    category: item.category
  }));
  
  console.table(results);
  return filtered;
}

async function forensicHexAnalysis(snapshotId: string) {
  console.log('\n📊 Section 3: Forensic Hex Analysis (Items #16 & #20)\n' + '='.repeat(80));
  
  const { data, error } = await supabase
    .from('weekly_report_snapshots')
    .select('items')
    .eq('snapshot_id', snapshotId)
    .eq('status', 'ready')
    .single();
  
  if (error || !data) {
    console.error('❌ Error fetching snapshot:', error);
    return [];
  }
  
  const items = data.items as any[];
  const targetItems = items.filter(item => [16, 20].includes(item.rank));
  
  const analysis = targetItems.map(item => {
    const title = item.title || '';
    const info = analyzeString(title);
    
    console.log(`\n🔍 Item #${item.rank}: ${title.substring(0, 80)}...`);
    console.log(`   Length: ${info.length} chars, ${info.bytes} bytes`);
    console.log(`   Normalization: ${info.normalization} ${info.needsNFC ? '⚠️ NEEDS NFC' : '✓'}`);
    console.log(`   Control chars: ${info.hasControlChars ? '🔴 YES' : '✅ NO'}`);
    if (info.hasControlChars) {
      console.log(`   Control char codes: ${info.controlChars.join(', ')}`);
    }
    console.log(`   Special chars: ₽=${info.hasRuble}, ℘=${info.hasWeierstrass}, ~=${info.hasTilde}, {=${info.hasCurlyBrace}, @=${info.hasAtSign}`);
    console.log(`   First 50 chars (hex):\n   ${toHex(title.substring(0, 50))}`);
    
    return {
      rank: item.rank,
      ...info
    };
  });
  
  return analysis;
}

async function normalizationCheck(snapshotId: string) {
  console.log('\n📊 Section 4: Unicode Normalization Check\n' + '='.repeat(80));
  
  const { data, error } = await supabase
    .from('weekly_report_snapshots')
    .select('items')
    .eq('snapshot_id', snapshotId)
    .eq('status', 'ready')
    .single();
  
  if (error || !data) {
    console.error('❌ Error:', error);
    return [];
  }
  
  const items = data.items as any[];
  const targetRanks = [4, 6, 11, 16, 18, 19, 20];
  const filtered = items.filter(item => targetRanks.includes(item.rank));
  
  const results = filtered.map(item => {
    const title = item.title || '';
    const nfc = title.normalize('NFC');
    const nfd = title.normalize('NFD');
    
    let form = 'OTHER';
    if (title === nfc) form = 'NFC ✓';
    else if (title === nfd) form = 'NFD';
    
    return {
      rank: item.rank,
      normalization_form: form,
      needs_fix: title !== nfc ? '⚠️ YES' : '✅ NO',
      title_preview: title.substring(0, 60)
    };
  });
  
  console.table(results);
  return results;
}

async function corruptionStatistics(snapshotId: string) {
  console.log('\n📊 Section 5: Corruption Statistics (All Items)\n' + '='.repeat(80));
  
  const { data, error } = await supabase
    .from('weekly_report_snapshots')
    .select('items')
    .eq('snapshot_id', snapshotId)
    .eq('status', 'ready')
    .single();
  
  if (error || !data) {
    console.error('❌ Error:', error);
    return null;
  }
  
  const items = data.items as any[];
  
  let withControl = 0;
  let withZeroWidth = 0;
  let needsNFC = 0;
  
  items.forEach(item => {
    const title = item.title || '';
    const info = analyzeString(title);
    
    if (info.hasControlChars) withControl++;
    if (info.needsNFC) needsNFC++;
    // Zero-width check would need regex similar to control chars
  });
  
  const stats = {
    total_items: items.length,
    with_control_chars: withControl,
    needing_nfc: needsNFC,
    pct_control: ((withControl / items.length) * 100).toFixed(2) + '%',
    pct_needing_nfc: ((needsNFC / items.length) * 100).toFixed(2) + '%'
  };
  
  console.table([stats]);
  return stats;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('╔' + '='.repeat(78) + '╗');
  console.log('║  PHASE 1: DATABASE FORENSIC AUDIT FOR WEEKLY PDF RENDERING           ║');
  console.log('╚' + '='.repeat(78) + '╝');
  console.log('\n🔍 Purpose: Identify control characters, normalization issues, and data corruption');
  console.log('🛡️  Safety: READ-ONLY operations\n');
  
  const startTime = Date.now();
  
  // Allow snapshot ID override from command line
  let snapshotId = process.argv[2];
  
  if (!snapshotId) {
    snapshotId = await getLatestSnapshots();
    if (!snapshotId) {
      console.error('\n❌ Cannot proceed without a valid snapshot ID');
      process.exit(1);
    }
  }
  
  console.log(`\n✅ Using snapshot: ${snapshotId}\n`);
  
  // Run all forensic analyses
  const items = await analyzeProblematicItems(snapshotId);
  const hexAnalysis = await forensicHexAnalysis(snapshotId);
  const normalization = await normalizationCheck(snapshotId);
  const stats = await corruptionStatistics(snapshotId);
  
  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    snapshot_id: snapshotId,
    total_time_ms: Date.now() - startTime,
    items_analyzed: items.length,
    hex_analysis: hexAnalysis,
    normalization_check: normalization,
    corruption_stats: stats
  };
  
  // Save report to file
  const reportPath = path.join(process.cwd(), 'reports', `DB_FORENSIC_AUDIT_${snapshotId}_${Date.now()}.json`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  
  console.log('\n' + '='.repeat(80));
  console.log(`✅ Forensic audit complete in ${report.total_time_ms}ms`);
  console.log(`📄 Full report saved to: ${reportPath}`);
  console.log('='.repeat(80) + '\n');
  
  // Summary
  if (stats) {
    console.log('📊 SUMMARY:');
    console.log(`   Total items: ${stats.total_items}`);
    console.log(`   Items with control chars: ${stats.with_control_chars} (${stats.pct_control})`);
    console.log(`   Items needing NFC: ${stats.needing_nfc} (${stats.pct_needing_nfc})`);
    
    if (stats.with_control_chars > 0 || stats.needing_nfc > 0) {
      console.log('\n⚠️  ACTION REQUIRED: Database remediation needed (Phase 3)');
    } else {
      console.log('\n✅ Database appears clean. Focus on application-level fixes.');
    }
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
