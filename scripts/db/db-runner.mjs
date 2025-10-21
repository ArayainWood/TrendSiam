#!/usr/bin/env node
/**
 * db-runner.mjs - Main database execution runner that integrates all components
 * 
 * Workflow:
 * 1. Preflight analysis
 * 2. Dry run execution
 * 3. Real execution (if dry run passes)
 * 4. Post-verification
 */

import { resolve } from 'path';
import { analyzeSql } from './preflight-analyzer.mjs';
import { verify } from './post-verify.mjs';
import { spawn } from 'child_process';

// Parse arguments
const args = process.argv.slice(2);
const sqlFile = args.find(arg => !arg.startsWith('--'));
const isDryOnly = args.includes('--dry-only');
const skipPreflight = args.includes('--skip-preflight');
const skipVerify = args.includes('--skip-verify');
const env = args.find(arg => arg.startsWith('--env='))?.split('=')[1] || 'staging';

// Show help
if (args.includes('--help') || !sqlFile) {
  console.log(`
TrendSiam Database Runner

Usage: node db-runner.mjs <sql-file> [options]

Options:
  --dry-only         Only run dry mode (skip real execution)
  --skip-preflight   Skip preflight analysis (use with caution)
  --skip-verify      Skip post-verification
  --env=<env>        Environment (staging|prod), default: staging
  --help             Show this help

Workflow:
  1. Preflight analysis (safety checks)
  2. Dry run (transaction rollback)
  3. Real execution (if dry run passes)
  4. Post-verification

Examples:
  # Full workflow on staging
  node db-runner.mjs migrations/001.sql

  # Dry run only
  node db-runner.mjs migrations/001.sql --dry-only

  # Production execution (requires confirmation)
  node db-runner.mjs migrations/001.sql --env=prod
`);
  process.exit(0);
}

// Execute command
async function execute(command, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 ${command} ${args.join(' ')}`);
    
    const proc = spawn('node', [command, ...args], {
      stdio: 'inherit',
      shell: false
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} failed with exit code ${code}`));
      }
    });
    
    proc.on('error', reject);
  });
}

// Main workflow
async function main() {
  try {
    const resolvedFile = resolve(sqlFile);
    
    console.log('🔧 TrendSiam Database Runner');
    console.log('=' + '='.repeat(59));
    console.log(`SQL File: ${resolvedFile}`);
    console.log(`Environment: ${env}`);
    console.log(`Mode: ${isDryOnly ? 'Dry Run Only' : 'Full Execution'}`);
    console.log('');
    
    // Step 1: Preflight analysis
    if (!skipPreflight) {
      console.log('📋 Step 1/4: Preflight Analysis');
      console.log('-'.repeat(60));
      
      const safe = await analyzeSql(resolvedFile);
      if (!safe) {
        console.error('\n❌ Preflight analysis failed. Fix issues before proceeding.');
        console.error('To skip preflight (NOT RECOMMENDED): --skip-preflight');
        process.exit(1);
      }
    } else {
      console.log('⚠️  Skipping preflight analysis (--skip-preflight)');
    }
    
    // Step 2: Dry run
    console.log('\n📋 Step 2/4: Dry Run Execution');
    console.log('-'.repeat(60));
    
    await execute('./scripts/db/psql-runner.mjs', [
      '--file', resolvedFile,
      '--dry',
      '--env', env
    ]);
    
    if (isDryOnly) {
      console.log('\n✅ Dry run completed successfully (--dry-only mode)');
      return;
    }
    
    // Step 3: Real execution
    console.log('\n📋 Step 3/4: Real Execution');
    console.log('-'.repeat(60));
    
    const execArgs = [
      '--file', resolvedFile,
      '--env', env
    ];
    
    // Add production confirmation if needed
    if (env === 'prod') {
      execArgs.push('--yes', 'I know what I\'m doing');
    }
    
    await execute('./scripts/db/psql-runner.mjs', execArgs);
    
    // Step 4: Post-verification
    if (!skipVerify) {
      console.log('\n📋 Step 4/4: Post-Verification');
      console.log('-'.repeat(60));
      
      const verified = await verify(resolvedFile);
      if (!verified) {
        console.error('\n⚠️  Post-verification found issues');
        process.exit(1);
      }
    } else {
      console.log('\n⚠️  Skipping post-verification (--skip-verify)');
    }
    
    // Success
    console.log('\n' + '='.repeat(60));
    console.log('✅ DATABASE EXECUTION COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Execution failed:', error.message);
    process.exit(1);
  }
}

// Run
main();
