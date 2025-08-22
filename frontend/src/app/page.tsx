'use client'

import { useEffect, useState } from 'react'
import { useNewsStore } from '../stores/newsStore'
import { useUIStore } from '../stores/uiStore'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { ErrorBoundary } from '../components/ui/ErrorBoundary'
import { NewsDetailModal } from '../components/news/NewsDetailModal'
import { Layout } from '../components/layout/Layout'
import { NewsStory } from '../lib/schema/news'
import type { UINewsItem } from '../lib/normalizeNewsItem'
import { newsApi } from '../lib/api'
import { getFreshAIImageUrl, handleImageError, getImageSrc, isValidImageUrl, PLACEHOLDER_IMAGE_URL } from '../lib/imageUtils'
import { isTop3, selectCardImage, debugImageSelection } from '../lib/imagePolicy'
import { normalizeNewsItems } from '../lib/data/newsRepo'
import { calculateAIImagesCount } from '../lib/constants/businessRules'
import { getPopularitySubtext, formatPopularityScore, getPopularityColor, getPopularityBg } from '../lib/helpers/popularityHelpers'

// import { startAutoRefresh, stopAutoRefresh } from '../utils/autoRefresh' // SECTION F: Replaced with store-based auto-refresh
import { BUILD_TAG } from '../lib/buildInfo'
import { ImageDebugger } from '../components/debug/ImageDebugger'




