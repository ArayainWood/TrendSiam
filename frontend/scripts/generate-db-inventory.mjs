#!/usr/bin/env node
/**
 * Generate database inventory files from the dev API
 * Creates:
 * - docs/dev/baseline_db_inventory.md (human-readable)
 * - docs/dev/schema_map.json (raw JSON)
 * - src/lib/db/schema-constants.ts (TypeScript constants)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const API_URL = process.env.API_URL || 'http://localhost:3000'

async function fetchInventory() {
  console.log('📊 Fetching database inventory from API...')
  
  try {
    const response = await fetch(`${API_URL}/api/dev/db-inventory`)
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API returned ${response.status}: ${error}`)
    }
    
    const data = await response.json()
    return data
  } catch (error) {
    console.error('❌ Failed to fetch inventory:', error.message)
    throw error
  }
}

function generateMarkdown(inventory) {
  let md = `# TrendSiam Database Schema Inventory

Generated: ${inventory.generatedAt}

## Tables and Columns

`

  // Sort tables for consistent output
  const tableNames = Object.keys(inventory.tables).sort()
  
  tableNames.forEach(table => {
    const columns = inventory.tables[table]
    md += `### ${table}\n\n`
    
    if (columns.length === 0) {
      md += `*No columns found (table may not exist)*\n\n`
    } else {
      md += `| Column | Position |\n`
      md += `|--------|----------|\n`
      
      columns.forEach((col, idx) => {
        md += `| ${col} | ${idx + 1} |\n`
      })
      md += `\n`
    }
  })
  
  // Add column details if available
  if (inventory.columnsDetail && inventory.columnsDetail.length > 0) {
    md += `## Column Details\n\n`
    md += `| Table | Column | Type | Nullable | Default |\n`
    md += `|-------|--------|------|----------|----------|\n`
    
    inventory.columnsDetail.forEach(col => {
      md += `| ${col.table_name} | ${col.column_name} | ${col.data_type} | ${col.is_nullable} | ${col.column_default || 'NULL'} |\n`
    })
  }
  
  return md
}

function generateTypeScript(inventory) {
  let ts = `/**
 * Auto-generated database schema constants
 * Generated: ${inventory.generatedAt}
 * DO NOT EDIT MANUALLY - use npm run db:inventory
 */

export const SCHEMA = {
`
  
  const tableNames = Object.keys(inventory.tables).sort()
  
  tableNames.forEach((table, idx) => {
    const columns = inventory.tables[table]
    ts += `  ${table}: [`
    
    if (columns.length > 0) {
      ts += '\n'
      columns.forEach((col, colIdx) => {
        ts += `    '${col}'${colIdx < columns.length - 1 ? ',' : ''}\n`
      })
      ts += '  ]'
    } else {
      ts += ']'
    }
    
    if (idx < tableNames.length - 1) {
      ts += ','
    }
    ts += '\n'
  })
  
  ts += `} as const

export type SchemaTable = keyof typeof SCHEMA
export type SchemaColumn<T extends SchemaTable> = typeof SCHEMA[T][number]

// Helper to check if a column exists
export function hasColumn<T extends SchemaTable>(
  table: T,
  column: string
): column is SchemaColumn<T> {
  return (SCHEMA[table] as readonly string[]).includes(column)
}

// Get all columns for a table
export function getColumns<T extends SchemaTable>(table: T): readonly string[] {
  return SCHEMA[table]
}
`
  
  return ts
}

async function main() {
  try {
    // Fetch inventory
    const inventory = await fetchInventory()
    console.log(`✅ Fetched schema for ${Object.keys(inventory.tables).length} tables`)
    
    // Create directories if they don't exist
    const docsDir = path.join(__dirname, '../../docs/dev')
    const libDir = path.join(__dirname, '../src/lib/db')
    const memoryBankDir = path.join(__dirname, '../../memory-bank')
    
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true })
    }
    
    if (!fs.existsSync(libDir)) {
      fs.mkdirSync(libDir, { recursive: true })
    }
    
    if (!fs.existsSync(memoryBankDir)) {
      fs.mkdirSync(memoryBankDir, { recursive: true })
    }
    
    // Generate and write markdown
    const markdown = generateMarkdown(inventory)
    const mdPath = path.join(docsDir, 'baseline_db_inventory.md')
    fs.writeFileSync(mdPath, markdown)
    console.log(`✅ Wrote ${mdPath}`)
    
    // Write raw JSON
    const jsonPath = path.join(docsDir, 'schema_map.json')
    fs.writeFileSync(jsonPath, JSON.stringify(inventory, null, 2))
    console.log(`✅ Wrote ${jsonPath}`)
    
    // Generate and write TypeScript
    const typescript = generateTypeScript(inventory)
    const tsPath = path.join(libDir, 'schema-constants.ts')
    fs.writeFileSync(tsPath, typescript)
    console.log(`✅ Wrote ${tsPath}`)
    
    // Generate and write Memory Bank file
    const memoryBankContent = `This file is the single source of truth for DB columns. Never reference a column not listed here. Update via \`npm run db:inventory\` after any schema change.

${markdown}`
    const memoryBankPath = path.join(memoryBankDir, 'db_schema_inventory.mb')
    fs.writeFileSync(memoryBankPath, memoryBankContent)
    console.log(`✅ Wrote ${memoryBankPath}`)
    
    console.log('\n🎉 Database inventory generated successfully!')
    
  } catch (error) {
    console.error('\n❌ Failed to generate inventory:', error)
    process.exit(1)
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
