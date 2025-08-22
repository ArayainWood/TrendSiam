#!/usr/bin/env node

/**
 * TrendSiam - Enhanced Import to Supabase Script - DEPRECATED
 * 
 * WARNING: This script is deprecated as of SECTION H migration.
 * The system now uses Supabase-only data flow via summarize_all_v2.py
 * 
 * This script imports news data from thailand_trending_summary.json
 * into the Supabase news_trends table with comprehensive error handling.
 * 
 * Usage: 
 *   npx tsx scripts/importToSupabase.ts                    # Import all complete items
 *   npx tsx scripts/importToSupabase.ts --test             # Test mode (2 items only)
 *   npx tsx scripts/importToSupabase.ts --limit=5          # Import first 5 items
 *   npx tsx scripts/importToSupabase.ts --include-incomplete # Include items with zero metrics
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
console.log("✅ DEBUG SUPABASE_ENABLED =", process.env.SUPABASE_ENABLED)



import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'








// Command line arguments
const args = process.argv.slice(2)
const isTestMode = args.includes('--test')
const includeIncomplete = args.includes('--include-incomplete')
const limitArg = args.find(arg => arg.startsWith('--limit='))
const itemLimit = limitArg ? parseInt(limitArg.split('=')[1]) : (isTestMode ? 2 : undefined)

// Error tracking
interface ImportError {
  index: number
  title: string
  type: string
  message: string
  details: any
}

const importErrors: ImportError[] = []

// Environment variables validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  console.error('❌ Error: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable is required')
  console.error('💡 For backend scripts, use service role key to bypass RLS')
  process.exit(1)
}

if (!supabaseKey) {
  console.error('❌ Error: SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is required')
  console.error('💡 For backend scripts, use service role key to bypass RLS')
  process.exit(1)
}

// Check key type
const isServiceRole = supabaseKey.length > 100 && supabaseKey.includes('.')
console.log(`🔑 Using ${isServiceRole ? 'Service Role' : 'Anon'} key for Supabase operations`)
if (!isServiceRole) {
  console.log('⚠️  Warning: Using anon key - inserts may fail due to RLS policies')
  console.log('💡 Consider using service role key for backend operations')
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey)

// Interface for the JSON data structure
interface NewsItemFromJSON {
  rank: string | number
  title: string
  channel: string
  view_count: string
  published_date: string
  video_id: string
  description: string
  duration: string
  like_count: string
  comment_count: string
  summary: string
  summary_en: string
  popularity_score: number
  popularity_score_precise: number
  reason: string
  view_details: {
    views: string
    growth_rate: string
    platform_mentions: string
    matched_keywords: string
    ai_opinion: string
    score: string
  }
  auto_category: string
  ai_image_local?: string
  ai_image_url?: string
  ai_image_prompt?: string
}

// Interface for Supabase upsert with all metadata fields
interface NewsItemForSupabase {
  // Core fields
  title: string
  summary: string
  summary_en: string
  category: string
  popularity_score: number
  popularity_score_precise: number
  platform: string
  date: string
  ai_image_url: string | null
  ai_image_prompt: string | null
  // summary_date field removed - using 'date' column instead
  
  // Original metadata fields
  video_id: string
  channel: string
  view_count: string
  published_date: string
  description: string
  duration: string
  like_count: string
  comment_count: string
  reason: string
  
  // View details metadata
  raw_view: string
  growth_rate: string
  platform_mentions: string
  keywords: string
  ai_opinion: string
  score_details: string
}

// Interface that matches what we actually send to Supabase (without system fields)
interface NewsItemForSupabaseInsert {
  // Core fields
  title: string
  summary: string
  summary_en: string
  category: string
  popularity_score: number
  popularity_score_precise: number
  platform: string
  date: string
  ai_image_url: string | null
  ai_image_prompt: string | null
  // summary_date field removed - using 'date' column instead
  
  // Original metadata fields
  video_id: string
  channel: string
  view_count: string
  published_date: string
  description: string
  duration: string
  like_count: string
  comment_count: string
  reason: string
  
  // View details metadata
  raw_view: string
  growth_rate: string
  platform_mentions: string
  keywords: string
  ai_opinion: string
  score_details: string
}

// Utility functions
function getThailandDate(): string {
  const now = new Date()
  const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000)) // UTC+7
  return thailandTime.toISOString().split('T')[0] // YYYY-MM-DD format
}

// Validation functions
function validateVideoId(videoId: string): boolean {
  return typeof videoId === 'string' && videoId.trim().length > 0
}

function sanitizeNumericString(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return '0'
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'string') {
    // Remove commas and non-numeric characters except decimals
    const cleaned = value.replace(/[,\s]/g, '').replace(/[^\d.]/g, '')
    return cleaned || '0'
  }
  return '0'
}

function validateAndSanitizeData(item: NewsItemFromJSON, index: number): { valid: boolean; data?: NewsItemForSupabaseInsert; errors: string[]; isIncomplete?: boolean } {
  const errors: string[] = []
  
  // Required field validation
  if (!item.title || typeof item.title !== 'string') {
    errors.push('title is required and must be a string')
  }
  
  if (!validateVideoId(item.video_id)) {
    errors.push('video_id is required and must be a non-empty string')
  }
  
  // Check data quality - identify incomplete items with zero metrics
  const viewCount = parseInt(sanitizeNumericString(item.view_count)) || 0
  const likeCount = parseInt(sanitizeNumericString(item.like_count)) || 0
  const commentCount = parseInt(sanitizeNumericString(item.comment_count)) || 0
  const isIncomplete = viewCount === 0 && likeCount === 0 && commentCount === 0
  
  if (isIncomplete) {
    console.log(`   ⚠️  Incomplete data detected: ${item.title?.substring(0, 40)}... (0 views, 0 likes, 0 comments)`)
  }
  
  // Check for duplicate video_id in current batch (basic check)
  if (errors.length === 0) {
    try {
      const sanitizedData: NewsItemForSupabaseInsert = {
        // Core fields
        title: item.title?.trim() || '',
        summary: item.summary?.trim() || '',
        summary_en: item.summary_en?.trim() || '',
        category: item.auto_category?.trim() || 'Uncategorized',
        popularity_score: Math.round(item.popularity_score || 0),
        popularity_score_precise: Number(item.popularity_score_precise || item.popularity_score || 0),
        platform: item.channel?.trim() || 'Unknown',
        date: item.published_date ? new Date(item.published_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        ai_image_url: item.ai_image_url?.trim() || null,
        ai_image_prompt: item.ai_image_prompt?.trim() || null,
        // Date is already set above from published_date
        
        // Original metadata fields
        video_id: item.video_id?.trim() || '',
        channel: item.channel?.trim() || 'Unknown',
        view_count: sanitizeNumericString(item.view_count),
        published_date: item.published_date || new Date().toISOString(),
        description: item.description?.trim() || '',
        duration: item.duration?.trim() || 'Unknown',
        like_count: sanitizeNumericString(item.like_count),
        comment_count: sanitizeNumericString(item.comment_count),
        reason: item.reason?.trim() || '',
        
        // View details metadata
        raw_view: item.view_details?.views?.trim() || '0 views',
        growth_rate: item.view_details?.growth_rate?.trim() || 'N/A',
        platform_mentions: item.view_details?.platform_mentions?.trim() || 'Primary platform only',
        keywords: item.view_details?.matched_keywords?.trim() || 'No keywords detected',
        ai_opinion: item.view_details?.ai_opinion?.trim() || 'No analysis available',
        score_details: item.view_details?.score?.trim() || 'N/A'
      }
      
      // Additional validation on sanitized data
      if (!sanitizedData.video_id) {
        errors.push('video_id cannot be empty after sanitization')
      }
      
      if (!sanitizedData.title) {
        errors.push('title cannot be empty after sanitization')
      }
      
      return { valid: errors.length === 0, data: sanitizedData, errors, isIncomplete }
    } catch (error) {
      errors.push(`Data sanitization failed: ${error instanceof Error ? error.message : String(error)}`)
      return { valid: false, errors, isIncomplete: false }
    }
  }
  
  return { valid: false, errors, isIncomplete: false }
}

async function main() {
  console.log('🚀 Starting TrendSiam Enhanced Import to Supabase...')
  console.log(`📊 Supabase URL: ${supabaseUrl}`)
  console.log(`🔑 Using Supabase key: ${supabaseKey?.substring(0, 10) ?? 'undefined'}...`)

  
  if (isTestMode) {
    console.log('🧪 TEST MODE: Will import only 2 items for debugging')
  } else if (itemLimit) {
    console.log(`📊 LIMITED MODE: Will import first ${itemLimit} items`)
  }
  
  if (includeIncomplete) {
    console.log('📊 INCLUDE INCOMPLETE: Will import items with zero metrics (useful for testing)')
  } else {
    console.log('🎯 QUALITY FILTER: Will skip items with zero views, likes, and comments')
  }
  
  try {
    // Test Supabase connection with detailed error logging
    console.log('\n🔍 Testing Supabase connection...')
    const { error: connectionError, count } = await supabase
      .from('news_trends')
      .select('count', { count: 'exact', head: true })

    if (connectionError) {
      console.error('❌ Failed to connect to Supabase:')
      console.error(JSON.stringify(connectionError, null, 2))
      console.error('💡 Make sure your credentials are correct and the news_trends table exists')
      process.exit(1)
    }
    console.log(`✅ Supabase connection successful (existing records: ${count || 0})`)

    // Read the JSON file
    const jsonFilePath = path.join(process.cwd(), 'public', 'data', 'thailand_trending_summary.json')
    
    // SECTION H: Warn about deprecated usage
    console.warn('⚠️  WARNING: This script is deprecated. Use summarize_all_v2.py for live data.')
    console.warn('⚠️  This should only be used for emergency data recovery.')
    console.warn('⚠️  Consider migrating to the Supabase-only pipeline.')
    console.log('')
    console.log(`\n📖 Reading data from: ${jsonFilePath}`)
    
    if (!fs.existsSync(jsonFilePath)) {
      console.error('❌ Error: JSON file not found at', jsonFilePath)
      console.error('💡 Make sure the file exists at public/data/thailand_trending_summary.json')
      process.exit(1)
    }

    const rawData = fs.readFileSync(jsonFilePath, 'utf8')
    let newsItems: NewsItemFromJSON[]
    
    try {
      newsItems = JSON.parse(rawData)
    } catch (parseError) {
      console.error('❌ Error parsing JSON file:')
      console.error(JSON.stringify(parseError, null, 2))
      process.exit(1)
    }
    
    // Apply limit if specified
    const originalLength = newsItems.length
    if (itemLimit && itemLimit < newsItems.length) {
      newsItems = newsItems.slice(0, itemLimit)
      console.log(`📊 Limited to first ${itemLimit} items (out of ${originalLength} total)`)
    }
    
    console.log(`✅ Successfully loaded ${newsItems.length} news items from JSON`)

    // Filter newsItems to only include items with valid video_id and engagement data
    console.log('\n🔍 Filtering news items for quality and engagement...')
    
    const filteredNewsItems = newsItems.filter((item, index) => {
      // Check for valid video_id
      if (!item.video_id || typeof item.video_id !== 'string' || item.video_id.trim().length === 0) {
        console.log(`   ⚠️  Skipping item ${index + 1}: Missing or invalid video_id`)
        return false
      }
      
      // Parse engagement metrics
      const viewCount = parseInt(sanitizeNumericString(item.view_count)) || 0
      const likeCount = parseInt(sanitizeNumericString(item.like_count)) || 0
      const commentCount = parseInt(sanitizeNumericString(item.comment_count)) || 0
      
      // Check if item has at least one engagement metric > 0 (unless includeIncomplete flag is set)
      const hasEngagement = viewCount > 0 || likeCount > 0 || commentCount > 0
      
      if (!hasEngagement && !includeIncomplete) {
        console.log(`   ⏭️  Skipping item ${index + 1}: "${item.title?.substring(0, 40)}..." (no engagement: ${viewCount} views, ${likeCount} likes, ${commentCount} comments)`)
        return false
      }
      
      return true
    })
    
    console.log(`📊 Filtered results: ${filteredNewsItems.length}/${newsItems.length} items passed quality filter`)
    
    if (filteredNewsItems.length === 0) {
      console.log('❌ No items passed the quality filter. Consider using --include-incomplete flag.')
      process.exit(1)
    }

    // Process and upsert each filtered item with duplicate prevention
    let successCount = 0
    let errorCount = 0
    let validationFailures = 0
    let duplicatesInBatch = 0
    const processedVideoIds = new Set<string>()
    
    console.log('\n📥 Starting enhanced data import with duplicate prevention...')
    console.log('=' .repeat(80))
    
    // Update the news_limit in system configuration
    try {
      const actualLimit = filteredNewsItems.length
      console.log(`🔧 Setting system news_limit to ${actualLimit} items`)
      
      const { error: configError } = await supabase.rpc('set_news_limit', { 
        new_limit: actualLimit 
      })
      
      if (configError) {
        console.warn(`⚠️ Failed to update news_limit config: ${configError.message}`)
      } else {
        console.log(`✅ Updated system configuration: news_limit = ${actualLimit}`)
      }
    } catch (error) {
      console.warn(`⚠️ Failed to update system configuration: ${error}`)
    }

    for (let i = 0; i < filteredNewsItems.length; i++) {
      const item = filteredNewsItems[i]
      
      console.log(`\n🔄 Processing [${i + 1}/${filteredNewsItems.length}]: ${item.title?.substring(0, 50)}${(item.title?.length || 0) > 50 ? '...' : ''}`)
      
      // Step 1: Validate and sanitize data
      const validation = validateAndSanitizeData(item, i)
      
      if (!validation.valid) {
        validationFailures++
        console.error(`❌ Validation failed for item ${i + 1}:`)
        validation.errors.forEach((error: string) => console.error(`   - ${error}`))
        
        importErrors.push({
          index: i + 1,
          title: item.title || 'Unknown',
          type: 'VALIDATION_ERROR',
          message: `Validation failed: ${validation.errors.join(', ')}`,
          details: { originalItem: item, errors: validation.errors }
        })
        continue
      }
      
      const supabaseItem = validation.data!
      
      // Step 2: Check for duplicates within current batch
      if (processedVideoIds.has(supabaseItem.video_id)) {
        duplicatesInBatch++
        console.log(`   🔄 Skipping duplicate video_id in batch: ${supabaseItem.video_id}`)
        continue
      }
      processedVideoIds.add(supabaseItem.video_id)
      
      // Step 3: Items are already filtered, so we can proceed directly to upsert
      
      try {
        // Step 4: Attempt enhanced upsert to Supabase
        console.log(`   🔄 Upserting video_id: ${supabaseItem.video_id}`)
        console.log(`   📊 Metrics: Views=${supabaseItem.view_count}, Likes=${supabaseItem.like_count}, Comments=${supabaseItem.comment_count}`)
        
        const { data, error } = await supabase
          .from('news_trends')
          .upsert([supabaseItem], { 
            onConflict: 'video_id', // Use video_id as the conflict resolution key
            ignoreDuplicates: false
          })
          .select('id, video_id, title, view_count, like_count')

        if (error) {
          throw error
        }

        successCount++
        const upsertedRecord = data?.[0]
        const isUpdate = upsertedRecord?.id ? 'UPDATED' : 'INSERTED'
        
        console.log(`✅ ${isUpdate} [${i + 1}/${filteredNewsItems.length}]: ${item.title.substring(0, 60)}${item.title.length > 60 ? '...' : ''}`)
        console.log(`   📊 Score: ${supabaseItem.popularity_score_precise?.toFixed(1)} | 🎨 AI Image: ${supabaseItem.ai_image_url ? '✅' : '❌'} | 📝 Prompt: ${supabaseItem.ai_image_prompt ? '✅' : '❌'}`)
        
        // Enhanced AI image debugging for top 3 items
        const itemRank = i + 1
        if (itemRank <= 3) {
          if (supabaseItem.ai_image_url) {
            console.log(`   🖼️  TOP ${itemRank} - AI Image URL: ${supabaseItem.ai_image_url}`)
          } else {
            console.log(`   ⚠️  TOP ${itemRank} - MISSING AI Image (expected for top 3)`)
          }
          if (supabaseItem.ai_image_prompt) {
            const promptPreview = supabaseItem.ai_image_prompt.substring(0, 80) + '...'
            console.log(`   📝 TOP ${itemRank} - AI Prompt: ${promptPreview}`)
          } else {
            console.log(`   ⚠️  TOP ${itemRank} - MISSING AI Prompt (expected for top 3)`)
          }
        }
        
        console.log(`   🆔 Video ID: ${supabaseItem.video_id} | 📈 Views: ${supabaseItem.view_count} | 👍 Likes: ${supabaseItem.like_count}`)
        if (upsertedRecord) {
          console.log(`   🗃️  Database ID: ${upsertedRecord.id} | Operation: ${isUpdate}`)
        }
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 150))

      } catch (error) {
        errorCount++
        console.error(`❌ UPSERT FAILED [${i + 1}/${filteredNewsItems.length}]: ${item.title.substring(0, 60)}${item.title.length > 60 ? '...' : ''}`)
        
        // Detailed error logging
        const errorDetails = {
          supabaseError: error,
          videoId: supabaseItem.video_id,
          title: supabaseItem.title,
          itemData: supabaseItem
        }
        
        console.error(`   🔍 Detailed Error Analysis:`)
        console.error(JSON.stringify(error, null, 2))
        
        // Categorize error type
        let errorType = 'UNKNOWN_ERROR'
        let errorMessage = 'Unknown error occurred'
        
        if (error && typeof error === 'object') {
          const err = error as any
          
          if (err.code === '23505') {
            errorType = 'DUPLICATE_KEY_ERROR'
            errorMessage = `Duplicate video_id: ${supabaseItem.video_id}`
          } else if (err.code === '23502') {
            errorType = 'NULL_VALUE_ERROR'
            errorMessage = `Required field is null: ${err.details || 'Unknown field'}`
          } else if (err.code === '22P02') {
            errorType = 'TYPE_MISMATCH_ERROR'
            errorMessage = `Invalid data type: ${err.details || 'Unknown field'}`
          } else if (err.message) {
            errorMessage = err.message
            if (err.message.includes('duplicate')) errorType = 'DUPLICATE_KEY_ERROR'
            else if (err.message.includes('null')) errorType = 'NULL_VALUE_ERROR'
            else if (err.message.includes('invalid input')) errorType = 'TYPE_MISMATCH_ERROR'
          }
        }
        
        console.error(`   📋 Error Type: ${errorType}`)
        console.error(`   📝 Error Message: ${errorMessage}`)
        
        importErrors.push({
          index: i + 1,
          title: item.title || 'Unknown',
          type: errorType,
          message: errorMessage,
          details: errorDetails
        })
      }
    }

    // Comprehensive Summary Report
    console.log('\n' + '=' .repeat(80))
    console.log('📊 ENHANCED IMPORT SUMMARY REPORT')
    console.log('=' .repeat(80))
    
    console.log(`📈 Overall Statistics:`)
    console.log(`   ✅ Successful upserts: ${successCount} items`)
    console.log(`   ❌ Failed upserts: ${errorCount} items`)
    console.log(`   ⚠️  Validation failures: ${validationFailures} items`)
    console.log(`   🔄 Batch duplicates skipped: ${duplicatesInBatch} items`)
    console.log(`   📊 Total processed: ${filteredNewsItems.length} items`)
    console.log(`   📊 Original dataset: ${newsItems.length} items`)
    console.log(`   🎯 Success rate: ${((successCount / filteredNewsItems.length) * 100).toFixed(1)}%`)
    console.log(`   🎯 Quality filter rate: ${((filteredNewsItems.length / newsItems.length) * 100).toFixed(1)}%`)
    
    // Calculate metadata statistics
    const itemsWithImages = filteredNewsItems.filter(item => item.ai_image_url).length
    const itemsWithPrompts = filteredNewsItems.filter(item => item.ai_image_prompt).length
    const itemsWithViewDetails = filteredNewsItems.filter(item => item.view_details).length
    
    console.log(`\n🎨 Metadata Statistics:`)
    console.log(`   🖼️  Items with AI images: ${itemsWithImages}/${filteredNewsItems.length} (${((itemsWithImages/filteredNewsItems.length)*100).toFixed(1)}%)`)
    console.log(`   📝 Items with AI prompts: ${itemsWithPrompts}/${filteredNewsItems.length} (${((itemsWithPrompts/filteredNewsItems.length)*100).toFixed(1)}%)`)
    console.log(`   📈 Items with view details: ${itemsWithViewDetails}/${filteredNewsItems.length} (${((itemsWithViewDetails/filteredNewsItems.length)*100).toFixed(1)}%)`)
    
    // Error Analysis
    if (importErrors.length > 0) {
      console.log(`\n❌ ERROR ANALYSIS:`)
      
      // Group errors by type
      const errorGroups = importErrors.reduce((groups, error) => {
        if (!groups[error.type]) groups[error.type] = []
        groups[error.type].push(error)
        return groups
      }, {} as Record<string, ImportError[]>)
      
      Object.entries(errorGroups).forEach(([errorType, errors]) => {
        console.log(`\n   📋 ${errorType}: ${errors.length} errors`)
        errors.slice(0, 3).forEach(error => {
          console.log(`      • [${error.index}] ${error.title.substring(0, 40)}... - ${error.message}`)
        })
        if (errors.length > 3) {
          console.log(`      ... and ${errors.length - 3} more`)
        }
      })
      
      console.log(`\n🔍 Detailed error log written to: importErrors_${Date.now()}.json`)
      
      // Write detailed error log
      try {
        fs.writeFileSync(
          `importErrors_${Date.now()}.json`, 
          JSON.stringify(importErrors, null, 2)
        )
      } catch (writeError) {
        console.error('Failed to write error log file:', writeError)
      }
    }
    
    // Final status
    if (errorCount === 0 && validationFailures === 0) {
      console.log('\n🎉 ALL ITEMS IMPORTED SUCCESSFULLY!')
      console.log('✨ Your Supabase database now contains the complete TrendSiam dataset with full metadata.')
    } else if (successCount > 0) {
      console.log('\n⚠️  IMPORT COMPLETED WITH ISSUES')
      console.log(`✅ ${successCount} items imported successfully`)
      console.log(`❌ ${errorCount + validationFailures} items failed`)
      console.log('🔍 Review the error analysis above for details.')
    } else {
      console.log('\n💥 IMPORT FAILED COMPLETELY')
      console.log('🔧 Please check your Supabase configuration and database schema.')
      console.log('💡 Try running in test mode first: npm run import-to-supabase -- --test')
      process.exit(1)
    }

  } catch (error) {
    console.error('\n💥 FATAL ERROR DURING IMPORT:')
    console.error('=' .repeat(50))
    
    if (error instanceof Error) {
      console.error(`Error Type: ${error.name}`)
      console.error(`Error Message: ${error.message}`)
      console.error('\n🔍 Full Error Details:')
      console.error(JSON.stringify(error, null, 2))
      console.error('\n📋 Stack Trace:')
      console.error(error.stack)
    } else {
      console.error('🔍 Unknown Error Type:')
      console.error(JSON.stringify(error, null, 2))
    }
    
    console.error('\n💡 Troubleshooting Tips:')
    console.error('1. Check your .env.local file contains valid Supabase credentials')
    console.error('2. Ensure the news_trends table exists with the correct schema')
    console.error('3. Verify your Supabase project allows the anon key to insert data')
    console.error('4. Try running in test mode: npm run import-to-supabase -- --test')
    
    process.exit(1)
  }
}

// Helper function to validate environment variables
function validateEnvironment() {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ]

  const missing = requiredVars.filter(varName => !process.env[varName])
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:')
    missing.forEach(varName => console.error(`   - ${varName}`))
    console.error('\n💡 Make sure your .env.local file is properly configured')
    process.exit(1)
  }
}

// Load environment variables from .env.local if we're not in a Next.js context
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    require('dotenv').config({ path: '.env.local' })
  } catch (error) {
    console.warn('⚠️  Could not load .env.local file. Make sure environment variables are set.')
  }
}

// Validate environment before starting
validateEnvironment()

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Unhandled error:', error)
    process.exit(1)
  })
}

export default main
