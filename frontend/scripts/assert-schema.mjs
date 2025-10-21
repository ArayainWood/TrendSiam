#!/usr/bin/env node
/**
 * Assert that the database schema matches the baseline
 * Fails if schema has diverged from the last generated baseline
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const API_URL = process.env.API_URL || 'http://localhost:3000'

// ANSI color codes
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

async function fetchCurrentSchema() {
  try {
    const response = await fetch(`${API_URL}/api/dev/db-inventory`)
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API returned ${response.status}: ${error}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error(`${RED}❌ Failed to fetch current schema:${RESET}`, error.message)
    throw error
  }
}

function loadBaseline() {
  const baselinePath = path.join(__dirname, '../../docs/dev/schema_map.json')
  
  if (!fs.existsSync(baselinePath)) {
    throw new Error(`Baseline schema not found at ${baselinePath}. Run 'npm run db:inventory' first.`)
  }
  
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
}

function compareSchemas(baseline, current) {
  const differences = {
    added: {},
    removed: {},
    changed: {}
  }
  
  let hasChanges = false
  
  // Check each table
  const allTables = new Set([
    ...Object.keys(baseline.tables || {}),
    ...Object.keys(current.tables || {})
  ])
  
  for (const table of allTables) {
    const baselineColumns = baseline.tables[table] || []
    const currentColumns = current.tables[table] || []
    
    // Find added columns
    const added = currentColumns.filter(col => !baselineColumns.includes(col))
    if (added.length > 0) {
      differences.added[table] = added
      hasChanges = true
    }
    
    // Find removed columns
    const removed = baselineColumns.filter(col => !currentColumns.includes(col))
    if (removed.length > 0) {
      differences.removed[table] = removed
      hasChanges = true
    }
    
    // Check if column order changed (optional)
    const orderChanged = baselineColumns.length === currentColumns.length &&
      baselineColumns.some((col, idx) => col !== currentColumns[idx])
    
    if (orderChanged) {
      differences.changed[table] = {
        baseline: baselineColumns,
        current: currentColumns
      }
      hasChanges = true
    }
  }
  
  return { differences, hasChanges }
}

function printDifferences(differences) {
  console.log('\n📊 Schema Differences:\n')
  
  // Added columns
  if (Object.keys(differences.added).length > 0) {
    console.log(`${GREEN}+ Added columns:${RESET}`)
    for (const [table, columns] of Object.entries(differences.added)) {
      console.log(`  ${table}:`)
      columns.forEach(col => console.log(`    + ${col}`))
    }
    console.log()
  }
  
  // Removed columns
  if (Object.keys(differences.removed).length > 0) {
    console.log(`${RED}- Removed columns:${RESET}`)
    for (const [table, columns] of Object.entries(differences.removed)) {
      console.log(`  ${table}:`)
      columns.forEach(col => console.log(`    - ${col}`))
    }
    console.log()
  }
  
  // Changed order
  if (Object.keys(differences.changed).length > 0) {
    console.log(`${YELLOW}~ Column order changed:${RESET}`)
    for (const [table, data] of Object.entries(differences.changed)) {
      console.log(`  ${table}`)
    }
    console.log()
  }
}

async function main() {
  console.log('🔍 Checking database schema against baseline...\n')
  
  try {
    // Load baseline
    const baseline = loadBaseline()
    console.log(`✅ Loaded baseline from ${new Date(baseline.generatedAt).toLocaleString()}`)
    
    // Fetch current schema
    const current = await fetchCurrentSchema()
    console.log(`✅ Fetched current schema`)
    
    // Check for disallowed thumbnail fields
    const disallowedFields = ['thumbnail_url', 'youtube_thumbnail_url']
    const foundDisallowed = []
    
    for (const [table, columns] of Object.entries(current.tables || {})) {
      for (const col of columns) {
        if (disallowedFields.some(field => col.toLowerCase().includes(field.toLowerCase()))) {
          foundDisallowed.push(`${table}.${col}`)
        }
      }
    }
    
    if (foundDisallowed.length > 0) {
      console.log(`${RED}❌ POLICY VIOLATION: Found disallowed thumbnail fields:${RESET}`)
      foundDisallowed.forEach(field => console.log(`  - ${field}`))
      console.log(`\n${YELLOW}TrendSiam policy: AI-generated images for Top-3 only. No external thumbnails.${RESET}`)
      console.log(`Run the migration: ${GREEN}frontend/db/sql/fixes/2025-08-31_drop_thumbnail_columns.sql${RESET}`)
      process.exit(1)
    }
    
    // Compare schemas
    const { differences, hasChanges } = compareSchemas(baseline, current)
    
    if (hasChanges) {
      printDifferences(differences)
      
      console.log(`${RED}❌ Schema has changed since baseline was generated.${RESET}`)
      console.log(`\nThis is a hard gate - you must update the baseline before committing.`)
      console.log(`\nTo update the baseline and Memory Bank, run: ${GREEN}npm run db:inventory${RESET}`)
      console.log(`Then review the changes and re-commit.`)
      
      // Exit with error code to fail pre-commit hook
      process.exit(1)
    } else {
      console.log(`${GREEN}✅ Schema matches baseline - no changes detected${RESET}`)
    }
    
  } catch (error) {
    console.error(`\n${RED}❌ Schema assertion failed:${RESET}`, error.message)
    process.exit(1)
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
