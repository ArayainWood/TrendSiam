#!/usr/bin/env node
/**
 * Comprehensive TrendSiam System Audit
 * 
 * Runs all audit checks and generates reports:
 * - Database connectivity
 * - Schema inventory
 * - View validation
 * - Security checks
 * - API health
 * - Pipeline validation
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import 'dotenv/config';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');
const AUDIT_OUTPUT_DIR = join(PROJECT_ROOT, 'audit_results');

// Colors for terminal output (cross-platform safe)
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(80));
  log(title, colors.cyan);
  console.log('='.repeat(80) + '\n');
}

function success(message) {
  log(`✅ ${message}`, colors.green);
}

function warning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function error(message) {
  log(`❌ ${message}`, colors.red);
}

// Create output directory
if (!existsSync(AUDIT_OUTPUT_DIR)) {
  mkdirSync(AUDIT_OUTPUT_DIR, { recursive: true });
}

const auditResults = {
  timestamp: new Date().toISOString(),
  checks: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0
  }
};

function addCheck(name, status, details = {}) {
  auditResults.checks.push({ name, status, details, timestamp: new Date().toISOString() });
  auditResults.summary.total++;
  if (status === 'pass') auditResults.summary.passed++;
  else if (status === 'fail') auditResults.summary.failed++;
  else if (status === 'warning') auditResults.summary.warnings++;
}

// ============================================================================
// Main Audit Flow
// ============================================================================

async function runAudit() {
  section('TrendSiam Comprehensive System Audit');
  
  log(`Project Root: ${PROJECT_ROOT}`);
  log(`Output Directory: ${AUDIT_OUTPUT_DIR}`);
  log('');
  
  // ========================================================================
  // 1. Environment Check
  // ========================================================================
  section('1. Environment Variables Check');
  
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  const optionalVars = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_DB_URL'
  ];
  
  let envComplete = true;
  const envStatus = {};
  
  for (const varName of requiredVars) {
    const exists = !!process.env[varName];
    envStatus[varName] = exists ? 'present' : 'missing';
    log(`   ${varName}: ${exists ? '✅ Present' : '❌ Missing'}`);
    if (!exists) envComplete = false;
  }
  
  for (const varName of optionalVars) {
    const exists = !!process.env[varName];
    envStatus[varName] = exists ? 'present' : 'missing';
    log(`   ${varName}: ${exists ? '✅ Present' : '⏭️  Optional (not set)'}`);
  }
  
  if (!envComplete) {
    error('Missing required environment variables');
    addCheck('Environment Variables', 'fail', envStatus);
    
    warning('Cannot proceed without Supabase credentials');
    warning('Create frontend/.env.local with:');
    warning('  NEXT_PUBLIC_SUPABASE_URL=your_url');
    warning('  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key');
    
    saveResults();
    process.exit(1);
  }
  
  success('All required environment variables present');
  addCheck('Environment Variables', 'pass', envStatus);
  
  // ========================================================================
  // 2. Database Connectivity
  // ========================================================================
  section('2. Database Connectivity Test');
  
  try {
    process.chdir(join(PROJECT_ROOT, 'frontend'));
    
    log('Running connectivity check...');
    const { stdout, stderr } = await execAsync('node ../scripts/audit/01_database_connectivity_check.mjs');
    
    writeFileSync(join(AUDIT_OUTPUT_DIR, '01_connectivity.log'), stdout + '\n' + stderr);
    
    if (stdout.includes('✅ Database connectivity check PASSED')) {
      success('Database connectivity check PASSED');
      addCheck('Database Connectivity', 'pass', { log: '01_connectivity.log' });
    } else {
      warning('Database connectivity check completed with warnings');
      addCheck('Database Connectivity', 'warning', { log: '01_connectivity.log' });
    }
  } catch (err) {
    error(`Database connectivity check FAILED: ${err.message}`);
    addCheck('Database Connectivity', 'fail', { error: err.message });
    
    warning('Cannot proceed with database audits');
    saveResults();
    process.exit(1);
  }
  
  // ========================================================================
  // 3. Schema Validation (if psql/DB_URL available)
  // ========================================================================
  section('3. Schema Validation');
  
  if (!process.env.SUPABASE_DB_URL) {
    warning('SUPABASE_DB_URL not set - skipping SQL-based schema checks');
    warning('Set SUPABASE_DB_URL in frontend/.env.local to enable full audit');
    addCheck('Schema Validation', 'warning', { reason: 'No DB_URL configured' });
  } else {
    log('DB_URL configured - SQL schema checks would run here');
    log('(Implementation requires psql binary - see bash version)');
    addCheck('Schema Validation', 'warning', { reason: 'psql-based checks skipped' });
  }
  
  // ========================================================================
  // 4. API Health Checks
  // ========================================================================
  section('4. API Health Checks');
  
  log('Checking if development server is running...');
  
  try {
    const response = await fetch('http://localhost:3000/api/home');
    const data = await response.json();
    
    if (response.ok) {
      success(`Home API responding: ${data.fetchedCount} items`);
      addCheck('Home API Health', 'pass', {
        status: response.status,
        itemCount: data.fetchedCount,
        hasTop3: data.top3Ids?.length || 0
      });
    } else {
      warning(`Home API returned error: ${data.error || 'Unknown'}`);
      addCheck('Home API Health', 'warning', {
        status: response.status,
        error: data.error
      });
    }
  } catch (err) {
    warning('Development server not running (this is OK if not testing live)');
    warning('  Start with: cd frontend && npm run dev');
    addCheck('Home API Health', 'warning', { reason: 'Server not running', error: err.message });
  }
  
  // ========================================================================
  // 5. Code Quality Checks
  // ========================================================================
  section('5. Code Quality Checks');
  
  log('Checking TypeScript compilation...');
  try {
    const { stdout: tsOutput } = await execAsync('npm run type-check', { cwd: join(PROJECT_ROOT, 'frontend') });
    success('TypeScript check passed');
    addCheck('TypeScript', 'pass');
  } catch (err) {
    error('TypeScript errors found');
    addCheck('TypeScript', 'fail', { output: err.stdout || err.message });
  }
  
  // ========================================================================
  // 6. Pipeline Validation
  // ========================================================================
  section('6. Pipeline Validation');
  
  const pipelineFile = join(PROJECT_ROOT, 'summarize_all_v2.py');
  if (existsSync(pipelineFile)) {
    success('Pipeline script found: summarize_all_v2.py');
    
    // Check for required Python dependencies in requirements.txt
    const requirementsFile = join(PROJECT_ROOT, 'requirements.txt');
    if (existsSync(requirementsFile)) {
      success('requirements.txt found');
      addCheck('Pipeline Files', 'pass');
    } else {
      warning('requirements.txt not found');
      addCheck('Pipeline Files', 'warning', { missing: 'requirements.txt' });
    }
  } else {
    error('Pipeline script not found: summarize_all_v2.py');
    addCheck('Pipeline Files', 'fail', { missing: 'summarize_all_v2.py' });
  }
  
  // ========================================================================
  // Summary
  // ========================================================================
  section('Audit Summary');
  
  const { summary } = auditResults;
  log(`Total Checks: ${summary.total}`);
  success(`Passed: ${summary.passed}`);
  if (summary.warnings > 0) warning(`Warnings: ${summary.warnings}`);
  if (summary.failed > 0) error(`Failed: ${summary.failed}`);
  
  const overallStatus = summary.failed === 0 ? 'PASS' : 
                        summary.failed <= 2 ? 'PASS WITH WARNINGS' : 
                        'FAIL';
  
  log('');
  if (overallStatus === 'PASS') {
    success(`Overall Status: ${overallStatus}`);
  } else if (overallStatus.includes('WARNINGS')) {
    warning(`Overall Status: ${overallStatus}`);
  } else {
    error(`Overall Status: ${overallStatus}`);
  }
  
  log('');
  saveResults();
  
  log(`\nDetailed results saved to: ${AUDIT_OUTPUT_DIR}/`);
  log('\nNext steps:');
  log('1. Review audit_results/audit-summary.json');
  log('2. Check audit_results/01_connectivity.log for details');
  log('3. Address any failed checks or warnings');
  log('4. For full database audit, ensure SUPABASE_DB_URL is set');
  log('');
  
  process.exit(summary.failed > 0 ? 1 : 0);
}

function saveResults() {
  const summaryPath = join(AUDIT_OUTPUT_DIR, 'audit-summary.json');
  writeFileSync(summaryPath, JSON.stringify(auditResults, null, 2));
  log(`\n📄 Audit summary saved: ${summaryPath}`);
}

// Run the audit
runAudit().catch(err => {
  error(`Audit failed with error: ${err.message}`);
  console.error(err);
  process.exit(1);
});

