'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { NewsTrend } from '../../types'
import { LoadingSpinner } from '../ui/LoadingSpinner'

interface SupabaseNewsGridProps {
  limit?: number
  onNewsItemClick?: (item: NewsTrend) => void
}

export function SupabaseNewsGrid({ limit = 10, onNewsItemClick }: SupabaseNewsGridProps) {
  const [newsTrends, setNewsTrends] = useState<NewsTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchNewsTrends()
  }, [limit])

  const fetchNewsTrends = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch the most recent news trends from Supabase
      const { data, error } = await supabase
        .from('v_home_news')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw error
      }

      setNewsTrends(data || [])
    } catch (err) {
      console.error('Error fetching news trends:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch news trends')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    fetchNewsTrends()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-concrete-600 dark:text-concrete-400 font-mono text-sm tracking-wide">
            Loading news trends from Supabase...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
              Failed to Load News Trends
            </h3>
            <p className="text-red-700 dark:text-red-300 text-sm">
              {error}
            </p>
            <p className="text-red-600 dark:text-red-400 text-xs mt-2">
              Make sure your Supabase configuration is correct and the news_trends table exists.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (newsTrends.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-concrete-100 dark:bg-void-800 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-concrete-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </div>
        <h3 className="text-2xl font-heading font-semibold text-concrete-900 dark:text-white mb-3">
          No News Trends Found
        </h3>
        <p className="text-concrete-600 dark:text-concrete-400 mb-6">
          There are no news trends in the database yet. Try adding some data to your Supabase table.
        </p>
        <button
          onClick={handleRefresh}
          className="btn-primary"
        >
          Refresh
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-heading font-bold text-concrete-900 dark:text-white">
            Latest News Trends
          </h2>
          <p className="text-concrete-600 dark:text-concrete-400 mt-2">
            {newsTrends.length} trends loaded from Supabase
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-concrete-600 dark:text-concrete-400 hover:text-concrete-900 dark:hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* News grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {newsTrends.map((trend, index) => (
          <NewsCard
            key={trend.id}
            trend={trend}
            rank={index + 1}
            onClick={() => onNewsItemClick?.(trend)}
          />
        ))}
      </div>
    </div>
  )
}

// Individual news card component
function NewsCard({ trend, rank, onClick }: { trend: NewsTrend; rank: number; onClick?: () => void }) {
  const isTop3 = rank <= 3

  return (
    <article
      className={`news-card p-6 cursor-pointer transition-all duration-300 hover:transform hover:scale-105 ${
        isTop3 ? 'ring-2 ring-accent-500/20 bg-gradient-to-br from-accent-50 to-white dark:from-accent-900/10 dark:to-void-950' : ''
      }`}
      onClick={onClick}
    >
      {/* Rank indicator */}
      <div className="flex items-center justify-between mb-4">
        <div className={`flex items-center gap-2 ${isTop3 ? 'text-accent-600 dark:text-accent-400' : 'text-concrete-500 dark:text-concrete-500'}`}>
          <span className="font-mono text-sm font-medium">#{rank}</span>
          {isTop3 && (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          )}
        </div>
        <div className="text-xs text-concrete-400 dark:text-concrete-600">
          {trend.platform}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        <h3 className="text-xl font-heading font-semibold text-concrete-900 dark:text-white leading-tight line-clamp-2">
          {trend.title}
        </h3>

        {trend.summary && (
          <p className="text-concrete-600 dark:text-concrete-400 line-clamp-3 text-sm leading-relaxed">
            {trend.summary}
          </p>
        )}

        {/* Footer with metrics */}
        <div className="flex items-center justify-between pt-4 border-t border-concrete-200 dark:border-void-800">
          <div className="text-xs text-concrete-500 dark:text-concrete-500">
            {trend.date ? new Date(trend.date).toLocaleDateString() : 'No date'}
          </div>
          
          {trend.popularity_score && (
            <div className="flex items-center gap-2">
              <div className="w-12 h-1 bg-concrete-200 dark:bg-void-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-500 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(Math.max(trend.popularity_score, 0), 100)}%` }}
                />
              </div>
              <span className="font-mono text-xs font-medium text-concrete-900 dark:text-white">
                {Math.round(trend.popularity_score)}
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

