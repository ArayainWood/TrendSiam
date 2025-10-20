#!/usr/bin/env node
/**
 * Check if there's data in the base tables
 */

const API_URL = process.env.API_URL || 'http://localhost:3000'

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const RESET = '\x1b[0m'

async function checkBaseTables() {
  console.log(`${CYAN}🔍 Checking base tables for data...${RESET}\n`)
  
  try {
    // Call the diagnostics endpoint
    const response = await fetch(`${API_URL}/api/home/diagnostics`)
    
    if (!response.ok) {
      console.error(`${RED}❌ Diagnostics API returned ${response.status}${RESET}`)
      return
    }
    
    const data = await response.json()
    
    console.log('📊 Table Counts:')
    console.log(`   news_trends: ${data.tableCounts?.news_trends || 0} rows`)
    console.log(`   stories: ${data.tableCounts?.stories || 0} rows`)
    console.log(`   snapshots: ${data.tableCounts?.snapshots || 0} rows`)
    console.log(`   ai_images: ${data.tableCounts?.ai_images || 0} rows`)
    console.log(`   image_files: ${data.tableCounts?.image_files || 0} rows`)
    
    console.log('\n📊 View Status:')
    console.log(`   public_v_home_news: ${data.viewStatus?.home_news || 'Unknown'} rows`)
    
    if (data.viewColumns) {
      console.log('\n📋 View Columns:')
      console.log(`   Expected: ${data.expectedColumns?.length || 0} columns`)
      console.log(`   Found: ${data.viewColumns?.length || 0} columns`)
      
      if (data.missingColumns?.length > 0) {
        console.log(`   ${RED}Missing: ${data.missingColumns.join(', ')}${RESET}`)
      }
      
      if (data.unexpectedColumns?.length > 0) {
        console.log(`   ${YELLOW}Unexpected: ${data.unexpectedColumns.join(', ')}${RESET}`)
      }
    }
    
    console.log('\n📊 Sample Data:')
    if (data.sampleData?.news_trends) {
      const sample = data.sampleData.news_trends
      console.log(`   Latest news_trend: "${sample.title || 'No title'}"`)
      console.log(`   - ID: ${sample.id}`)
      console.log(`   - Score: ${sample.popularity_score || 0}`)
      console.log(`   - Updated: ${sample.updated_at || 'Unknown'}`)
    } else {
      console.log(`   ${YELLOW}No sample data available${RESET}`)
    }
    
    // Check why view might be empty
    if (data.tableCounts?.news_trends > 0 && data.viewStatus?.home_news === 0) {
      console.log(`\n${YELLOW}⚠️  Base table has data but view is empty. Possible issues:${RESET}`)
      console.log('   - Day-scoped filtering (no data for today)')
      console.log('   - JOIN conditions not matching')
      console.log('   - WHERE clause filtering out all rows')
      console.log('   - Missing system_meta configuration')
    }
    
  } catch (error) {
    console.error(`${RED}❌ Error checking base tables:${RESET}`, error.message)
  }
}

checkBaseTables()
