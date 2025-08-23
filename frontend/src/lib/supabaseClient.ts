import { createClient } from '@supabase/supabase-js'

// Environment variables validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}

if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
}

// Create Supabase client with best practices
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Type-safe database schema interfaces (matches comprehensive schema)
export interface NewsTrend {
  id: string
  title: string
  summary: string | null
  summary_en: string | null
  platform: string | null
  popularity_score: number | null
  popularity_score_precise: number | null
  date: string | null
  category: string | null
  ai_image_url: string | null
  ai_image_prompt: string | null
  
  // Original metadata fields
  video_id: string | null
  channel: string | null
  view_count: string | null
  published_date: string | null
  description: string | null
  duration: string | null
  like_count: string | null
  comment_count: string | null
  reason: string | null
  
  // View details metadata
  raw_view: string | null
  growth_rate: string | null
  platform_mentions: string | null
  keywords: string | null
  ai_opinion: string | null
  score_details: string | null
  
  // System fields
  created_at?: string
  updated_at?: string
}

// Utility functions for Supabase operations
export const supabaseUtils = {
  // Check if Supabase is properly configured
  isConfigured: (): boolean => {
    try {
      return !!(supabaseUrl && supabaseAnonKey)
    } catch {
      return false
    }
  },

  // Test connection to Supabase
  testConnection: async (): Promise<boolean> => {
    try {
      const { error } = await supabase.from('news_trends').select('count', { count: 'exact', head: true })
      return !error
    } catch {
      return false
    }
  },

  // Get health check info
  getHealthInfo: () => {
    return {
      url: supabaseUrl,
      hasKey: !!supabaseAnonKey,
      keyPreview: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...` : 'Not set'
    }
  },

  // Get current date in Thailand timezone (UTC+7)
  getThailandDate: (): string => {
    const now = new Date()
    const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000)) // UTC+7
    return thailandTime.toISOString().split('T')[0]! // YYYY-MM-DD format (guaranteed to exist)
  },

  // Check if a date string matches today in Thailand timezone
  isToday: (dateString: string | null): boolean => {
    if (!dateString) return false
    const today = supabaseUtils.getThailandDate()
    return dateString.split('T')[0] === today
  },

  // Format date for Thailand timezone display
  formatThailandDate: (dateString: string | null): string => {
    if (!dateString) return 'Unknown Date'
    try {
      const date = new Date(dateString + 'T00:00:00+07:00') // Assume Thailand timezone
      return date.toLocaleDateString('en-US', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }
}

export default supabase

