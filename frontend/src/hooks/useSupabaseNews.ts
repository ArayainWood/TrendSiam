import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { NewsTrend, NewsItem } from '../types'

interface UseSupabaseNewsReturn {
  news: NewsItem[]
  loading: boolean
  error: string | null
  fetchNews: () => Promise<void>
  refreshNews: () => Promise<void>
}

// Transform Supabase data to match existing NewsItem interface
function transformSupabaseToNewsItem(supabaseItem: NewsTrend, rank: number): NewsItem {
  return {
    rank: rank,
    title: supabaseItem.title,
    channel: supabaseItem.platform || 'Unknown',
    view_count: '0', // Default since we don't have this in Supabase
    published_date: supabaseItem.date || new Date().toISOString(),
    video_id: supabaseItem.id, // Use Supabase ID as video_id
    description: supabaseItem.summary || '',
    duration: 'Unknown',
    like_count: '0',
    comment_count: '0',
    summary: supabaseItem.summary || '',
    summary_en: supabaseItem.summary || '', // Use same summary for both languages
    popularity_score: Math.round(supabaseItem.popularity_score || 0),
    popularity_score_precise: supabaseItem.popularity_score || 0,
    reason: `Popularity score: ${supabaseItem.popularity_score?.toFixed(1) || 0}`,
    view_details: {
      views: '0 views',
      growth_rate: 'N/A',
      platform_mentions: 'Primary platform only',
      matched_keywords: '0 keywords',
      ai_opinion: 'Data loaded from Supabase database',
      score: `${supabaseItem.popularity_score?.toFixed(1) || 0}/100 (Supabase)`
    },
    auto_category: supabaseItem.category || 'Uncategorized',
    platform: supabaseItem.platform || 'Unknown',
    ai_image_local: supabaseItem.ai_image_url || undefined,
    ai_image_url: supabaseItem.ai_image_url || undefined,
    ai_image_prompt: undefined
  }
}

export function useSupabaseNews(limit: number = 20): UseSupabaseNewsReturn {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNews = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('🔄 Fetching news from Supabase...')

      // Fetch from secure public view, ordered by popularity_score descending
      const { data, error: supabaseError } = await supabase
        .from('public_v_home_news')
        .select(`
          id,
          rank,
          title,
          summary,
          summary_en,
          category,
          platform,
          channel,
          video_id,
          popularity_score,
          popularity_score_previous,
          growth_rate_num,
          growth_rate_raw,
          views,
          likes,
          comments,
          display_image_url,
          ai_image_prompt,
          source_url,
          duration,
          description,
          keywords,
          platform_mentions,
          reason,
          ai_opinion,
          score_details,
          created_at,
          updated_at,
          published_at,
          published_date,
          summary_date,
          view_details,
          view_count,
          like_count,
          comment_count,
          raw_view,
          ai_image_url,
          extra,
          image_url,
          display_image_url_raw,
          is_ai_image,
          platforms_raw,
          safe_image_url,
          channel_title
        `)
        .order('rank', { ascending: true })
        .limit(limit)

      if (supabaseError) {
        throw new Error(`Supabase error: ${supabaseError.message}`)
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ No data found in Supabase news_trends table')
        setNews([])
        setError('No news data available. Please add some data to your Supabase table.')
        return
      }

      // Transform Supabase data to NewsItem format with ranking
      const transformedNews = data.map((item, index) => 
        transformSupabaseToNewsItem(item as any, index + 1)
      )

      console.log(`✅ Loaded ${transformedNews.length} news items from Supabase`)
      console.log(`🎨 AI images available: ${transformedNews.filter(item => item.ai_image_url).length}/${transformedNews.length}`)

      setNews(transformedNews)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch news from Supabase'
      console.error('❌ Error fetching news from Supabase:', errorMessage)
      setError(errorMessage)
      
      // Don't set empty array on error, keep existing data if any
      if (news.length === 0) {
        setNews([])
      }
    } finally {
      setLoading(false)
    }
  }, [limit, news.length])

  const refreshNews = useCallback(async () => {
    await fetchNews()
  }, [fetchNews])

  // Auto-fetch on hook initialization
  useEffect(() => {
    fetchNews()
  }, [fetchNews])

  return {
    news,
    loading,
    error,
    fetchNews,
    refreshNews
  }
}
