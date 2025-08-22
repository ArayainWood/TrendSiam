#!/usr/bin/env npx tsx
/**
 * Audit script to find story vs item naming inconsistencies
 * 
 * Searches for patterns where:
 * 1. Loop variable is 'item' but references use 'story.*'
 * 2. Loop variable is 'story' but references use 'item.*'
 * 3. Type mismatches between SnapshotItem and NewsItem
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

interface AuditResult {
  file: string;
  line: number;
  issue: string;
  code: string;
}

function auditFile(filePath: string): AuditResult[] {
  const results: AuditResult[] = [];
  
  if (!existsSync(filePath)) return results;
  
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Track current map context
  let currentMapVar: string | null | undefined = null;
  let mapStartLine = 0;
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Detect map functions
    const mapMatch = line.match(/\.map\s*\(\s*\((\w+)(?:,\s*\w+)?\)\s*=>/);
    if (mapMatch) {
      currentMapVar = mapMatch[1];
      mapStartLine = lineNum;
    }
    
    // Check for mismatched references
    if (currentMapVar) {
      // If loop var is 'item' but we reference 'story'
      if (currentMapVar === 'item' && line.includes('story.')) {
        results.push({
          file: filePath,
          line: lineNum,
          issue: `Loop variable is '${currentMapVar}' but references 'story.*'`,
          code: line.trim()
        });
      }
      
      // If loop var is 'story' but we reference 'item.'
      if (currentMapVar === 'story' && line.includes('item.')) {
        results.push({
          file: filePath,
          line: lineNum,
          issue: `Loop variable is '${currentMapVar}' but references 'item.*'`,
          code: line.trim()
        });
      }
    }
    
    // Reset context on closing braces (simple heuristic)
    if (line.includes('})') && currentMapVar) {
      // Check if we're likely closing the map
      const openBraces = content.substring(0, content.indexOf(line)).split('{').length;
      const closeBraces = content.substring(0, content.indexOf(line) + line.length).split('}').length;
      if (openBraces <= closeBraces) {
        currentMapVar = null;
      }
    }
  });
  
  return results;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Story vs Item Naming Audit');
  console.log('='.repeat(60));
  
  // Find all TypeScript/TSX files
  const files = await glob('src/**/*.{ts,tsx}', {
    cwd: process.cwd(),
    ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**']
  });
  
  const allResults: AuditResult[] = [];
  
  for (const file of files) {
    const results = auditFile(file);
    if (results.length > 0) {
      allResults.push(...results);
    }
  }
  
  if (allResults.length === 0) {
    console.log('\n✅ No story/item naming inconsistencies found!');
  } else {
    console.log(`\n❌ Found ${allResults.length} potential issues:\n`);
    
    // Group by file
    const byFile = allResults.reduce((acc, result) => {
      if (!acc[result.file]) acc[result.file] = [];
      acc[result.file]!.push(result);
      return acc;
    }, {} as Record<string, AuditResult[]>);
    
    Object.entries(byFile).forEach(([file, results]) => {
      console.log(`\n📄 ${file}:`);
      results.forEach(result => {
        console.log(`  Line ${result.line}: ${result.issue}`);
        console.log(`    ${result.code}`);
      });
    });
  }
  
  // Also check for type inconsistencies
  console.log('\n' + '='.repeat(60));
  console.log('Type Usage Audit');
  console.log('='.repeat(60));
  
  // Check which files use SnapshotItem vs NewsItem
  const snapshotUsers: string[] = [];
  const newsItemUsers: string[] = [];
  
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    if (content.includes('SnapshotItem')) {
      snapshotUsers.push(file);
    }
    if (content.includes('NewsItem') && !content.includes('transformToNewsItem')) {
      newsItemUsers.push(file);
    }
  }
  
  console.log(`\nFiles using SnapshotItem: ${snapshotUsers.length}`);
  snapshotUsers.slice(0, 5).forEach(file => console.log(`  - ${file}`));
  if (snapshotUsers.length > 5) console.log(`  ... and ${snapshotUsers.length - 5} more`);
  
  console.log(`\nFiles using NewsItem: ${newsItemUsers.length}`);
  newsItemUsers.slice(0, 5).forEach(file => console.log(`  - ${file}`));
  if (newsItemUsers.length > 5) console.log(`  ... and ${newsItemUsers.length - 5} more`);
  
  console.log('\n' + '='.repeat(60));
  
  process.exit(allResults.length > 0 ? 1 : 0);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
