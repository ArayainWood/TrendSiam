#!/usr/bin/env node
/**
 * preflight-analyzer.mjs - SQL preflight safety analyzer for TrendSiam
 * 
 * Features:
 * - Introspects database schema via information_schema
 * - Parses SQL to detect operations and referenced objects
 * - Enforces schema-qualified names
 * - Suggests idempotent patterns
 * - Produces safety report before execution
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

// Risk levels
const RISK = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

// Load environment
function loadEnv() {
  const envPath = join(PROJECT_ROOT, '.env.local');
  if (!existsSync(envPath)) {
    throw new Error('.env.local not found');
  }

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
    throw new Error('SUPABASE_DB_URL not found in .env.local');
  }

  return env;
}

// Execute SQL query and return results
async function executeQuery(dbUrl, query) {
  return new Promise((resolve, reject) => {
    const psql = spawn('psql', [
      dbUrl,
      '-t', // tuples only
      '-A', // unaligned output
      '-c', query
    ], {
      shell: false,
      env: { ...process.env, PGPASSWORD: undefined }
    });
    
    let stdout = '';
    let stderr = '';
    
    psql.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    psql.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    psql.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim().split('\n').filter(line => line));
      } else {
        reject(new Error(`Query failed: ${stderr}`));
      }
    });
    
    psql.on('error', reject);
  });
}

// Introspect database schema
async function introspectSchema(dbUrl) {
  const schema = {
    tables: new Map(),
    views: new Map(),
    functions: new Map(),
    indexes: new Map()
  };
  
  // Get tables and columns
  const tableQuery = `
    SELECT 
      t.table_schema || '.' || t.table_name as full_name,
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.column_default
    FROM information_schema.tables t
    JOIN information_schema.columns c ON 
      t.table_schema = c.table_schema AND 
      t.table_name = c.table_name
    WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
      AND t.table_type = 'BASE TABLE'
    ORDER BY 1, c.ordinal_position;
  `;
  
  const tableRows = await executeQuery(dbUrl, tableQuery);
  for (const row of tableRows) {
    const [fullName, columnName, dataType, isNullable, columnDefault] = row.split('|');
    if (!schema.tables.has(fullName)) {
      schema.tables.set(fullName, { columns: new Map() });
    }
    schema.tables.get(fullName).columns.set(columnName, {
      dataType,
      isNullable: isNullable === 'YES',
      default: columnDefault
    });
  }
  
  // Get views
  const viewQuery = `
    SELECT 
      table_schema || '.' || table_name as full_name
    FROM information_schema.views
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY 1;
  `;
  
  const viewRows = await executeQuery(dbUrl, viewQuery);
  for (const row of viewRows) {
    schema.views.set(row, {});
  }
  
  // Get indexes
  const indexQuery = `
    SELECT 
      schemaname || '.' || tablename || '.' || indexname as full_name,
      indexdef
    FROM pg_indexes
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY 1;
  `;
  
  const indexRows = await executeQuery(dbUrl, indexQuery);
  for (const row of indexRows) {
    const [fullName, indexDef] = row.split('|');
    schema.indexes.set(fullName, { definition: indexDef });
  }
  
  return schema;
}

// Parse SQL operations
function parseSqlOperations(sqlContent) {
  const operations = [];
  
  // Normalize SQL (remove comments, normalize whitespace)
  const normalized = sqlContent
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Detect CREATE operations
  const createPatterns = [
    /CREATE\s+(OR\s+REPLACE\s+)?TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(\S+)/gi,
    /CREATE\s+(OR\s+REPLACE\s+)?VIEW\s+(\S+)/gi,
    /CREATE\s+(UNIQUE\s+)?INDEX\s+(IF\s+NOT\s+EXISTS\s+)?(\S+)/gi,
    /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+(\S+)/gi
  ];
  
  for (const pattern of createPatterns) {
    let match;
    while ((match = pattern.exec(normalized)) !== null) {
      const objectName = match[match.length - 1];
      const isIdempotent = match[0].includes('IF NOT EXISTS') || match[0].includes('OR REPLACE');
      operations.push({
        type: 'CREATE',
        objectType: match[0].match(/CREATE\s+(?:OR\s+REPLACE\s+)?(\w+)/i)[1],
        objectName,
        isIdempotent,
        risk: RISK.LOW
      });
    }
  }
  
  // Detect ALTER operations
  const alterPattern = /ALTER\s+TABLE\s+(\S+)\s+(ADD|DROP|ALTER|RENAME)/gi;
  let match;
  while ((match = alterPattern.exec(normalized)) !== null) {
    const [, tableName, action] = match;
    operations.push({
      type: 'ALTER',
      objectType: 'TABLE',
      objectName: tableName,
      action,
      isIdempotent: false,
      risk: action === 'DROP' ? RISK.HIGH : RISK.MEDIUM
    });
  }
  
  // Detect DROP operations
  const dropPattern = /DROP\s+(TABLE|VIEW|INDEX|FUNCTION)\s+(IF\s+EXISTS\s+)?(\S+)/gi;
  while ((match = dropPattern.exec(normalized)) !== null) {
    const [, objectType, ifExists, objectName] = match;
    operations.push({
      type: 'DROP',
      objectType,
      objectName,
      isIdempotent: !!ifExists,
      risk: RISK.CRITICAL
    });
  }
  
  // Check for unqualified names
  for (const op of operations) {
    if (op.objectName && !op.objectName.includes('.')) {
      op.unqualified = true;
      op.risk = RISK.HIGH;
    }
  }
  
  return operations;
}

// Generate safety suggestions
function generateSuggestions(operations, schema) {
  const suggestions = [];
  
  for (const op of operations) {
    // Suggest schema qualification
    if (op.unqualified) {
      suggestions.push({
        operation: op,
        issue: 'Unqualified object name',
        suggestion: `Use schema-qualified name: public.${op.objectName}`,
        risk: RISK.HIGH
      });
    }
    
    // Suggest idempotent patterns
    if (!op.isIdempotent) {
      if (op.type === 'CREATE') {
        if (op.objectType === 'TABLE') {
          suggestions.push({
            operation: op,
            issue: 'Non-idempotent CREATE TABLE',
            suggestion: `Use: CREATE TABLE IF NOT EXISTS ${op.objectName}`,
            risk: RISK.MEDIUM
          });
        } else if (op.objectType === 'VIEW') {
          suggestions.push({
            operation: op,
            issue: 'Non-idempotent CREATE VIEW',
            suggestion: `Use: CREATE OR REPLACE VIEW ${op.objectName}`,
            risk: RISK.MEDIUM
          });
        }
      } else if (op.type === 'DROP') {
        suggestions.push({
          operation: op,
          issue: 'Non-idempotent DROP',
          suggestion: `Use: DROP ${op.objectType} IF EXISTS ${op.objectName}`,
          risk: RISK.HIGH
        });
      }
    }
    
    // Check for destructive operations
    if (op.type === 'DROP' || (op.type === 'ALTER' && op.action === 'DROP')) {
      suggestions.push({
        operation: op,
        issue: 'Destructive operation',
        suggestion: 'Ensure recent backup exists. Consider creating new column instead of dropping.',
        risk: RISK.CRITICAL
      });
    }
    
    // Check if object exists
    if (op.type === 'ALTER' || op.type === 'DROP') {
      const fullName = op.objectName.includes('.') ? op.objectName : `public.${op.objectName}`;
      const exists = schema.tables.has(fullName) || schema.views.has(fullName);
      if (!exists) {
        suggestions.push({
          operation: op,
          issue: 'Object does not exist',
          suggestion: `Object ${fullName} not found in database`,
          risk: RISK.HIGH
        });
      }
    }
  }
  
  return suggestions;
}

// Generate report
function generateReport(sqlFile, operations, suggestions, schema) {
  console.log('\n' + '='.repeat(60));
  console.log('PREFLIGHT ANALYSIS REPORT');
  console.log('='.repeat(60));
  console.log(`SQL File: ${sqlFile}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');
  
  // Operations summary
  console.log('OPERATIONS DETECTED:');
  console.log('-'.repeat(60));
  
  if (operations.length === 0) {
    console.log('No DDL operations detected');
  } else {
    for (const op of operations) {
      const icon = op.risk === RISK.CRITICAL ? '🔴' : 
                   op.risk === RISK.HIGH ? '🟠' :
                   op.risk === RISK.MEDIUM ? '🟡' : '🟢';
      console.log(`${icon} ${op.type} ${op.objectType} ${op.objectName}`);
      if (op.action) {
        console.log(`   Action: ${op.action}`);
      }
      console.log(`   Risk: ${op.risk}`);
      console.log(`   Idempotent: ${op.isIdempotent ? 'Yes' : 'No'}`);
    }
  }
  
  // Safety issues
  if (suggestions.length > 0) {
    console.log('\n' + 'SAFETY ISSUES & SUGGESTIONS:');
    console.log('-'.repeat(60));
    
    for (const suggestion of suggestions) {
      const icon = suggestion.risk === RISK.CRITICAL ? '🔴' : 
                   suggestion.risk === RISK.HIGH ? '🟠' :
                   suggestion.risk === RISK.MEDIUM ? '🟡' : '🟢';
      console.log(`\n${icon} ${suggestion.issue}`);
      console.log(`   Object: ${suggestion.operation.objectName}`);
      console.log(`   Suggestion: ${suggestion.suggestion}`);
    }
  }
  
  // Risk summary
  const criticalCount = suggestions.filter(s => s.risk === RISK.CRITICAL).length;
  const highCount = suggestions.filter(s => s.risk === RISK.HIGH).length;
  const mediumCount = suggestions.filter(s => s.risk === RISK.MEDIUM).length;
  
  console.log('\n' + 'RISK SUMMARY:');
  console.log('-'.repeat(60));
  console.log(`🔴 Critical: ${criticalCount}`);
  console.log(`🟠 High: ${highCount}`);
  console.log(`🟡 Medium: ${mediumCount}`);
  
  // Recommendation
  console.log('\n' + 'RECOMMENDATION:');
  console.log('-'.repeat(60));
  
  if (criticalCount > 0) {
    console.log('❌ STOP: Critical issues found. Address before proceeding.');
    return false;
  } else if (highCount > 0) {
    console.log('⚠️  WARNING: High-risk issues found. Review carefully.');
    return false;
  } else if (mediumCount > 0) {
    console.log('⚠️  CAUTION: Medium-risk issues found. Consider suggestions.');
    return true;
  } else {
    console.log('✅ SAFE: No significant issues found. OK to proceed.');
    return true;
  }
}

// Main
export async function analyzeSql(sqlFile) {
  try {
    // Load SQL file
    const sqlPath = resolve(sqlFile);
    if (!existsSync(sqlPath)) {
      console.error(`❌ SQL file not found: ${sqlPath}`);
      return false;
    }
    
    const sqlContent = readFileSync(sqlPath, 'utf8');
    
    // Load environment and introspect schema
    const env = loadEnv();
    console.log('🔍 Introspecting database schema...');
    const schema = await introspectSchema(env.SUPABASE_DB_URL);
    console.log(`   Found ${schema.tables.size} tables, ${schema.views.size} views`);
    
    // Parse operations
    console.log('📋 Parsing SQL operations...');
    const operations = parseSqlOperations(sqlContent);
    
    // Generate suggestions
    const suggestions = generateSuggestions(operations, schema);
    
    // Generate report
    return generateReport(sqlPath, operations, suggestions, schema);
    
  } catch (error) {
    console.error('❌ Preflight analysis failed:', error.message);
    return false;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const sqlFile = process.argv[2];
  if (!sqlFile) {
    console.error('Usage: node preflight-analyzer.mjs <sql-file>');
    process.exit(1);
  }
  
  analyzeSql(sqlFile).then(safe => {
    process.exit(safe ? 0 : 1);
  });
}
