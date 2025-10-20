/**
 * PDF Text Forensics Analysis
 * 
 * Analyzes weekly snapshot data for character-level anomalies
 * Detects: Hangul Jamo, zero-width chars, bidi controls, smart quotes, etc.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials. Please check .env.local');
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseAnonKey);

interface Anomaly {
  rank: number;
  field: string;
  index: number;
  char: string;
  hex: string;
  category: string;
  script: string;
  issues: string;
  context: string;
}

async function analyzeSnapshot() {
  console.log('🔍 Fetching latest weekly snapshot...\n');
  
  const { data: snapshot, error } = await client
    .from('public_v_weekly_snapshots')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  if (error || !snapshot) {
    console.error('❌ Failed to fetch snapshot:', error);
    return;
  }
  
  console.log('✅ Snapshot ID:', snapshot.id);
  console.log('📊 Total items:', snapshot.items?.length || 0);
  console.log('📅 Date range:', snapshot.meta?.window_start, '→', snapshot.meta?.window_end);
  console.log('\n' + '='.repeat(80));
  
  const forensics: Anomaly[] = [];
  const items = snapshot.items?.slice(0, 20) || [];
  
  items.forEach((item: any, idx: number) => {
    const rank = idx + 1;
    const fields = {
      title: item.title || '',
      channel: item.channel || '',
      category: item.category || ''
    };
    
    Object.entries(fields).forEach(([fieldName, text]) => {
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const code = text.charCodeAt(i);
        const hex = 'U+' + code.toString(16).toUpperCase().padStart(4, '0');
        
        // Determine character category and script
        const category = getUnicodeCategory(code);
        const script = getUnicodeScript(code);
        
        // Detect anomalies
        const issues: string[] = [];
        
        // Zero-width characters
        if (code === 0x200B) issues.push('ZWSP');
        if (code === 0x200C) issues.push('ZWNJ');
        if (code === 0x200D) issues.push('ZWJ');
        if (code === 0xFEFF) issues.push('BOM/ZWNBSP');
        
        // Bidirectional controls
        if (code >= 0x200E && code <= 0x200F) issues.push('BIDI_MARK');
        if (code >= 0x202A && code <= 0x202E) issues.push('BIDI_CONTROL');
        if (code >= 0x2066 && code <= 0x2069) issues.push('BIDI_ISOLATE');
        
        // Spaces and hyphens
        if (code === 0x00A0) issues.push('NBSP');
        if (code === 0x00AD) issues.push('SOFT_HYPHEN');
        if (code === 0x2002 || code === 0x2003) issues.push('EN_EM_SPACE');
        
        // Smart punctuation
        if (code >= 0x2018 && code <= 0x201F) issues.push('SMART_QUOTE');
        if (code === 0x2013) issues.push('EN_DASH');
        if (code === 0x2014) issues.push('EM_DASH');
        
        // Hangul Jamo (not full characters)
        if (code >= 0x1100 && code <= 0x11FF) issues.push('HANGUL_JAMO');
        
        // Modifiers and combining
        if (code >= 0x02B0 && code <= 0x02FF) issues.push('SPACING_MODIFIER');
        if (code === 0x02C6) issues.push('MODIFIER_CIRCUMFLEX');
        if (code === 0x005E) issues.push('ASCII_CIRCUMFLEX');
        
        // Thai-specific issues
        if (code >= 0x0E00 && code <= 0x0E7F) {
          // Check for decomposed SARA AM
          if (code === 0x0E4D && i + 1 < text.length && text.charCodeAt(i + 1) === 0x0E32) {
            issues.push('DECOMPOSED_SARA_AM');
          }
          
          // Check for orphan combining marks
          if (code >= 0x0E31 && code <= 0x0E3A && (i === 0 || text.charCodeAt(i - 1) < 0x0E00)) {
            issues.push('ORPHAN_THAI_MARK');
          }
        }
        
        if (issues.length > 0) {
          const contextStart = Math.max(0, i - 10);
          const contextEnd = Math.min(text.length, i + 11);
          const context = text.substring(contextStart, contextEnd);
          const contextMarker = ' '.repeat(i - contextStart) + '^';
          
          forensics.push({
            rank,
            field: fieldName,
            index: i,
            char,
            hex,
            category,
            script,
            issues: issues.join(' | '),
            context: `"${context}"\n${' '.repeat(context.length > 40 ? 0 : 1)}${contextMarker}`
          });
        }
      }
    });
  });
  
  console.log('\n🔬 === FORENSIC ANALYSIS RESULTS ===\n');
  console.log(`Found ${forensics.length} anomalies across ${items.length} items\n`);
  
  if (forensics.length > 0) {
    forensics.forEach((f, idx) => {
      console.log(`[${idx + 1}] Story #${f.rank} [${f.field}]`);
      console.log(`    Position: ${f.index}`);
      console.log(`    Character: '${f.char}' ${f.hex}`);
      console.log(`    Category: ${f.category} | Script: ${f.script}`);
      console.log(`    Issues: ${f.issues}`);
      console.log(`    Context: ${f.context}`);
      console.log('');
    });
  } else {
    console.log('✅ No anomalies detected in current snapshot data');
  }
  
  // Save detailed report
  const report = {
    snapshot_id: snapshot.id,
    analyzed_at: new Date().toISOString(),
    total_items: items.length,
    total_anomalies: forensics.length,
    items: items.map((item: any, idx: number) => ({
      rank: idx + 1,
      title: item.title,
      channel: item.channel,
      category: item.category,
      published_at: item.published_at
    })),
    anomalies: forensics
  };
  
  fs.writeFileSync('pdf_forensics_report.json', JSON.stringify(report, null, 2));
  console.log('💾 Detailed report saved to: pdf_forensics_report.json');
  console.log('\n' + '='.repeat(80));
}

function getUnicodeCategory(code: number): string {
  // Simplified Unicode General Category detection
  if (code >= 0x0041 && code <= 0x005A) return 'Lu'; // Uppercase Letter
  if (code >= 0x0061 && code <= 0x007A) return 'Ll'; // Lowercase Letter
  if (code >= 0x0030 && code <= 0x0039) return 'Nd'; // Decimal Number
  if (code >= 0x0300 && code <= 0x036F) return 'Mn'; // Nonspacing Mark
  if (code >= 0x200B && code <= 0x200F) return 'Cf'; // Format
  if (code >= 0x202A && code <= 0x202E) return 'Cf'; // Format
  if (code >= 0x2066 && code <= 0x2069) return 'Cf'; // Format
  if (code === 0x00A0 || code === 0xFEFF) return 'Zs'; // Space Separator
  if (code >= 0x2000 && code <= 0x200A) return 'Zs'; // Space Separator
  if (code >= 0x0E31 && code <= 0x0E3A) return 'Mn'; // Thai vowels above/below
  if (code >= 0x0E47 && code <= 0x0E4E) return 'Mn'; // Thai tone marks
  if (code >= 0x0020 && code <= 0x002F) return 'Po'; // Punctuation
  if (code >= 0x1100 && code <= 0x11FF) return 'Lo'; // Hangul Jamo
  return '??';
}

function getUnicodeScript(code: number): string {
  if (code >= 0x0000 && code <= 0x007F) return 'Basic_Latin';
  if (code >= 0x0080 && code <= 0x00FF) return 'Latin_1_Supplement';
  if (code >= 0x0E00 && code <= 0x0E7F) return 'Thai';
  if (code >= 0x1100 && code <= 0x11FF) return 'Hangul_Jamo';
  if (code >= 0xAC00 && code <= 0xD7AF) return 'Hangul_Syllables';
  if (code >= 0x4E00 && code <= 0x9FFF) return 'CJK_Unified_Ideographs';
  if (code >= 0x0600 && code <= 0x06FF) return 'Arabic';
  if (code >= 0x0590 && code <= 0x05FF) return 'Hebrew';
  if (code >= 0x200B && code <= 0x206F) return 'General_Punctuation';
  if (code >= 0x1F300 && code <= 0x1F9FF) return 'Emoji';
  return 'Unknown';
}

analyzeSnapshot().catch(console.error);

