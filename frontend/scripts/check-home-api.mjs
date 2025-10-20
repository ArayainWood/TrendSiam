#!/usr/bin/env node
/**
 * Health check for Home API
 * Verifies the API is working and the database view has all required columns
 */

import { fileURLToPath } from 'url'

const API_URL = process.env.API_URL || 'http://localhost:3000'

// ANSI color codes
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

async function checkHomeApi() {
  console.log('🏥 Checking Home API health...\n')
  
  try {
    const response = await fetch(`${API_URL}/api/home?debug=1`)
    const data = await response.json()
    
    // Check status code
    if (response.status === 503) {
      console.error(`${RED}❌ API returned 503 Service Unavailable${RESET}`)
      
      if (data.meta?.error === 'view_schema_error' || data.meta?.missingColumns?.length > 0) {
        console.error(`\n${YELLOW}Missing columns in database view:${RESET}`)
        console.error(`- Expected: ${data.meta.expectedColumns?.join(', ')}`)
        console.error(`- Found: ${data.meta.columnsFromView?.join(', ')}`)
        console.error(`- Missing: ${data.meta.missingColumns?.join(', ')}`)
        console.error(`\n${YELLOW}Action required:${RESET}`)
        console.error(`1. Apply the SQL migration: frontend/db/sql/fixes/2025-08-31_emergency_view_fix_v4.sql`)
        console.error(`2. Run 'npm run db:inventory' to update schema`)
      }
      
      process.exit(1)
    }
    
    if (!response.ok) {
      console.error(`${RED}❌ API returned ${response.status}${RESET}`)
      console.error(JSON.stringify(data, null, 2))
      process.exit(1)
    }
    
    // Check if this is a debug response or regular response
    const isDebugResponse = data.config && data.columnsFromView && !data.data
    
    if (isDebugResponse) {
      // Handle debug response format
      if (data.missingColumns && data.missingColumns.length > 0) {
        console.error(`${RED}❌ View is missing columns: ${data.missingColumns.join(', ')}${RESET}`)
        process.exit(1)
      }
      
      console.log(`${GREEN}✅ Home API is healthy (debug mode)${RESET}`)
      console.log(`- Status: ${response.status}`)
      console.log(`- View columns: ${data.columnsFromView?.length || 0} columns found`)
      console.log(`- Total rows in view: ${data.totalRows || 0}`)
      console.log(`- Valid rows: ${data.validRows || 0}`)
      console.log(`- Dropped rows: ${data.droppedRows || 0}`)
    } else {
      // Handle regular response format
      if (!data.data || !Array.isArray(data.data)) {
        console.error(`${RED}❌ API response missing 'data' array${RESET}`)
        console.error('Received:', JSON.stringify(data, null, 2))
        process.exit(1)
      }
      
      console.log(`${GREEN}✅ Home API is healthy${RESET}`)
      console.log(`- Status: ${response.status}`)
      console.log(`- Items returned: ${data.data?.length || 0}`)
    }
    
    
  } catch (error) {
    console.error(`${RED}❌ Failed to connect to API:${RESET}`, error.message)
    console.error(`\nMake sure the Next.js dev server is running at ${API_URL}`)
    process.exit(1)
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  checkHomeApi()
}