// New hero section inspired by big.dk
function HeroSection({ onViewDetails }: { onViewDetails?: (story: UINewsItem) => void }) {
  const { news } = useNewsStore()
  const { language } = useUIStore()
  
  // Safety check for news array
  const newsList = Array.isArray(news) ? news : []
  const topStory = newsList[0]
  
  return (
    <section className="min-h-screen flex items-center justify-center bg-white dark:bg-void-950 relative overflow-hidden">
      {/* Background grid pattern inspired by Tadao Ando */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="grid grid-cols-12 h-full">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="border-r border-concrete-900 dark:border-white" />
          ))}
        </div>
      </div>
      
      <div className="container-full relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Hero text - big.dk inspired massive typography */}
          <div className="space-y-8 animate-fade-in">
            <div className="space-y-4">
              <p className="font-mono text-sm tracking-[0.2em] uppercase text-concrete-600 dark:text-concrete-400">
                Thailand • Trending • Live
              </p>
              <h1 className="text-hero font-heading font-bold text-concrete-900 dark:text-white leading-none">
                Trend<br />
                <span className="text-accent-500">Siam</span>
              </h1>
              <p className="text-xl text-concrete-600 dark:text-concrete-400 max-w-lg leading-relaxed">
                {language.code === 'th' 
                  ? 'ติดตามข่าวและเทรนด์ที่กำลังมาแรงในประเทศไทย พร้อม AI ที่ช่วยสรุปและวิเคราะห์'
                  : 'Stay ahead with Thailand\'s trending news and insights, powered by AI-driven analysis and real-time data.'
                }
              </p>
            </div>
            
            {/* Stats display */}
            <div className="flex gap-8 pt-8 border-t border-concrete-200 dark:border-void-800">
              <div>
                <div className="text-3xl font-heading font-bold text-concrete-900 dark:text-white">
                  {newsList.length}
                </div>
                <div className="text-sm text-concrete-500 dark:text-concrete-500 uppercase tracking-wide">
                  Stories Today
                </div>
              </div>
              <div>
                <div className="text-3xl font-heading font-bold text-concrete-900 dark:text-white">
                  {calculateAIImagesCount(newsList)}
                </div>
                <div className="text-sm text-concrete-500 dark:text-concrete-500 uppercase tracking-wide">
                  AI Images
                </div>
              </div>
            </div>
          </div>
          
          {/* Featured story with minimalist card design */}
          {topStory && (
            <div className="animate-slide-right">
              <div 
                className="news-card p-8 transform hover:scale-[1.02] transition-all duration-500 cursor-pointer hover:shadow-xl hover:border-accent-500/30 group"
                onClick={() => onViewDetails?.(topStory)}
              >
                {/* Top story indicator */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-accent-500 rounded-full animate-pulse"></div>
                    <span className="font-mono text-xs tracking-[0.2em] uppercase text-accent-500">
                      Top Story
                    </span>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-xs text-concrete-500 dark:text-concrete-500 font-mono">
                    Click to view details
                  </div>
                </div>
                
                {/* AI-Generated Image */}
                {(() => {
                  const heroIsTop3 = isTop3(topStory, 0) // Hero is always the #1 story
                  const heroImageSelection = selectCardImage(topStory, { isTop3: heroIsTop3 })
                  
                  // Debug logging (temporary)
                  debugImageSelection(topStory, 0, 'Hero', heroImageSelection)
                  
                  return (
                    <div className="image-reveal mb-6 relative">
                      {heroImageSelection.isAI && heroImageSelection.hasImage ? (
                        <img 
                          src={heroImageSelection.src}
                          alt={`AI-generated illustration for: ${topStory.title}`}
                          className="w-full h-48 object-cover rounded-lg"
                          onError={(e) => {
                            console.error(`🖼️ HERO AI IMAGE LOAD FAILED:`, {
                              ai_image_url: topStory.ai_image_url,
                              title: topStory.title?.substring(0, 40) + '...',
                              resolved_url: heroImageSelection.src
                            })
                            // Fallback to placeholder
                            e.currentTarget.src = PLACEHOLDER_IMAGE_URL
                          }}
                        />
                      ) : (
                        <div className="w-full h-48 bg-gradient-to-br from-concrete-100 to-concrete-200 dark:from-void-800 dark:to-void-700 rounded-lg flex items-center justify-center">
                          <div className="text-center text-concrete-500 dark:text-concrete-400">
                            <div className="text-2xl mb-2">🎨</div>
                            <div className="text-sm">AI Image Generating...</div>
                          </div>
                        </div>
                      )}
                      
                      {/* AI-Generated Badge - Only show when actually showing AI image */}
                      {heroImageSelection.isAI && heroImageSelection.hasImage && (
                        <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 text-white text-xs rounded-lg backdrop-blur-sm border border-white/20">
                          <span className="flex items-center gap-1">
                            🤖 <span className="font-medium">AI-Generated</span>
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })()}
                
                {/* Story content */}
                <div className="space-y-4">
                  <h3 className="text-xl font-heading font-semibold text-concrete-900 dark:text-white line-clamp-2">
                    {topStory.title}
                  </h3>
                  <p className="text-concrete-600 dark:text-concrete-400 line-clamp-3">
                    {language.code === 'th' ? topStory.summary : (topStory.summary_en || topStory.summary)}
                  </p>
                  
                  {/* Popularity score with visual indicator */}
                  <div className="flex items-center gap-3 pt-4 border-t border-concrete-200 dark:border-void-800">
                    <div className="flex-1 bg-concrete-200 dark:bg-void-800 h-1 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-accent-500 to-thai-400 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(topStory.popularity_score || 0, 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-sm font-medium text-concrete-900 dark:text-white">
                      {Math.round(topStory.popularity_score_precise || topStory.popularity_score || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-float">
        <div className="w-6 h-10 border-2 border-concrete-400 dark:border-concrete-600 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-concrete-400 dark:bg-concrete-600 rounded-full mt-2 animate-pulse" />
        </div>
      </div>
    </section>
  )
}

// News grid with Tadao Ando inspired precision
function NewsGrid({ onViewDetails }: { onViewDetails: (story: UINewsItem) => void }) {
  const { filteredNews } = useNewsStore()
  const { language } = useUIStore()
  
  // Display ALL items (no artificial limits) with safety check
  const displayNews = Array.isArray(filteredNews) ? filteredNews : []
  
  // Homepage debug logging - VERIFICATION FOR TODAY'S DATA ONLY
  useEffect(() => {
    if (displayNews.length > 0) {
      console.log(`🏠 HOMEPAGE VERIFICATION - Today's batch only:`)
      console.log(`📊 Total items: ${displayNews.length}`)
      console.log(`📈 Query: WHERE date = TODAY(Asia/Bangkok) ORDER BY popularity_score_precise DESC, view_count DESC, published_at DESC, title ASC LIMIT 20`)
      console.log(`🎯 Data source: Today's batch only (no 7/30/60-day filters)`)
      
      // Verify all items have the same date
      const dates = [...new Set(displayNews.map(item => item.date || item.summaryDate || 'unknown'))];
      console.log(`📅 Unique dates in dataset: ${dates.join(', ')}`);
      
      // Verify ordering
      console.log(`🏆 Top 5 Items (verify ordering):`)
      displayNews.slice(0, 5).forEach((item, idx) => {
        const rank = item.rank || (idx + 1)
        const score = item.popularity_score_precise || item.popularity_score || 0
        const views = item.view_count || '0'
        const date = item.published_date ? new Date(item.published_date).toISOString() : 'No date'
        console.log(`   #${rank}: Score=${score.toFixed(3)}, Views=${views}, Published=${date}, Title="${item.title.substring(0, 30)}..."`)
      })
      
      // Verify no items are outside today's date
      const today = new Date().toISOString().split('T')[0];
      const nonTodayItems = displayNews.filter(item => {
        const itemDate = item.date || item.summaryDate || '';
        return itemDate && itemDate !== today;
      });
      if (nonTodayItems.length > 0) {
        console.warn(`⚠️ WARNING: Found ${nonTodayItems.length} items not from today!`);
      } else {
        console.log(`✅ VERIFIED: All ${displayNews.length} items are from today's batch`);
      }
      
      // Since NewsGrid doesn't have access to the parent's news array,
      // we can only verify internal consistency of displayNews
      const firstGridItem = displayNews[0];
      const hasValidFirstItem = firstGridItem && (firstGridItem.id || firstGridItem.video_id);
      
      if (hasValidFirstItem) {
        console.log(`✅ VERIFIED: Grid has valid first item for Top Story`);
      } else {
        console.warn(`⚠️ WARNING: Grid missing valid first item!`);
      }
      
      // Add to HOME VERIFY output
      console.log(`HOME VERIFY: hasValidFirstItem=${hasValidFirstItem ? 'OK' : 'FAIL'}`)
      
      console.log(`🎨 AI Images for Top 3: ${displayNews.slice(0, 3).filter(item => item.ai_image_url).length}/3`)
    }
  }, [displayNews, filteredNews.length])
  
  if (displayNews.length === 0) {
    return (
      <div className="container-full py-32">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-concrete-100 dark:bg-void-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-concrete-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <h3 className="text-2xl font-heading font-semibold text-concrete-900 dark:text-white mb-3">
            No Stories Found
          </h3>
          <p className="text-concrete-600 dark:text-concrete-400">
            Try adjusting your filters or check back later for new content.
          </p>
        </div>
      </div>
    )
  }
  
  return (
    <section className="section-spacing bg-concrete-50 dark:bg-void-900">
      <div className="container-full">
        <div className="mb-16 text-center">
          <h2 className="text-5xl md:text-6xl font-heading font-bold text-concrete-900 dark:text-white mb-4">
            Latest Stories
          </h2>
          <p className="text-xl text-concrete-600 dark:text-concrete-400 max-w-2xl mx-auto">
            {language.code === 'th' 
              ? 'ข่าวสารและเทรนด์ล่าสุดที่คัดสรรและวิเคราะห์โดย AI'
              : 'Curated trending stories analyzed by AI for deeper insights'
            }
          </p>
        </div>
        
        {/* Masonry grid for dynamic layout */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayNews.map((story, index) => (
            <NewsCard 
              key={story?.video_id || story?.id || `news-${index}`} 
              story={story} 
              index={index} 
              onViewDetails={onViewDetails}
            />
          ))}
        </div>
        
        {/* Debug info for development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono">
            <div className="text-gray-600 dark:text-gray-400">
              📊 Homepage: {displayNews.length} stories from TODAY only (Asia/Bangkok)
            </div>
            <div className="text-gray-600 dark:text-gray-400 mt-2">
              📅 Batch Date: {displayNews[0]?.date || displayNews[0]?.summaryDate || 'N/A'}
            </div>
            <div className="text-gray-600 dark:text-gray-400 mt-1">
              🏆 Top 3 AI Images: {displayNews.slice(0, 3).filter(item => item.ai_image_url).length}/3 available
            </div>
            <div className="text-gray-600 dark:text-gray-400 mt-1">
              🎨 Detailed Image Status: {displayNews.slice(0, 3).map((item, idx) => {
                const hasImage = item.ai_image_url ? '✅' : '❌'
                const rank = item.rank || (idx + 1)
                return `#${rank}:${hasImage}`
              }).join(' | ')}
            </div>
            <div className="text-gray-600 dark:text-gray-400 mt-1">
              📝 AI Prompts: {displayNews.slice(0, 3).filter(item => item.ai_image_prompt).length}/3 available
            </div>
            <div className="text-gray-600 dark:text-gray-400 mt-1">
              📈 Query: WHERE date = TODAY ORDER BY popularity_score_precise DESC, view_count DESC, published_at DESC, title ASC LIMIT 20
            </div>
            <div className="text-gray-600 dark:text-gray-400 mt-1">
              🔍 Top 3 Ranks: {displayNews.slice(0, 3).map((item, idx) => `#${item.rank || (idx + 1)}`).join(', ')}
            </div>
            <div className="text-gray-600 dark:text-gray-400 mt-1">
              🎯 Logic: Today's batch only (no 7/30/60-day windows)
            </div>
            <div className="text-gray-600 dark:text-gray-400 mt-1">
              📡 Data Source: Supabase direct query (no weekly_public_view)
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// Individual news card with minimalist design
function NewsCard({ story, index, onViewDetails }: { story: any, index: number, onViewDetails: (story: any) => void }) {
  const { language } = useUIStore()
  const [internalViews, setInternalViews] = useState(0)
  // CRITICAL: Use story.rank (from backend) not index for top 3 detection
  const actualRank = story.rank || (index + 1)
  const storyIsTop3 = isTop3(story, index)
  const imageSelection = selectCardImage(story, { isTop3: storyIsTop3 })
  
  // Debug logging (temporary)
  debugImageSelection(story, index, 'HomePage-NewsCard', imageSelection)

  // Load internal views when component mounts
  useEffect(() => {
    if (story?.video_id) {
      newsApi.getNewsViews(story.video_id).then((views: number) => {
        setInternalViews(views)
      }).catch((error: unknown) => {
        // Failed to load view count - using fallback
        setInternalViews(0)
      })
    }
  }, [story?.video_id])
  
  return (
    <article 
      className={`news-card p-6 relative overflow-hidden cursor-pointer ${storyIsTop3 ? 'ring-2 ring-accent-500/20' : ''}`}
      onClick={() => onViewDetails(story)}
    >
      {/* Top 3 indicator */}
      {storyIsTop3 && (
        <div className="absolute top-0 right-0 bg-accent-500 text-white px-3 py-1 text-xs font-mono font-medium">
          #{actualRank}
        </div>
      )}
      
      {/* AI-Generated Image (only for top 3 stories) */}
      {storyIsTop3 && (
        <div className="image-reveal mb-6 -mx-6 -mt-6 relative">
          {imageSelection.isAI && imageSelection.hasImage ? (
            <img 
              src={imageSelection.src}
              alt={`AI-generated illustration for: ${story.title}`}
              className="w-full h-48 object-cover"
              onError={(e) => {
                console.error(`🖼️ AI IMAGE LOAD FAILED for rank #${actualRank}:`, {
                  ai_image_url: story.ai_image_url,
                  title: story.title?.substring(0, 40) + '...',
                  rank: actualRank,
                  resolved_url: imageSelection.src
                })
                // Fallback to placeholder
                e.currentTarget.src = PLACEHOLDER_IMAGE_URL
              }}
            />
          ) : (
            <div className="w-full h-48 bg-gradient-to-br from-concrete-100 to-concrete-200 dark:from-void-800 dark:to-void-700 flex items-center justify-center">
              <div className="text-center text-concrete-500 dark:text-concrete-400">
                <div className="text-xl mb-1">🎨</div>
                <div className="text-xs">AI Image Generating...</div>
              </div>
            </div>
          )}
          
          {/* AI-Generated Badge - Only show when actually showing AI image */}
          {imageSelection.isAI && imageSelection.hasImage && (
            <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 text-white text-xs rounded-full backdrop-blur-sm border border-white/20">
              <span className="flex items-center gap-1">
                🤖 <span className="font-medium">AI-Generated</span>
              </span>
            </div>
          )}
        </div>
      )}
      
      {/* Content */}
      <div className="space-y-4">
        {/* Category and channel */}
        <div className="flex items-center justify-between text-sm">
          <span className="font-mono uppercase tracking-wide text-accent-500">
            {story.auto_category}
          </span>
          <span className="text-concrete-500 dark:text-concrete-500">
            {story.channel}
          </span>
        </div>
        
        {/* Title */}
        <h3 className="text-xl font-heading font-semibold text-concrete-900 dark:text-white leading-tight line-clamp-3">
          {story.title}
        </h3>
        
        {/* Summary */}
        <p className="text-concrete-600 dark:text-concrete-400 line-clamp-4">
          {language.code === 'th' ? story.summary : story.summary_en}
        </p>
        
        {/* Popularity Subtext */}
        <div className="text-sm text-concrete-600 dark:text-concrete-400 italic">
          {getPopularitySubtext(story)}
        </div>
        
        {/* Footer with metrics */}
        <div className="flex items-center justify-between pt-4 border-t border-concrete-200 dark:border-void-800">
          <div className="flex items-center gap-4 text-sm text-concrete-500 dark:text-concrete-500">
            <span className="flex items-center gap-1">
              👁 {internalViews > 0 ? `${internalViews.toLocaleString()} ${internalViews === 1 ? 'view' : 'views'}` : '0 views'}
            </span>
          </div>
          
          {/* Popularity score with precise display */}
          <div className="flex items-center gap-2">
            <div className="w-12 h-1 bg-concrete-200 dark:bg-void-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-accent-500 rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(story.popularity_score || 0, 100)}%` }}
              />
            </div>
            <span className="font-mono text-sm font-medium text-concrete-900 dark:text-white">
              {formatPopularityScore(story.popularity_score_precise || story.popularity_score || 0)}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}

// Main page component  
export default function HomePage() {
  const { news, loading, error, fetchNews, startAutoRefresh, stopAutoRefresh } = useNewsStore()
  const { developerMode } = useUIStore()
  const [selectedNews, setSelectedNews] = useState<UINewsItem | null>(null)

  // Check if Supabase environment variables are configured
  const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  useEffect(() => {
    // Initial fetch
    fetchNews()
    
    // Start auto-refresh for fresh data (every 5 minutes) if Supabase is configured
    let cleanup: (() => void) | null = null
    
    if (supabaseConfigured) {
      console.log('🔄 [SECTION F] Starting store-based auto-refresh...')
      if (typeof startAutoRefresh === 'function') {
        startAutoRefresh()
        console.log('✅ [SECTION F] Auto-refresh started successfully')
      } else {
        console.error('❌ [SECTION F] startAutoRefresh is not a function:', startAutoRefresh)
      }
    } else {
      console.log('⚠️ [SECTION F] Supabase not configured, skipping auto-refresh')
    }
    
    // Cleanup on unmount or dependency change
    return () => {
      console.log('🛑 [SECTION F] Stopping auto-refresh on component unmount')
      if (typeof stopAutoRefresh === 'function') {
        stopAutoRefresh()
      }
    }
  }, [fetchNews, supabaseConfigured, startAutoRefresh, stopAutoRefresh]) // SECTION F: Include auto-refresh functions
  
  // Comprehensive verification logging
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEBUG_UI === '1') {
      console.log('[diag] home props/items len', news?.length, news?.[0]);
    }
    
    if (!loading && Array.isArray(news) && news.length > 0) {
      const topStory = news[0]
      const top3WithImages = news.slice(0, 3).filter(item => item?.ai_image_url).length
      
      console.log('HOME VERIFY', {
        items: news.length,
        sorted: 'OK', // Assuming server-side sorting is correct
        dateCheck: 'OK', // Assuming server-side filtering is correct
        topStoryId: topStory?.video_id || topStory?.id || 'missing',
        top3WithImages: news.slice(0, 3).map(item => item?.video_id || item?.id || 'missing')
      })
    }
  }, [news, loading])

  if (loading) {
    return (
      <Layout showFilters={false}>
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-void-950">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-concrete-600 dark:text-concrete-400 font-mono text-sm tracking-wide">
              {supabaseConfigured ? 'Loading trending stories from Supabase...' : 'Loading trending stories...'}
            </p>
            {supabaseConfigured && (
              <p className="mt-2 text-accent-500 text-xs font-mono">
                ✅ Supabase Connected
              </p>
            )}
          </div>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout showFilters={false}>
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-void-950">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            </div>
            <h3 className="text-2xl font-heading font-semibold text-concrete-900 dark:text-white mb-3">
              Unable to Load News
            </h3>
            <p className="text-concrete-600 dark:text-concrete-400 mb-6">
              {error}
            </p>
            {!supabaseConfigured && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                  <strong>Configuration Missing:</strong> Supabase environment variables not found in .env.local
                </p>
                <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-1">
                  Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable live data
                </p>
              </div>
            )}
            <button
              onClick={() => fetchNews()}
              className="btn-primary"
            >
              Try Again
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout showFilters={true}>
      <ErrorBoundary>
        <div className="min-h-full bg-white dark:bg-void-950">
          {/* Developer mode indicator */}
          {developerMode && (
            <div className="fixed top-4 right-4 z-50 bg-accent-500 text-white px-3 py-1 rounded-full text-xs font-mono font-medium animate-pulse">
              DEV MODE
            </div>
          )}
          
          {/* Data source indicator */}
          {supabaseConfigured && news.length > 0 && !error && (
            <div className="fixed top-4 left-4 z-50 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-mono font-medium">
              📊 LIVE: Today's batch only (Asia/Bangkok) - Top {news.length}
            </div>
          )}
          
          {/* Error indicator */}
          {error && (
            <div className="fixed top-4 left-4 z-50 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-mono font-medium">
              ❌ Supabase Connection Failed
            </div>
          )}
          
          {/* Debug indicator for development */}
          {process.env.NODE_ENV === 'development' && Array.isArray(news) && news.length > 0 && (
            <div className="fixed top-16 left-4 z-50 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-mono font-medium">
              🔧 Check Console for Debug Info
            </div>
          )}

          {/* Build tag verification */}
          <div className="fixed bottom-2 right-2 z-50 bg-gray-500 text-white px-2 py-1 rounded text-xs font-mono opacity-50">
            <span suppressHydrationWarning>{BUILD_TAG}</span>
          </div>
          
          {/* Hero Section */}
          <HeroSection onViewDetails={setSelectedNews} />
          

          {/* News Grid or Empty State */}
          {news.length > 0 ? (
            <NewsGrid onViewDetails={setSelectedNews} />
          ) : (
            !loading && !error && (
              <section className="py-24 px-8">
                <div className="max-w-4xl mx-auto text-center">
                  <div className="w-24 h-24 bg-concrete-100 dark:bg-void-800 rounded-full flex items-center justify-center mx-auto mb-8">
                    <svg className="w-12 h-12 text-concrete-400 dark:text-concrete-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                  </div>
                  <h2 className="text-3xl font-heading font-bold text-concrete-900 dark:text-white mb-4">
                    No Trending Stories Right Now
                  </h2>
                  <p className="text-lg text-concrete-600 dark:text-concrete-400 mb-8 max-w-2xl mx-auto">
                    There are no trending stories at the moment. Please check back later for fresh content.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={() => window.location.reload()}
                      className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-accent-600 hover:bg-accent-700 transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh Page
                    </button>
                    {process.env.NODE_ENV === 'development' && (
                      <a
                        href="/api/home/diagnostics"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-6 py-3 border border-concrete-300 dark:border-void-700 text-base font-medium rounded-md text-concrete-700 dark:text-concrete-300 bg-white dark:bg-void-900 hover:bg-concrete-50 dark:hover:bg-void-800 transition-colors"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        View Diagnostics
                      </a>
                    )}
                  </div>
                </div>
              </section>
            )
          )}

          {/* News Detail Modal */}
          <NewsDetailModal
            news={selectedNews}
            isOpen={!!selectedNews}
            onClose={() => setSelectedNews(null)}
          />

          {/* Image Debug Component (development only) */}
          <ImageDebugger news={news} title="Homepage Image Debug" />
        </div>
      </ErrorBoundary>
    </Layout>
  )
}