#!/usr/bin/env node
/**
 * psql-runner.mjs - Safe database execution runner for TrendSiam
 * 
 * Features:
 * - Loads SUPABASE_DB_URL from .env.local (never tracked)
 * - Dry-run mode with BEGIN/ROLLBACK
 * - Real execution with single transaction
 * - Credential masking in logs
 * - Environment gating (staging default, prod requires confirmation)
 * - Lock and statement timeouts
 * - Masked logging to scripts/db/logs/
 */

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

// Parse command line arguments
const args = process.argv.slice(2);
const flags = {
  file: null,
  dry: args.includes('--dry'),
  env: 'staging',
  lockTimeout: 5000, // 5 seconds default
  statementTimeout: 30000, // 30 seconds default
  yes: null,
  help: args.includes('--help') || args.includes('-h')
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file' && args[i + 1]) {
    flags.file = args[i + 1];
    i++;
  } else if (args[i] === '--env' && args[i + 1]) {
    flags.env = args[i + 1];
    i++;
  } else if (args[i] === '--lock-timeout' && args[i + 1]) {
    flags.lockTimeout = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === '--statement-timeout' && args[i + 1]) {
    flags.statementTimeout = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === '--yes' && args[i + 1]) {
    flags.yes = args[i + 1];
    i++;
  }
}

// Show help
if (flags.help) {
  console.log(`
TrendSiam Database Runner

Usage: node psql-runner.mjs --file <path.sql> [options]

Options:
  --file <path>           SQL file to execute (required)
  --dry                   Dry-run mode (wraps in BEGIN/ROLLBACK)
  --env <staging|prod>    Environment (default: staging)
  --lock-timeout <ms>     Lock timeout in milliseconds (default: 5000)
  --statement-timeout <ms> Statement timeout in milliseconds (default: 30000)
  --yes <confirmation>    Confirmation string for prod execution
  --help, -h              Show this help

Examples:
  # Dry run on staging
  node psql-runner.mjs --file migrations/001.sql --dry

  # Execute on staging
  node psql-runner.mjs --file migrations/001.sql

  # Execute on prod (requires confirmation)
  node psql-runner.mjs --file migrations/001.sql --env prod --yes "I know what I'm doing"
`);
  process.exit(0);
}

// Validate required arguments
if (!flags.file) {
  console.error('❌ Error: --file parameter is required');
  console.error('Use --help for usage information');
  process.exit(1);
}

// Load environment variables
function loadEnv() {
  const envPath = join(PROJECT_ROOT, '.env.local');
  
  // Check if OS environment variable exists (which we should ignore)
  if (process.env.SUPABASE_DB_URL) {
    console.warn('⚠️  Warning: SUPABASE_DB_URL found in OS environment, but will be ignored.');
    console.warn('   Using .env.local as the single source of truth.');
  }
  
  if (!existsSync(envPath)) {
    console.error('❌ Error: .env.local not found in project root');
    console.error(`   Expected at: ${envPath}`);
    console.error('');
    console.error('Create .env.local with:');
    console.error('SUPABASE_DB_URL=postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require');
    process.exit(1);
  }

  console.log(`📄 Loading from: ${envPath}`);
  const envContent = readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });

  if (!env.SUPABASE_DB_URL) {
    console.error('❌ Error: SUPABASE_DB_URL not found in .env.local');
    console.error('   File exists but missing required variable.');
    process.exit(1);
  }

  if (!env.SUPABASE_DB_URL.includes('sslmode=require')) {
    console.error('❌ Error: SUPABASE_DB_URL must include ?sslmode=require');
    process.exit(1);
  }

  return env;
}

// Mask credentials in text
function maskCredentials(text, dbUrl) {
  let masked = text;
  
  // Extract and mask password from DB URL
  const pwdMatch = dbUrl.match(/postgresql:\/\/[^:]+:([^@]+)@/);
  if (pwdMatch && pwdMatch[1]) {
    const password = pwdMatch[1];
    masked = masked.replace(new RegExp(password, 'g'), '***MASKED***');
  }
  
  // Mask the full connection string
  masked = masked.replace(dbUrl, 'postgresql://***MASKED***');
  
  return masked;
}

// Generate log filename
function getLogFilename() {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[:-]/g, '')
    .replace('T', '_')
    .replace(/\.\d{3}Z$/, '');
  return `${timestamp}.log`;
}

