#!/usr/bin/env node

/**
 * Guard Script: Check View-Only Access Pattern
 * 
 * Ensures frontend code only accesses public_v_* views, never base tables.
 * Run this as part of CI/CD or pre-commit hooks.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Base tables that should NEVER be accessed by frontend code
const FORBIDDEN_TABLES = [
  'news_trends',
  'stories', 
  'snapshots',
  'ai_images',
  'system_meta',
  'stats',
  'image_files',
  'weekly_report_snapshots'
];

// Allowed views that frontend can access
const ALLOWED_VIEWS = [
  'public_v_home_news',
  'public_v_ai_images_latest',
  'public_v_system_meta',
  'public_v_weekly_stats',
  'public_v_weekly_snapshots'
];

// Directories to check
const FRONTEND_DIRS = [
  'src/app/api/home',
  'src/app/api/weekly', 
  'src/app/api/snapshots',
  'src/app/api/health',
  'src/app/api/db-health',
  'src/components',
  'src/lib'
];

// Files/routes that are allowed to use admin access
const ADMIN_ALLOWED_PATHS = [
  'api/test-plan-b',       // Security test endpoint
  'api/diagnostics',       // Admin diagnostics  
  'api/system-meta',       // Admin system meta
  'api/_health',           // Internal health checks
  'api/_debug',            // Debug endpoints
  'api/dev',               // Dev tools
];

let violations = [];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(process.cwd(), filePath);
  
  // Skip if it's an allowed admin path
  const isAdminPath = ADMIN_ALLOWED_PATHS.some(adminPath => 
    relPath.includes(adminPath.replace(/\//g, path.sep))
  );
  
  if (isAdminPath) {
    return;
  }
  
  // Check for forbidden table access
  FORBIDDEN_TABLES.forEach(table => {
    // Look for .from('table_name') or .from("table_name") patterns
    const patterns = [
      new RegExp(`\\.from\\s*\\(\\s*['"]${table}['"]`, 'g'),
      new RegExp(`\\.from\\s*\\(\\s*\`${table}\``, 'g'),
    ];
    
    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        violations.push({
          file: relPath,
          table: table,
          context: matches[0],
          line: getLineNumber(content, content.indexOf(matches[0]))
        });
      }
    });
  });
}

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

function main() {
  console.log('🔍 Checking for view-only access pattern compliance...\n');
  
  // Check each frontend directory
  FRONTEND_DIRS.forEach(dir => {
    const pattern = path.join(dir, '**/*.{ts,tsx,js,jsx}');
    const files = glob.sync(pattern, { nodir: true });
    
    files.forEach(file => {
      checkFile(file);
    });
  });
  
  // Report results
  if (violations.length === 0) {
    console.log('✅ All checks passed! Frontend code only accesses public views.\n');
    process.exit(0);
  } else {
    console.log(`❌ Found ${violations.length} violations:\n`);
    
    violations.forEach((v, i) => {
      console.log(`${i + 1}. ${v.file}:${v.line}`);
      console.log(`   Accessing base table: ${v.table}`);
      console.log(`   Context: ${v.context}`);
      console.log('');
    });
    
    console.log('Fix these violations by:');
    console.log('1. Using public_v_* views instead of base tables');
    console.log('2. Moving admin operations to appropriate admin endpoints');
    console.log('3. Using the service role key only in server-side admin code\n');
    
    process.exit(1);
  }
}

// Check if glob is installed
try {
  require.resolve('glob');
  main();
} catch(e) {
  console.error('Please install glob first: npm install --save-dev glob');
  process.exit(1);
}
