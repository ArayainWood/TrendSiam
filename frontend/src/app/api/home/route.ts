/*
 * PHASE 2 COMPLETE: Unified Top-3 logic and image policy in API layer
 * PHASE 3 COMPLETE: Numeric type safety with Zod validation
 * PHASE 4 COMPLETE: Snapshot-based freshness implementation
 * - Single source of truth for Top-3 detection (isTop3, rank <= 3)
 * - Server-side image policy: images only for Top-3, never for others
 * - Unified showImage, showAiPrompt flags computed server-side
 * - Cards and modal consume identical data shape
 * - Strict numeric validation prevents text > integer errors
 * - View now uses snapshot-based freshness (72h primary, 30d fallback)
 */
// TrendSiam Home API - Snapshot-based Implementation
import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { PostgrestError } from '@supabase/supabase-js'
import { z } from 'zod'
import { mapDbRowsToApi, checkMissingColumns, ApiNewsItemSchema } from '@/lib/mapNews'
import { HOME_SCHEMA, HOME_VIEW, HOME_COLUMNS } from '@/lib/db/schema-constants'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================================================
// SCHEMA GUARD: Runtime column detection with in-memory cache
// ============================================================================

interface ViewSchemaCache {
  hasWebViewCount: boolean
  checkedAt: number
  columns: string[]
}

const SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
let schemaCache: ViewSchemaCache | null = null

/**
 * Check if web_view_count column exists in the home view
 * Uses RPC function to avoid PostgREST information_schema issues
 * Caches result for 5 minutes to avoid repeated schema queries
 */
async function checkWebViewCountColumn(supabase: any): Promise<ViewSchemaCache> {
  // Return cached result if fresh
  if (schemaCache && (Date.now() - schemaCache.checkedAt) < SCHEMA_CACHE_TTL_MS) {
    const cacheAgeMs = Date.now() - schemaCache.checkedAt
    console.log(`[home/schema-guard] Using cached result (age: ${cacheAgeMs}ms)`)
    return schemaCache
  }
  
  try {
    // Use RPC function to check column existence (avoids PostgREST info_schema issues)
    const { data, error } = await supabase.rpc('util_has_column', {
      view_name: HOME_VIEW,
      col_name: 'web_view_count'
    })
    
    if (error) {
      console.warn('[home/schema-guard] RPC failed, assuming safe defaults:', error.message)
      // Graceful fallback: assume column doesn't exist
      schemaCache = {
        hasWebViewCount: false,
        checkedAt: Date.now(),
        columns: HOME_COLUMNS.slice(0, -1) // Exclude web_view_count
      }
      return schemaCache!
    }
    
    const hasWebViewCount = data === true
    
    console.log(`[home/schema-guard] Column check: view=${HOME_VIEW}, web_view_count=${hasWebViewCount}, cached for ${SCHEMA_CACHE_TTL_MS / 1000}s`)
    
    schemaCache = {
      hasWebViewCount,
      checkedAt: Date.now(),
      columns: hasWebViewCount ? Array.from(HOME_COLUMNS) : HOME_COLUMNS.slice(0, -1)
    }
    
    return schemaCache!
  } catch (error: any) {
    console.error('[home/schema-guard] Exception during schema check:', error.message)
    // Ultra-safe fallback
    schemaCache = {
      hasWebViewCount: false,
      checkedAt: Date.now(),
      columns: HOME_COLUMNS.slice(0, -1)
    }
    return schemaCache!
  }
}

/**
 * Get safe column list for SELECT query
 * If web_view_count is missing, returns columns WITHOUT it
 * (we'll add the field in Node.js post-fetch to avoid SQL aliasing issues)
 */
function getSafeColumns(schemaInfo: ViewSchemaCache): string {
  if (schemaInfo.hasWebViewCount) {
    return HOME_COLUMNS.join(',')
  }
  
  // Fallback: select all existing columns EXCEPT web_view_count
  // We'll add web_view_count=0 in Node.js after fetching to avoid "a0asweb_view_count" SQL errors
  const existingColumns = HOME_COLUMNS.filter(col => col !== 'web_view_count')
  
  console.warn('[home/schema-guard] Column missing: will add web_view_count=0 post-fetch')
  return existingColumns.join(',')
}

