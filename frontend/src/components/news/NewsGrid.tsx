'use client'

import { useNewsStore } from '../../stores/newsStore'
import { useUIStore } from '../../stores/uiStore'
import { NewsCard } from './NewsCard'
import { getText } from '../../lib/i18n'

export function NewsGrid() {
  const { renderList, loading, error } = useNewsStore()
  const { language } = useUIStore()

  // Use safe renderList (already has fallback chain in store)
  const items = Array.isArray(renderList) ? renderList : []

  console.log('[NewsGrid] Rendering with items:', items.length, 'loading:', loading, 'error:', error)

  // Only show empty state if request succeeded and normalized data is truly empty
  if (items.length === 0 && !loading) {
    return (
      <div className="text-center py-16">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-concrete-100 dark:bg-void-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-concrete-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-concrete-900 dark:text-white mb-2">
            {error ? 'Unable to Load News' : 'No Trending Stories Right Now'}
          </h3>
          <p className="text-concrete-600 dark:text-concrete-400 text-sm">
            {error 
              ? `Error: ${error}. Please try refreshing the page.`
              : 'Check back later for fresh content or try adjusting your filters.'
            }
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Results header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-concrete-900 dark:text-white">
            Trending News
          </h2>
          <span className="px-3 py-1 bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300 text-sm font-medium rounded-full">
            {items.length} {items.length === 1 ? 'story' : 'stories'}
          </span>
        </div>
        
        {/* Sort indicator */}
        <div className="text-sm text-concrete-600 dark:text-concrete-400">
          Sorted by popularity score
        </div>
      </div>

      {/* News grid */}
      <div className="space-y-6">
        {items.map((news, index) => (
          <div
            key={news.id || news.video_id || `item-${index}`}
            className="animate-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <NewsCard news={news} index={index} />
          </div>
        ))}
      </div>

      {/* Load more button (for future pagination) */}
      {items.length >= 20 && (
        <div className="text-center pt-8">
          <button className="btn-secondary">
            Load More Stories
          </button>
        </div>
      )}
    </div>
  )
}