// Write log entry
function writeLog(logPath, content) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${content}\n`;
  writeFileSync(logPath, entry, { flag: 'a' });
}

// Calculate file checksum
function getFileChecksum(filePath) {
  const content = readFileSync(filePath, 'utf8');
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

// Validate SQL file
function validateSqlFile(filePath) {
  if (!existsSync(filePath)) {
    console.error(`❌ Error: SQL file not found: ${filePath}`);
    process.exit(1);
  }

  const content = readFileSync(filePath, 'utf8');
  
  // Check for unqualified object names (basic check)
  const unqualifiedPatterns = [
    /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?!public\.)(?!IF\b)\w+/i,
    /\bCREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?!public\.)(?!OR\b)\w+/i,
    /\bALTER\s+TABLE\s+(?!public\.)\w+/i,
    /\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?!public\.)(?!IF\b)\w+/i,
    /\bDROP\s+VIEW\s+(?:IF\s+EXISTS\s+)?(?!public\.)(?!IF\b)\w+/i,
  ];

  for (const pattern of unqualifiedPatterns) {
    if (pattern.test(content)) {
      console.error('❌ Error: Unqualified object names detected');
      console.error('All objects must be schema-qualified (e.g., public.table_name)');
      process.exit(1);
    }
  }

  return content;
}

// Parse database URL components
function parseDbUrl(dbUrl) {
  const match = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(\?(.+))?/);
  if (!match) {
    throw new Error('Invalid database URL format');
  }
  
  const [, user, password, host, port, database, , params] = match;
  const sslmode = params?.match(/sslmode=([^&]+)/)?.[1];
  
  return { user, password, host, port, database, sslmode };
}

// Main execution
async function main() {
  const env = loadEnv();
  const dbUrl = env.SUPABASE_DB_URL;
  
  // Parse and validate connection details
  const dbInfo = parseDbUrl(dbUrl);
  
  // Log connection info (masked)
  console.log(`🔌 Connection: host=${dbInfo.host} port=${dbInfo.port} user=${dbInfo.user.substring(0, 8)}*** db=${dbInfo.database} sslmode=${dbInfo.sslmode}`);
  
  // Safety gate: Prevent direct host usage without explicit flag
  if (dbInfo.host.match(/^db\.[^.]+\.supabase\.co$/) && !args.includes('--allow-direct')) {
    console.error('❌ Error: Direct database host detected!');
    console.error(`   Found: ${dbInfo.host}`);
    console.error('   Expected: Session Pooler host (aws-*.pooler.supabase.com)');
    console.error('');
    console.error('   Direct connections are forbidden by default.');
    console.error('   Update your .env.local to use the Session Pooler URL.');
    console.error('   To override (NOT RECOMMENDED): add --allow-direct flag');
    process.exit(1);
  }
  
  // Resolve SQL file path
  const sqlFilePath = resolve(flags.file);
  const sqlContent = validateSqlFile(sqlFilePath);
  
  // Setup logging
  const logsDir = join(__dirname, 'logs');
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
  
  const logFilename = getLogFilename();
  const logPath = join(logsDir, logFilename);
  
  // Log execution start
  writeLog(logPath, `=== Database Execution Started ===`);
  writeLog(logPath, `Mode: ${flags.dry ? 'DRY RUN' : 'REAL EXECUTION'}`);
  writeLog(logPath, `Environment: ${flags.env}`);
  writeLog(logPath, `SQL File: ${sqlFilePath}`);
  writeLog(logPath, `Checksum: ${getFileChecksum(sqlFilePath)}`);
  writeLog(logPath, `Connection: host=${dbInfo.host} port=${dbInfo.port} user=${dbInfo.user.substring(0, 8)}*** db=${dbInfo.database} sslmode=${dbInfo.sslmode}`);
  
  // Environment checks
  if (flags.env === 'prod' && !flags.dry) {
    if (flags.yes !== 'I know what I\'m doing') {
      console.error('❌ Error: Production execution requires confirmation');
      console.error('Add: --yes "I know what I\'m doing"');
      writeLog(logPath, 'ERROR: Production execution blocked - no confirmation');
      process.exit(1);
    }
    
    console.log('⚠️  WARNING: Executing on PRODUCTION environment');
    writeLog(logPath, 'WARNING: Production execution confirmed');
  }
  
  // Prepare SQL with transaction wrapper
  let executionSql = '';
  
  if (flags.dry) {
    executionSql = `
-- DRY RUN MODE
BEGIN;
SET LOCAL lock_timeout = '${flags.lockTimeout}ms';
SET LOCAL statement_timeout = '${flags.statementTimeout}ms';

${sqlContent}

-- DRY RUN: Rolling back
ROLLBACK;
`;
  } else {
    executionSql = `
-- REAL EXECUTION MODE
\\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '${flags.lockTimeout}ms';
SET LOCAL statement_timeout = '${flags.statementTimeout}ms';

${sqlContent}

COMMIT;
`;
  }
  
  // Execute via psql
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 ${flags.dry ? 'Dry-running' : 'Executing'} SQL...`);
    
    const psql = spawn('psql', [dbUrl], {
      shell: false,
      env: { ...process.env, PGPASSWORD: undefined }
    });
    
    let stdout = '';
    let stderr = '';
    
    psql.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      console.log(maskCredentials(chunk, dbUrl));
    });
    
    psql.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      console.error(maskCredentials(chunk, dbUrl));
    });
    
    psql.on('close', (code) => {
      // Log results
      writeLog(logPath, `Exit code: ${code}`);
      if (stdout) {
        writeLog(logPath, `STDOUT:\n${maskCredentials(stdout, dbUrl)}`);
      }
      if (stderr) {
        writeLog(logPath, `STDERR:\n${maskCredentials(stderr, dbUrl)}`);
      }
      
      if (code === 0) {
        console.log(`\n✅ ${flags.dry ? 'Dry run' : 'Execution'} completed successfully`);
        console.log(`📄 Log saved to: scripts/db/logs/${logFilename}`);
        writeLog(logPath, 'SUCCESS: Execution completed');
        resolve();
      } else {
        console.error(`\n❌ Execution failed with exit code: ${code}`);
        console.error(`📄 See log: scripts/db/logs/${logFilename}`);
        writeLog(logPath, `ERROR: Execution failed with code ${code}`);
        reject(new Error(`psql exited with code ${code}`));
      }
    });
    
    psql.on('error', (err) => {
      console.error('❌ Failed to start psql:', err.message);
      writeLog(logPath, `ERROR: Failed to start psql: ${err.message}`);
      reject(err);
    });
    
    // Send SQL to psql
    psql.stdin.write(executionSql);
    psql.stdin.end();
  });
}

// Run
main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
