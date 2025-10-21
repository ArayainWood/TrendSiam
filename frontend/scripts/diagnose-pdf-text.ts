#!/usr/bin/env npx tsx
/**
 * Diagnostic script for PDF text rendering issues
 * 
 * Analyzes content from snapshot for:
 * - Zero-width characters
 * - Control characters
 * - Unicode normalization issues
 * - Problematic character sequences
 */

import { fetchWeeklySnapshot } from '../src/lib/data/weeklySnapshot';

// Unicode categories that can cause rendering issues
const ZERO_WIDTH_CHARS = [
  '\u200B', // Zero Width Space
  '\u200C', // Zero Width Non-Joiner
  '\u200D', // Zero Width Joiner
  '\uFEFF', // Zero Width No-Break Space (BOM)
];

const CONTROL_CHARS = [
  '\r',     // Carriage Return
  '\n',     // Line Feed (acceptable in some contexts)
  '\t',     // Tab
  '\x00',   // Null
  '\x01',   // Start of Heading
  '\x02',   // Start of Text
];

const BIDI_CONTROLS = [
  '\u202A', // Left-to-Right Embedding
  '\u202B', // Right-to-Left Embedding
  '\u202C', // Pop Directional Formatting
  '\u202D', // Left-to-Right Override
  '\u202E', // Right-to-Left Override
];

function analyzeText(text: string): {
  hasZeroWidth: boolean;
  hasControl: boolean;
  hasBidi: boolean;
  isNormalized: boolean;
  problems: string[];
} {
  const problems: string[] = [];
  
  // Check for zero-width characters
  const hasZeroWidth = ZERO_WIDTH_CHARS.some(char => text.includes(char));
  if (hasZeroWidth) {
    problems.push('Contains zero-width characters');
  }
  
  // Check for control characters
  const hasControl = CONTROL_CHARS.some(char => text.includes(char));
  if (hasControl) {
    problems.push('Contains control characters');
  }
  
  // Check for bidi controls
  const hasBidi = BIDI_CONTROLS.some(char => text.includes(char));
  if (hasBidi) {
    problems.push('Contains bidirectional control characters');
  }
  
  // Check normalization (NFC vs NFD)
  const normalized = text.normalize('NFC');
  const isNormalized = text === normalized;
  if (!isNormalized) {
    problems.push(`Not normalized (${text.length} → ${normalized.length} chars)`);
  }
  
  return {
    hasZeroWidth,
    hasControl,
    hasBidi,
    isNormalized,
    problems
  };
}

function getCharacterDetails(text: string, index: number, context: number = 2): string {
  const start = Math.max(0, index - context);
  const end = Math.min(text.length, index + context + 1);
  
  let details = '';
  for (let i = start; i < end; i++) {
    const char = text[i];
    const code = text.charCodeAt(i);
    const hex = code.toString(16).toUpperCase().padStart(4, '0');
    const marker = i === index ? ' ← HERE' : '';
    
    if (code < 32 || code === 127) {
      details += `[U+${hex} CONTROL]${marker}\n`;
    } else if (ZERO_WIDTH_CHARS.includes(char)) {
      details += `[U+${hex} ZERO-WIDTH]${marker}\n`;
    } else if (BIDI_CONTROLS.includes(char)) {
      details += `[U+${hex} BIDI]${marker}\n`;
    } else {
      details += `'${char}' [U+${hex}]${marker}\n`;
    }
  }
  
  return details;
}

async function main() {
  console.log('='.repeat(70));
  console.log('PDF Text Rendering Diagnostic');
  console.log('='.repeat(70));
  console.log('');
  
  try {
    // Fetch latest snapshot
    console.log('Fetching weekly snapshot...');
    const snapshot = await fetchWeeklySnapshot();
    
    if (!snapshot.success) {
      console.error('❌ Failed to fetch snapshot:', snapshot.error);
      process.exit(1);
    }
    
    console.log(`✅ Loaded ${snapshot.items.length} items from snapshot`);
    console.log('');
    
    // Analyze all titles
    const problemTitles: Array<{
      rank: number;
      title: string;
      channel: string;
      analysis: ReturnType<typeof analyzeText>;
    }> = [];
    
    for (const item of snapshot.items) {
      const analysis = analyzeText(item.title || '');
      
      if (analysis.problems.length > 0) {
        problemTitles.push({
          rank: item.rank || 0,
          title: item.title || '',
          channel: item.channel || '',
          analysis
        });
      }
    }
    
    // Report findings
    console.log('Analysis Results:');
    console.log('-'.repeat(70));
    console.log('');
    
    if (problemTitles.length === 0) {
      console.log('✅ No problematic characters found in titles!');
    } else {
      console.log(`⚠️  Found ${problemTitles.length} titles with potential issues:\n`);
      
      problemTitles.slice(0, 10).forEach(({ rank, title, channel, analysis }) => {
        console.log(`#${rank}. ${title.substring(0, 80)}${title.length > 80 ? '...' : ''}`);
        console.log(`    Channel: ${channel}`);
        console.log(`    Issues: ${analysis.problems.join(', ')}`);
        
        // Show specific problem locations
        if (!analysis.isNormalized) {
          const normalized = title.normalize('NFC');
          console.log(`    Original length: ${title.length}, Normalized: ${normalized.length}`);
        }
        
        // Find and show zero-width/control chars
        for (let i = 0; i < title.length; i++) {
          const char = title[i];
          if (ZERO_WIDTH_CHARS.includes(char) || CONTROL_CHARS.includes(char) || BIDI_CONTROLS.includes(char)) {
            console.log(`    At position ${i}:`);
            console.log(getCharacterDetails(title, i).split('\n').map(line => `      ${line}`).join('\n'));
          }
        }
        
        console.log('');
      });
      
      if (problemTitles.length > 10) {
        console.log(`    ... and ${problemTitles.length - 10} more`);
        console.log('');
      }
    }
    
    // Statistics
    console.log('Statistics:');
    console.log('-'.repeat(70));
    console.log('Total items analyzed:', snapshot.items.length);
    console.log('Items with zero-width chars:', problemTitles.filter(p => p.analysis.hasZeroWidth).length);
    console.log('Items with control chars:', problemTitles.filter(p => p.analysis.hasControl).length);
    console.log('Items with bidi controls:', problemTitles.filter(p => p.analysis.hasBidi).length);
    console.log('Items not normalized:', problemTitles.filter(p => !p.analysis.isNormalized).length);
    console.log('');
    
    // Recommendations
    if (problemTitles.length > 0) {
      console.log('Recommendations:');
      console.log('-'.repeat(70));
      console.log('1. Add Unicode normalization (NFC) to processTitleForPDF()');
      console.log('2. Strip zero-width and control characters');
      console.log('3. Consider sanitizing at render time (not in database)');
      console.log('');
    }
    
    console.log('='.repeat(70));
    console.log('Diagnostic complete');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

