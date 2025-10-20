/**
 * Dev-only API route to fetch database schema inventory
 * Returns all columns for specified tables from information_schema
 */

import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Tables we care about for the inventory - include ALL public tables
const TRACKED_TABLES = [
  'news_trends',
  'stories', 
  'snapshots',
  'image_files',
  'ai_images',
  'system_meta',
  'stats',
  'weekly_report_snapshots'
  // Note: This list will be replaced with dynamic discovery of ALL tables
]

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

export async function GET(req: NextRequest) {
  // Dev-only check
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    )
  }

  try {
    const supabase = getClient()
    
    // First, discover ALL tables in the public schema
    const { data: allTables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE')
      .order('table_name')
    
    if (tablesError) {
      console.error('[db-inventory] Error querying tables:', tablesError)
      return NextResponse.json(
        { error: 'Failed to query database tables', details: tablesError.message },
        { status: 500 }
      )
    }
    
    const tableNames = allTables?.map(t => t.table_name) || []
    
    // Query information_schema for ALL public tables
    const { data: columns, error } = await supabase
      .from('information_schema.columns')
      .select('table_name, column_name, ordinal_position, data_type, is_nullable, column_default')
      .eq('table_schema', 'public')
      .in('table_name', tableNames.length > 0 ? tableNames : TRACKED_TABLES)
      .order('table_name')
      .order('ordinal_position')
    
    if (error) {
      console.error('[db-inventory] Error querying information_schema:', error)
      return NextResponse.json(
        { error: 'Failed to query database schema', details: error.message },
        { status: 500 }
      )
    }
    
    // Group columns by table
    const tables: Record<string, string[]> = {}
    
    if (columns) {
      columns.forEach(col => {
        if (!tables[col.table_name]) {
          tables[col.table_name] = []
        }
        tables[col.table_name]!.push(col.column_name)
      })
    }
    
    // No need to ensure tracked tables - we discover all tables dynamically
    
    const response = {
      tables,
      generatedAt: new Date().toISOString(),
      columnsDetail: columns // Include full column info for debugging
    }
    
    return NextResponse.json(response, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    })
    
  } catch (error: any) {
    console.error('[db-inventory] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message },
      { status: 500 }
    )
  }
}