/**
 * Add missing web_view_count to rows (post-fetch fallback)
 * This avoids SQL aliasing issues with PostgREST
 */
function addWebViewCountFallback(rows: HomeRow[], schemaInfo: ViewSchemaCache): HomeRow[] {
  if (schemaInfo.hasWebViewCount) {
    return rows // Column exists, no modification needed
  }
  
  // Add web_view_count=0 to each row
  return rows.map(row => ({
    ...row,
    web_view_count: 0
  }))
}

// Type for rows returned from the view
type HomeRow = Record<string, unknown>

// Default home limit if not in config
const HOME_LIMIT_DEFAULT = 20

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  return createClient(url, anon, {
    auth: { persistSession: false },
  })
}

function nocache() {
  return new Headers({
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 's-maxage=0'
  })
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getClient()
    
    // ========================================================================
    // SCHEMA GUARD: Check column availability before querying
    // ========================================================================
    const schemaInfo = await checkWebViewCountColumn(supabase)
    const safeColumns = getSafeColumns(schemaInfo)
    
    // Check if demo mode is enabled (dev only)
    const USE_DEMO = process.env.HOME_USE_DEMO === 'true' && process.env.NODE_ENV !== 'production'
    if (USE_DEMO) {
      console.warn('[home] ⚠️ DEMO MODE ENABLED - Using demo seed data')
    }
    
    // Get config from public system meta view with fallback
    const config = {
      home_limit: HOME_LIMIT_DEFAULT,
      top3_max: 3
    }
    
    try {
      const { data: configData, error } = await supabase
        .from('public_v_system_meta')
        .select('key, value')
        .in('key', ['home_limit', 'top3_max'])
      
      if (error) {
        console.warn('[home] config_read="fallback" reason="permission_error_or_missing_view" defaults="{home_limit:20,top3_max:3}"', error.message)
      } else if (configData && Array.isArray(configData)) {
        configData.forEach(row => {
          const numValue = parseInt(row.value, 10)
          if (!isNaN(numValue)) {
            config[row.key as keyof typeof config] = numValue
          }
        })
      }
    } catch (configError) {
      console.warn('[home] config_read="fallback" reason="exception" defaults="{home_limit:20,top3_max:3}"', configError)
    }
    
    console.log('[home] 📊 Config:', config)
    
    // Primary query: order by rank (view handles time windows)
    // Use safe columns (without web_view_count if missing - we'll add it post-fetch)
    // [HOTFIX 2025-10-10] Defensive: if snapshot_date missing, still proceed (view may be rebuilding)
    const primary = await supabase
      .from(HOME_VIEW)
      .select(safeColumns)
      .order('rank', { ascending: true })
      .limit(config.home_limit)
    
    let rows: HomeRow[] = (primary.data as unknown as HomeRow[]) ?? []
    let dbError: PostgrestError | null = primary.error ?? null
    
    // Add web_view_count=0 if column was missing (post-fetch fallback)
    if (!dbError && rows.length > 0) {
      rows = addWebViewCountFallback(rows, schemaInfo)
    }
    
    console.log('[home] Primary query result:', { 
      dataLength: rows.length, 
      error: dbError?.message ?? null
    })
    
    // Fallback only if no rows and no DB error: order by published_at desc
    if ((!rows || rows.length === 0) && !dbError) {
      console.warn('[home] 🚨 No results found! Trying fallback query...')
      
      const fallback = await supabase
        .from(HOME_VIEW)
        .select(safeColumns)
        .order('published_at', { ascending: false })
        .limit(config.home_limit)
      
      if (fallback.error) {
        dbError = fallback.error
      } else if (fallback.data && fallback.data.length > 0) {
        console.log('[home] ✅ Fallback query returned', fallback.data.length, 'items')
        rows = addWebViewCountFallback(fallback.data as unknown as HomeRow[], schemaInfo)
      } else {
        console.log('[home] ❌ Fallback query also returned no data. Pipeline may need to run.')
      }
    }
    
    if (dbError) {
      console.error('[home] db_error:', dbError.message ?? 'Unknown error')
      
      // [HOTFIX 2025-10-10] Graceful degradation for schema drift
      // If column doesn't exist (view rebuild in progress), return empty set instead of 500
      const isSchemaError = dbError.message?.includes('column') && 
                            (dbError.message?.includes('does not exist') || dbError.message?.includes('not found'))
      
      if (isSchemaError) {
        console.warn('[home] 🔧 Schema drift detected (view rebuild in progress). Returning empty set.')
        console.warn('[home] Schema Error:', {
          error: dbError.message,
          hint: 'Run migration: frontend/db/sql/fixes/2025-10-10_hotfix_snapshot_date.sql',
          viewName: HOME_VIEW
        })
        
        return NextResponse.json(
          { 
            success: true,
            data: [],
            error: null,
            fetchedCount: 0,
            diagnostic: 'View schema rebuilding - please run migration'
          },
          { status: 200, headers: nocache() }
        )
      }
      
      // Log error details for debugging
      if (dbError.message?.includes('invalid input syntax for type json')) {
        console.error('[home] JSON Error Details:', {
          timestamp: new Date().toISOString(),
          error: dbError.message,
          hint: dbError.hint || null,
          details: dbError.details || null,
          viewName: HOME_VIEW,
          columnsRequested: HOME_COLUMNS,
          preventionNote: 'View now uses text type for score_details to prevent JSON casting errors'
        })
      }
      
      return NextResponse.json(
        { 
          success: false,
          data: [],
          error: dbError.message ?? 'Database error',
          fetchedCount: 0
        },
        { status: 500, headers: nocache() }
      )
    }
    
    // Map DB rows to API format
    console.log(`[home] Mapping ${rows.length} database rows...`)
    const mappedItems = mapDbRowsToApi(rows)
    
    if (mappedItems.length === 0 && rows.length > 0) {
      console.error('[home] ❌ All rows failed validation')
      
      // Debug: Check why rows are failing
      const missingCols = checkMissingColumns(rows)
      if (missingCols.missingColumns.length > 0) {
        console.error('[home] Missing columns:', missingCols.missingColumns)
      }
      
      // Sample first failed row for debugging
      if (rows.length > 0) {
        const firstRow = rows[0] as any
        console.error('[home] Sample failed row:', {
          id: firstRow.id,
          title: firstRow.title?.substring(0, 50),
          source_url: firstRow.source_url,
          platform: firstRow.platform,
          hasSummary: Boolean(firstRow.summary),
          hasSummaryEn: Boolean(firstRow.summary_en)
        })
      }
    }
    
    // Extract Top-3 IDs from the mapped items
    const top3Ids = mappedItems
      .filter(item => item.isTop3)
      .map(item => String(item.id))
      .slice(0, 3)
    
    console.log(`[home] ✅ Successfully mapped ${mappedItems.length} items; Top-3: ${top3Ids.length}`)
    
    // Verify Top-3 policy compliance
    const nonTop3WithImages = mappedItems.filter(item => !item.isTop3 && item.showImage).length
    const nonTop3WithPrompts = mappedItems.filter(item => !item.isTop3 && item.showAiPrompt).length
    
    if (nonTop3WithImages > 0) {
      console.error(`[home] ❌ POLICY VIOLATION: ${nonTop3WithImages} non-Top3 items have showImage=true`)
    }
    if (nonTop3WithPrompts > 0) {
      console.error(`[home] ❌ POLICY VIOLATION: ${nonTop3WithPrompts} non-Top3 items have showAiPrompt=true`)
    }
    
    // Return success response matching the user's requested format
    return NextResponse.json({
      success: true,
      fetchedCount: mappedItems.length,
      data: mappedItems,
      top3Ids,
      meta: {
        updatedAt: new Date().toISOString(),
        // Schema guard status for diagnostics
        schemaGuard: {
          hasWebViewCount: schemaInfo.hasWebViewCount,
          usingFallback: !schemaInfo.hasWebViewCount,
          checkedAt: new Date(schemaInfo.checkedAt).toISOString()
        }
      }
    }, { status: 200, headers: nocache() })
    
  } catch (error: any) {
    console.error('[home] Error:', error)
    return NextResponse.json(
      { 
        success: false,
        data: [],
        error: String(error?.message || 'Unknown error'),
        fetchedCount: 0
      },
      { status: 500, headers: nocache() }
    )
  }
}
