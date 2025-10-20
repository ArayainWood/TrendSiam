#!/usr/bin/env node

/**
 * Plan-B Security Build Validation
 * 
 * Validates that the system is properly configured for Plan-B security
 * and that the build will succeed without module errors
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Plan-B Security Build Validation');
console.log('===================================');

let errors = 0;
let warnings = 0;

function error(msg) {
  console.log(`❌ ${msg}`);
  errors++;
}

function warning(msg) {
  console.log(`⚠️  ${msg}`);
  warnings++;
}

function success(msg) {
  console.log(`✅ ${msg}`);
}

function info(msg) {
  console.log(`ℹ️  ${msg}`);
}

// Check if we're in the frontend directory
const frontendDir = process.cwd().includes('frontend') ? '.' : './frontend';
const srcDir = path.join(frontendDir, 'src');

if (!fs.existsSync(srcDir)) {
  error('Frontend src directory not found. Run this from the project root or frontend directory.');
  process.exit(1);
}

console.log('\n📁 FILE STRUCTURE VALIDATION');
console.log('─'.repeat(40));

// 1. Check critical files exist
const criticalFiles = [
  'src/lib/supabase/server.ts',
  'src/lib/data/news.ts',
  'src/lib/data/canonicalNewsRepo.ts',
  'tsconfig.json'
];

criticalFiles.forEach(file => {
  const filePath = path.join(frontendDir, file);
  if (fs.existsSync(filePath)) {
    success(`${file} exists`);
  } else {
    error(`Missing critical file: ${file}`);
  }
});

console.log('\n🔍 CODE ANALYSIS');
console.log('─'.repeat(40));

// 2. Check for direct base table usage in client code
const clientDirs = [
  path.join(srcDir, 'components'),
  path.join(srcDir, 'app'),
  path.join(srcDir, 'lib'),
  path.join(srcDir, 'stores'),
  path.join(srcDir, 'hooks')
];

const baseTablePatterns = [
  /\.from\(['"`]news_trends['"`]\)/g,
  /\.from\(['"`]weekly_report_snapshots['"`]\)/g,
  /\.from\(['"`]stories['"`]\)/g,
  /\.from\(['"`]snapshots['"`]\)/g,
  /\.from\(['"`]image_files['"`]\)/g
];

let foundBaseTableUsage = false;

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  files.forEach(file => {
    if (file.isDirectory()) {
      scanDirectory(path.join(dir, file.name));
    } else if (file.name.match(/\.(ts|tsx|js|jsx)$/)) {
      const filePath = path.join(dir, file.name);
      const content = fs.readFileSync(filePath, 'utf8');
      
      baseTablePatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          error(`Direct base table usage in ${filePath}: ${matches.join(', ')}`);
          foundBaseTableUsage = true;
        }
      });
    }
  });
}

clientDirs.forEach(scanDirectory);

if (!foundBaseTableUsage) {
  success('No direct base table usage found in client code');
}

// 3. Check for correct view usage
const viewPatterns = [
  /\.from\(['"`]public_v_home_news['"`]\)/g,
  /\.from\(['"`]public_v_weekly_stats['"`]\)/g,
  /\.from\(['"`]public_v_weekly_snapshots['"`]\)/g
];

let foundViewUsage = false;

function scanForViews(dir) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  files.forEach(file => {
    if (file.isDirectory()) {
      scanForViews(path.join(dir, file.name));
    } else if (file.name.match(/\.(ts|tsx|js|jsx)$/)) {
      const filePath = path.join(dir, file.name);
      const content = fs.readFileSync(filePath, 'utf8');
      
      viewPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          foundViewUsage = true;
        }
      });
    }
  });
}

scanForViews(srcDir);

if (foundViewUsage) {
  success('Found proper view usage in code');
} else {
  warning('No view usage found - this might be expected if using data layer abstraction');
}

// 4. Check imports and module resolution
console.log('\n📦 MODULE RESOLUTION');
console.log('─'.repeat(40));

const dataLayerFile = path.join(frontendDir, 'src/lib/data/news.ts');
if (fs.existsSync(dataLayerFile)) {
  const content = fs.readFileSync(dataLayerFile, 'utf8');
  
  if (content.includes("from '@/lib/supabase/server'")) {
    success('Data layer uses correct server client import');
  } else {
    error('Data layer missing correct server client import');
  }
  
  if (content.includes('HOME_VIEW') && content.includes('WEEKLY_VIEW')) {
    success('Data layer defines view constants');
  } else {
    warning('Data layer missing view constants');
  }
}

// 5. Check tsconfig paths
const tsconfigFile = path.join(frontendDir, 'tsconfig.json');
if (fs.existsSync(tsconfigFile)) {
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigFile, 'utf8'));
  
  if (tsconfig.compilerOptions?.paths?.['@/*']) {
    success('TypeScript path aliases configured');
  } else {
    error('Missing TypeScript path aliases for @/*');
  }
}

// 6. Environment variables check
console.log('\n🔧 ENVIRONMENT VALIDATION');
console.log('─'.repeat(40));

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
];

requiredEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    success(`${envVar} is set`);
  } else {
    warning(`${envVar} not found in environment (check .env.local)`);
  }
});

// 7. Try to build (if requested)
if (process.argv.includes('--build')) {
  console.log('\n🏗️  BUILD TEST');
  console.log('─'.repeat(40));
  
  try {
    info('Running npm run build...');
    execSync('npm run build', { 
      cwd: frontendDir, 
      stdio: 'pipe',
      timeout: 120000 // 2 minutes timeout
    });
    success('Build completed successfully');
  } catch (buildError) {
    error('Build failed');
    console.log('Build output:', buildError.stdout?.toString());
    console.log('Build errors:', buildError.stderr?.toString());
  }
}

// Summary
console.log('\n📊 VALIDATION SUMMARY');
console.log('─'.repeat(40));

if (errors === 0 && warnings === 0) {
  console.log('🎉 All validations passed! Plan-B Security Model is properly implemented.');
} else if (errors === 0) {
  console.log(`✅ No critical errors found. ${warnings} warnings to review.`);
} else {
  console.log(`❌ Found ${errors} errors and ${warnings} warnings that need to be fixed.`);
}

console.log('\n📋 NEXT STEPS');
console.log('─'.repeat(40));
console.log('1. Run the database setup SQL in Supabase SQL Editor');
console.log('2. Deploy the frontend code changes');
console.log('3. Test the API endpoints:');
console.log('   curl "http://localhost:3000/api/home?limit=5"');
console.log('4. Verify no permission errors in browser console');

process.exit(errors > 0 ? 1 : 0);
