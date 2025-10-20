#!/usr/bin/env node
/**
 * Simplified schema assertion that works without information_schema access
 * Validates the Home API response structure
 */

const API_URL = process.env.API_URL || 'http://localhost:3000'

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

// Expected columns from constants
const HOME_COLUMNS = [
  'id', 'title', 'summary', 'summary_en', 'category', 'platform',
  'channel', 'published_at', 'source_url', 'image_url', 'ai_prompt',
  'popularity_score', 'rank', 'is_top3', 'views', 'likes', 'comments',
  'growth_rate_value', 'growth_rate_label', 'ai_opinion', 'score_details'
]

async function assertSchema() {
  console.log('🔍 Checking database schema via API...\n')
  
  try {
    // Check Home API debug endpoint
    const response = await fetch(`${API_URL}/api/home?debug=1`)
    const data = await response.json()
    
    if (!response.ok) {
      console.error(`${RED}❌ API returned ${response.status}${RESET}`)
      process.exit(1)
    }
    
    // Check if view exists (debug response should have columnsFromView)
    if (!data.columnsFromView) {
      console.error(`${RED}❌ Unable to verify view columns${RESET}`)
      process.exit(1)
    }
    
    // Check for missing columns
    const foundColumns = data.columnsFromView
    const missingColumns = HOME_COLUMNS.filter(col => !foundColumns.includes(col))
    const unexpectedColumns = foundColumns.filter(col => !HOME_COLUMNS.includes(col))
    
    // Check for disallowed thumbnail fields
    const thumbnailFields = ['thumbnail_url', 'youtube_thumbnail_url']
    const foundThumbnails = foundColumns.filter(col => thumbnailFields.includes(col))
    
    if (foundThumbnails.length > 0) {
      console.error(`${RED}❌ DISALLOWED thumbnail fields found: ${foundThumbnails.join(', ')}${RESET}`)
      console.error('   Thumbnail fields are prohibited by policy')
      process.exit(1)
    }
    
    if (missingColumns.length > 0) {
      console.error(`${RED}❌ Missing required columns: ${missingColumns.join(', ')}${RESET}`)
      process.exit(1)
    }
    
    if (unexpectedColumns.length > 0) {
      console.warn(`${YELLOW}⚠️  Unexpected columns found: ${unexpectedColumns.join(', ')}${RESET}`)
    }
    
    console.log(`${GREEN}✅ Schema validation passed!${RESET}`)
    console.log(`   Found all ${HOME_COLUMNS.length} required columns`)
    console.log(`   No prohibited thumbnail fields`)
    
    // Additional checks from the debug data
    if (data.totalRows === 0) {
      console.log(`${YELLOW}ℹ️  Note: View has no data (0 rows)${RESET}`)
    }
    
  } catch (error) {
    console.error(`${RED}❌ Schema assertion failed:${RESET}`, error.message)
    process.exit(1)
  }
}

assertSchema()
