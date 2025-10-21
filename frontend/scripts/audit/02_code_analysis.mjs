#!/usr/bin/env node
/**
 * Code Analysis and Structure Audit
 * Part of TrendSiam Comprehensive Audit
 * 
 * Analyzes:
 * - Frontend structure
 * - API routes
 * - Schema consistency
 * - Type safety
 */

import { readdirSync, statSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FRONTEND_ROOT = join(__dirname, '../..');
const PROJECT_ROOT = join(__dirname, '../../..');

console.log('='.repeat(80));
console.log('CODE ANALYSIS & STRUCTURE AUDIT');
console.log('='.repeat(80));
console.log('');

const results = {
  apiRoutes: [],
  components: [],
  utils: [],
  issues: [],
  recommendations: []
};

// ==============================================================================
// 1. API Routes Inventory
// ==============================================================================

console.log('1. API ROUTES INVENTORY');
console.log('-----------------------');
console.log('');

const apiDir = join(FRONTEND_ROOT, 'src/app/api');
if (existsSync(apiDir)) {
  function scanApiDir(dir, prefix = '/api') {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanApiDir(fullPath, `${prefix}/${entry}`);
      } else if (entry === 'route.ts' || entry === 'route.js') {
        const route = prefix;
        results.apiRoutes.push({
          route,
          file: fullPath.replace(FRONTEND_ROOT, '').replace(/\\/g, '/')
        });
        console.log(`   ✅ ${route}`);
      }
    }
  }
  
  scanApiDir(apiDir);
  console.log('');
  console.log(`Total API routes found: ${results.apiRoutes.length}`);
} else {
  console.log('   ❌ API directory not found');
  results.issues.push('API directory missing');
}

console.log('');

// ==============================================================================
// 2. Critical Files Check
// ==============================================================================

console.log('2. CRITICAL FILES CHECK');
console.log('-----------------------');
console.log('');

const criticalFiles = [
  { path: 'src/app/api/home/route.ts', desc: 'Home API endpoint' },
  { path: 'src/lib/mapNews.ts', desc: 'News mapper (DB ↔ API)' },
  { path: 'src/lib/db/schema-constants.ts', desc: 'Schema constants' },
  { path: 'src/app/page.tsx', desc: 'Home page component' },
  { path: '.env.local', desc: 'Environment config' }
];

for (const { path, desc } of criticalFiles) {
  const fullPath = join(FRONTEND_ROOT, path);
  const exists = existsSync(fullPath);
  console.log(`   ${exists ? '✅' : '❌'} ${path} - ${desc}`);
  if (!exists && path !== '.env.local') {
    results.issues.push(`Missing critical file: ${path}`);
  }
}

console.log('');

// ==============================================================================
// 3. Schema Constants Validation
// ==============================================================================

console.log('3. SCHEMA CONSTANTS VALIDATION');
console.log('------------------------------');
console.log('');

const schemaConstantsPath = join(FRONTEND_ROOT, 'src/lib/db/schema-constants.ts');
if (existsSync(schemaConstantsPath)) {
  const content = readFileSync(schemaConstantsPath, 'utf-8');
  
  // Check HOME_COLUMNS array
  const homeColumnsMatch = content.match(/export const HOME_COLUMNS = \[([\s\S]*?)\] as const/);
  if (homeColumnsMatch) {
    const columns = homeColumnsMatch[1]
      .split(',')
      .map(c => c.trim().replace(/['"]/g, ''))
      .filter(c => c.length > 0);
    
    console.log(`   HOME_COLUMNS count: ${columns.length}`);
    
    // Critical columns check
    const criticalColumns = [
      'id', 'title', 'summary', 'source_url',
      'published_at', 'snapshot_date',
      'popularity_score', 'rank', 'is_top3'
    ];
    
    const missingColumns = criticalColumns.filter(c => !columns.includes(c));
    if (missingColumns.length > 0) {
      console.log(`   ❌ Missing critical columns: ${missingColumns.join(', ')}`);
      results.issues.push(`Missing critical columns: ${missingColumns.join(', ')}`);
    } else {
      console.log('   ✅ All critical columns present');
    }
    
    // Check for published_at AND snapshot_date
    if (columns.includes('published_at') && columns.includes('snapshot_date')) {
      console.log('   ✅ Both published_at and snapshot_date present (correct separation)');
    } else {
      console.log('   ❌ Missing published_at or snapshot_date separation');
      results.issues.push('Missing published_at/snapshot_date separation');
    }
    
    console.log('');
    console.log('   Columns defined:');
    columns.forEach((col, idx) => {
      console.log(`      ${idx + 1}. ${col}`);
    });
  }
} else {
  console.log('   ❌ schema-constants.ts not found');
  results.issues.push('schema-constants.ts missing');
}

console.log('');

// ==============================================================================
// 4. Pipeline Files Check
// ==============================================================================

console.log('4. PIPELINE FILES CHECK');
console.log('-----------------------');
console.log('');

const pipelineFiles = [
  { path: 'summarize_all_v2.py', desc: 'Main ingestion pipeline' },
  { path: 'requirements.txt', desc: 'Python dependencies' },
  { path: 'youtube_fetcher.py', desc: 'YouTube API fetcher' }
];

for (const { path, desc } of pipelineFiles) {
  const fullPath = join(PROJECT_ROOT, path);
  const exists = existsSync(fullPath);
  console.log(`   ${exists ? '✅' : '❌'} ${path} - ${desc}`);
  if (!exists) {
    results.issues.push(`Missing pipeline file: ${path}`);
  }
}

console.log('');

// ==============================================================================
// 5. Memory Bank Documentation
// ==============================================================================

console.log('5. MEMORY BANK DOCUMENTATION');
console.log('----------------------------');
console.log('');

const memoryBankDir = join(PROJECT_ROOT, 'memory-bank');
if (existsSync(memoryBankDir)) {
  const mbFiles = readdirSync(memoryBankDir).filter(f => f.endsWith('.mb'));
  console.log(`   Found ${mbFiles.length} memory bank files:`);
  
  const keyDocs = [
    '00_project_overview.mb',
    '01_security_plan_b.mb',
    '03_frontend_homepage_freshness.mb',
    '10_popularity_score_v1.mb',
    '13_testing_acceptance_criteria.mb'
  ];
  
  for (const doc of keyDocs) {
    const exists = mbFiles.includes(doc);
    console.log(`      ${exists ? '✅' : '❌'} ${doc}`);
  }
} else {
  console.log('   ❌ memory-bank directory not found');
  results.issues.push('memory-bank directory missing');
}

console.log('');

// ==============================================================================
// 6. Summary
// ==============================================================================

console.log('='.repeat(80));
console.log('CODE ANALYSIS SUMMARY');
console.log('='.repeat(80));
console.log('');

console.log(`API Routes: ${results.apiRoutes.length}`);
console.log(`Issues Found: ${results.issues.length}`);

if (results.issues.length > 0) {
  console.log('');
  console.log('ISSUES:');
  results.issues.forEach((issue, idx) => {
    console.log(`   ${idx + 1}. ${issue}`);
  });
}

console.log('');
console.log(results.issues.length === 0 ? '✅ Code structure: PASS' : '⚠️  Code structure: PASS WITH WARNINGS');
console.log('');

process.exit(0);

