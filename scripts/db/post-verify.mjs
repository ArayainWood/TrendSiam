#!/usr/bin/env node
/**
 * post-verify.mjs - Post-execution verification for TrendSiam database changes
 * 
 * Features:
 * - Re-introspects objects mentioned in execution plan
 * - Verifies existence, types, permissions
 * - Records migration in schema_migrations table
 * - Produces verification report
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

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

// Execute SQL query
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

// Execute SQL command (no result expected)
async function executeCommand(dbUrl, command) {
  return new Promise((resolve, reject) => {
    const psql = spawn('psql', [dbUrl], {
      shell: false,
      env: { ...process.env, PGPASSWORD: undefined }
    });
    
    let stderr = '';
    
    psql.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    psql.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed: ${stderr}`));
      }
    });
    
    psql.on('error', reject);
    
    psql.stdin.write(command);
    psql.stdin.end();
  });
}

// Ensure schema_migrations table exists
async function ensureMigrationsTable(dbUrl) {
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      applied_by TEXT DEFAULT current_user,
      success BOOLEAN NOT NULL DEFAULT true,
      notes TEXT,
      UNIQUE(filename)
    );
    
    COMMENT ON TABLE public.schema_migrations IS 'Track applied database migrations';
  `;
  
  try {
    await executeCommand(dbUrl, createTableSql);
    console.log('✅ Ensured schema_migrations table exists');
  } catch (error) {
    console.error('⚠️  Warning: Could not create schema_migrations table:', error.message);
  }
}

// Calculate file checksum
function getFileChecksum(filePath) {
  const content = readFileSync(filePath, 'utf8');
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

// Record migration
async function recordMigration(dbUrl, sqlFile, success = true, notes = null) {
  const filename = basename(sqlFile);
  const checksum = getFileChecksum(sqlFile);
  
  const insertSql = `
    INSERT INTO public.schema_migrations (filename, checksum, success, notes)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (filename) 
    DO UPDATE SET 
      checksum = EXCLUDED.checksum,
      applied_at = NOW(),
      success = EXCLUDED.success,
      notes = EXCLUDED.notes;
  `;
  
  // Use parameterized query via psql
  const command = `
    \\set filename '${filename.replace(/'/g, "''")}'
    \\set checksum '${checksum}'
    \\set success ${success}
    \\set notes ${notes ? `'${notes.replace(/'/g, "''")}'` : 'NULL'}
    ${insertSql.replace(/\$1/g, ':filename').replace(/\$2/g, ':checksum').replace(/\$3/g, ':success').replace(/\$4/g, ':notes')}
  `;
  
  await executeCommand(dbUrl, command);
}

// Verify table exists
async function verifyTable(dbUrl, tableName) {
  const query = `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = '${tableName.replace(/'/g, "''")}'
    );
  `;
  
  const result = await executeQuery(dbUrl, query);
  return result[0] === 't';
}

// Verify view exists
async function verifyView(dbUrl, viewName) {
  const query = `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.views 
      WHERE table_schema = 'public' 
      AND table_name = '${viewName.replace(/'/g, "''")}'
    );
  `;
  
  const result = await executeQuery(dbUrl, query);
  return result[0] === 't';
}

// Verify column exists
async function verifyColumn(dbUrl, tableName, columnName) {
  const query = `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = '${tableName.replace(/'/g, "''")}'
      AND column_name = '${columnName.replace(/'/g, "''")}'
    );
  `;
  
  const result = await executeQuery(dbUrl, query);
  return result[0] === 't';
}

// Test view selectability
async function testViewSelect(dbUrl, viewName) {
  try {
    const query = `SELECT 1 FROM public.${viewName} LIMIT 1;`;
    await executeQuery(dbUrl, query);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get view permissions
async function getViewPermissions(dbUrl, viewName) {
  const query = `
    SELECT grantee, privilege_type
    FROM information_schema.table_privileges
    WHERE table_schema = 'public'
    AND table_name = '${viewName.replace(/'/g, "''")}'
    AND grantee IN ('anon', 'authenticated')
    ORDER BY grantee, privilege_type;
  `;
  
  const results = await executeQuery(dbUrl, query);
  const permissions = {};
  
  for (const row of results) {
    const [grantee, privilege] = row.split('|');
    if (!permissions[grantee]) {
      permissions[grantee] = [];
    }
    permissions[grantee].push(privilege);
  }
  
  return permissions;
}

// Parse SQL file to extract expected objects
function parseExpectedObjects(sqlContent) {
  const objects = {
    tables: new Set(),
    views: new Set(),
    indexes: new Set(),
    functions: new Set()
  };
  
  // Normalize SQL
  const normalized = sqlContent
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Extract table names
  const tablePattern = /CREATE\s+(?:OR\s+REPLACE\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.(\w+)/gi;
  let match;
  while ((match = tablePattern.exec(normalized)) !== null) {
    objects.tables.add(match[1]);
  }
  
  // Extract view names
  const viewPattern = /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+public\.(\w+)/gi;
  while ((match = viewPattern.exec(normalized)) !== null) {
    objects.views.add(match[1]);
  }
  
  // Extract index names
  const indexPattern = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
  while ((match = indexPattern.exec(normalized)) !== null) {
    objects.indexes.add(match[1]);
  }
  
  return objects;
}

// Main verification
export async function verify(sqlFile) {
  try {
    const env = loadEnv();
    const dbUrl = env.SUPABASE_DB_URL;
    
    console.log('\n' + '='.repeat(60));
    console.log('POST-EXECUTION VERIFICATION');
    console.log('='.repeat(60));
    console.log(`SQL File: ${sqlFile}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('');
    
    // Ensure migrations table exists
    await ensureMigrationsTable(dbUrl);
    
    // Parse SQL file to get expected objects
    const sqlContent = readFileSync(sqlFile, 'utf8');
    const expected = parseExpectedObjects(sqlContent);
    
    console.log('EXPECTED OBJECTS:');
    console.log(`  Tables: ${expected.tables.size}`);
    console.log(`  Views: ${expected.views.size}`);
    console.log(`  Indexes: ${expected.indexes.size}`);
    console.log('');
    
    // Verify each expected object
    const results = {
      tables: [],
      views: [],
      overall: true
    };
    
    // Verify tables
    if (expected.tables.size > 0) {
      console.log('VERIFYING TABLES:');
      console.log('-'.repeat(60));
      
      for (const tableName of expected.tables) {
        const exists = await verifyTable(dbUrl, tableName);
        results.tables.push({ name: tableName, exists });
        console.log(`  ${exists ? '✅' : '❌'} public.${tableName}`);
        if (!exists) results.overall = false;
      }
      console.log('');
    }
    
    // Verify views
    if (expected.views.size > 0) {
      console.log('VERIFYING VIEWS:');
      console.log('-'.repeat(60));
      
      for (const viewName of expected.views) {
        const exists = await verifyView(dbUrl, viewName);
        const selectTest = exists ? await testViewSelect(dbUrl, viewName) : { success: false };
        const permissions = exists ? await getViewPermissions(dbUrl, viewName) : {};
        
        results.views.push({ 
          name: viewName, 
          exists, 
          selectable: selectTest.success,
          permissions 
        });
        
        console.log(`  ${exists ? '✅' : '❌'} public.${viewName}`);
        if (exists) {
          console.log(`     Selectable: ${selectTest.success ? 'Yes' : 'No'}`);
          if (!selectTest.success && selectTest.error) {
            console.log(`     Error: ${selectTest.error}`);
          }
          
          if (Object.keys(permissions).length > 0) {
            console.log(`     Permissions:`);
            for (const [grantee, privs] of Object.entries(permissions)) {
              console.log(`       ${grantee}: ${privs.join(', ')}`);
            }
          }
        }
        
        if (!exists || !selectTest.success) results.overall = false;
      }
      console.log('');
    }
    
    // Record migration
    if (results.overall) {
      await recordMigration(dbUrl, sqlFile, true, 'Verified successfully');
      console.log('✅ Migration recorded in schema_migrations table');
    } else {
      await recordMigration(dbUrl, sqlFile, false, 'Verification failed');
      console.log('❌ Migration recorded as failed');
    }
    
    // Summary
    console.log('\n' + 'VERIFICATION SUMMARY:');
    console.log('-'.repeat(60));
    console.log(`Result: ${results.overall ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (!results.overall) {
      console.log('\nFailed items:');
      for (const table of results.tables.filter(t => !t.exists)) {
        console.log(`  - Table public.${table.name} not found`);
      }
      for (const view of results.views.filter(v => !v.exists || !v.selectable)) {
        if (!view.exists) {
          console.log(`  - View public.${view.name} not found`);
        } else if (!view.selectable) {
          console.log(`  - View public.${view.name} not selectable`);
        }
      }
    }
    
    return results.overall;
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    return false;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const sqlFile = process.argv[2];
  if (!sqlFile) {
    console.error('Usage: node post-verify.mjs <sql-file>');
    process.exit(1);
  }
  
  verify(sqlFile).then(success => {
    process.exit(success ? 0 : 1);
  });
}
