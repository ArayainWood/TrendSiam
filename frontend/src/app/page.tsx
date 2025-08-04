'use client'

import { useEffect, useState } from 'react'
import { useNewsStore } from '../stores/newsStore'
import { useUIStore } from '../stores/uiStore'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { ErrorBoundary } from '../components/ui/ErrorBoundary'
import { NewsDetailModal } from '../components/news/NewsDetailModal'
import { Layout } from '../components/layout/Layout'
import { NewsItem } from '../types'
import { newsApi } from '../lib/api'




// New hero section inspired by big.dk
function HeroSection({ onViewDetails }: { onViewDetails?: (story: NewsItem) => void }) {
  const { news } = useNewsStore()
  const { language } = useUIStore()
  
  const topStory = news[0]
  
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
                  {news.length}
                </div>
                <div className="text-sm text-concrete-500 dark:text-concrete-500 uppercase tracking-wide">
                  Stories Today
                </div>
              </div>
              <div>
                <div className="text-3xl font-heading font-bold text-concrete-900 dark:text-white">
                  {news.filter(item => item.ai_image_url).length}
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
                
                {/* AI Image */}
                {topStory.ai_image_url && (
                  <div className="image-reveal mb-6">
                    <img 
                      src={topStory.ai_image_url}
                      alt={topStory.title}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </div>
                )}
                
                {/* Story content */}
                <div className="space-y-4">
                  <h3 className="text-xl font-heading font-semibold text-concrete-900 dark:text-white line-clamp-2">
                    {topStory.title}
                  </h3>
                  <p className="text-concrete-600 dark:text-concrete-400 line-clamp-3">
                    {language.code === 'th' ? topStory.summary : topStory.summary_en}
                  </p>
                  
                  {/* Popularity score with visual indicator */}
                  <div className="flex items-center gap-3 pt-4 border-t border-concrete-200 dark:border-void-800">
                    <div className="flex-1 bg-concrete-200 dark:bg-void-800 h-1 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-accent-500 to-thai-400 rounded-full transition-all duration-1000"
                        style={{ width: `${topStory.popularity_score}%` }}
                      />
                    </div>
                    <span className="font-mono text-sm font-medium text-concrete-900 dark:text-white">
                      {Math.round(topStory.popularity_score_precise || topStory.popularity_score)}
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
function NewsGrid({ onViewDetails }: { onViewDetails: (story: NewsItem) => void }) {
  const { filteredNews } = useNewsStore()
  const { language } = useUIStore()
  
  if (filteredNews.length === 0) {
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
          {filteredNews.map((story, index) => (
            <NewsCard 
              key={story.video_id} 
              story={story} 
              index={index} 
              onViewDetails={onViewDetails}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

// Individual news card with minimalist design
function NewsCard({ story, index, onViewDetails }: { story: any, index: number, onViewDetails: (story: any) => void }) {
  const { language } = useUIStore()
  const [internalViews, setInternalViews] = useState(0)
  const isTop3 = story.rank <= 3

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
      className={`news-card p-6 relative overflow-hidden cursor-pointer ${isTop3 ? 'ring-2 ring-accent-500/20' : ''}`}
      onClick={() => onViewDetails(story)}
    >
      {/* Top 3 indicator */}
      {isTop3 && (
        <div className="absolute top-0 right-0 bg-accent-500 text-white px-3 py-1 text-xs font-mono font-medium">
          #{story.rank}
        </div>
      )}
      
      {/* AI Image */}
      {story.ai_image_url && (
        <div className="image-reveal mb-6 -mx-6 -mt-6">
          <img 
            src={story.ai_image_url}
            alt={story.title}
            className="w-full h-48 object-cover"
          />
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
                style={{ width: `${Math.min(story.popularity_score, 100)}%` }}
              />
            </div>
            <span className="font-mono text-sm font-medium text-concrete-900 dark:text-white">
              {story.popularity_score_precise ? story.popularity_score_precise.toFixed(1) : Math.round(story.popularity_score)}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}

// Main page component  
export default function HomePage() {
  const { news, loading, error, fetchNews } = useNewsStore()
  const { developerMode } = useUIStore()
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null)

  useEffect(() => {
    fetchNews()
  }, [fetchNews])

  if (loading) {
    return (
      <Layout showFilters={false}>
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-void-950">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-concrete-600 dark:text-concrete-400 font-mono text-sm tracking-wide">
              Loading trending stories...
            </p>
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
          
          {/* Hero Section */}
          <HeroSection onViewDetails={setSelectedNews} />
          
          {/* News Grid */}
          {news.length > 0 && <NewsGrid onViewDetails={setSelectedNews} />}

          {/* News Detail Modal */}
          <NewsDetailModal
            news={selectedNews}
            isOpen={!!selectedNews}
            onClose={() => setSelectedNews(null)}
          />
        </div>
      </ErrorBoundary>
    </Layout>
  )
}