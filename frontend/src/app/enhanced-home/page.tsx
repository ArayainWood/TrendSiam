'use client'

import { useEffect, useState } from 'react'
import { useNewsStore } from '../../stores/newsStore'
import { useUIStore } from '../../stores/uiStore'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { ErrorBoundary } from '../../components/ui/ErrorBoundary'
import { EnhancedNewsDetailModal } from '../../components/news/EnhancedNewsDetailModal'
import { EnhancedNewsCard } from '../../components/news/EnhancedNewsCard'
import { Layout } from '../../components/layout/Layout'
import type { UINewsItem } from '../../lib/normalizeNewsItem'
import { USE_LEGACY_MODAL_LAYOUT } from '../../lib/featureFlags'

export default function EnhancedHomePage() {
  const { news, loading, error, fetchNews } = useNewsStore()
  const { language } = useUIStore()
  const [selectedNews, setSelectedNews] = useState<UINewsItem | null>(null)

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
          
          {/* Feature flag indicator */}
          {USE_LEGACY_MODAL_LAYOUT && (
            <div className="fixed top-4 right-4 z-50 bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-mono font-medium">
              ✨ Enhanced UI
            </div>
          )}

          {/* Hero Section */}
          <section className="min-h-screen flex items-center justify-center bg-white dark:bg-void-950 relative overflow-hidden">
            <div className="container-full relative z-10">
              <div className="grid lg:grid-cols-2 gap-16 items-center">
                
                {/* Hero text */}
                <div className="space-y-8 animate-fade-in">
                  <div className="space-y-4">
                    <p className="font-mono text-sm tracking-[0.2em] uppercase text-concrete-600 dark:text-concrete-400">
                      Thailand • Trending • Enhanced
                    </p>
                    <h1 className="text-6xl md:text-7xl font-heading font-bold text-concrete-900 dark:text-white leading-none">
                      Trend<br />
                      <span className="text-accent-500">Siam</span>
                    </h1>
                    <p className="text-xl text-concrete-600 dark:text-concrete-400 max-w-lg leading-relaxed">
                      {language.code === 'th' 
                        ? 'ติดตามข่าวและเทรนด์ที่กำลังมาแรงในประเทศไทย พร้อม UI ที่ปรับปรุงใหม่'
                        : 'Stay ahead with Thailand\'s trending news and insights, now with enhanced UI sections and better data handling.'
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
                        {news.filter(item => item.isAIImage).length}
                      </div>
                      <div className="text-sm text-concrete-500 dark:text-concrete-500 uppercase tracking-wide">
                        AI Images
                      </div>
                    </div>
                    <div>
                      <div className="text-3xl font-heading font-bold text-concrete-900 dark:text-white">
                        {news.filter(item => item.keywords.length > 0).length}
                      </div>
                      <div className="text-sm text-concrete-500 dark:text-concrete-500 uppercase tracking-wide">
                        With Keywords
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Featured story */}
                {news[0] && (
                  <div className="animate-slide-right">
                    <div 
                      className="news-card p-8 transform hover:scale-[1.02] transition-all duration-500 cursor-pointer hover:shadow-xl hover:border-accent-500/30 group"
                      onClick={() => news[0] && setSelectedNews(news[0])}
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
                      
                      {/* Image */}
                      <div className="image-reveal mb-6 relative">
                        <img 
                          src={news[0].displayImageUrl}
                          alt={`Illustration for: ${news[0].title}`}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        
                        {/* AI-Generated Badge */}
                        {news[0].isAIImage && (
                          <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 text-white text-xs rounded-lg backdrop-blur-sm border border-white/20">
                            <span className="flex items-center gap-1">
                              🤖 <span className="font-medium">AI-Generated</span>
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Story content */}
                      <div className="space-y-4">
                        <h3 className="text-xl font-heading font-semibold text-concrete-900 dark:text-white line-clamp-2">
                          {news[0].title}
                        </h3>
                        <p className="text-concrete-600 dark:text-concrete-400 line-clamp-3">
                          {news[0].summary}
                        </p>
                        
                        {/* Popularity score with visual indicator */}
                        <div className="flex items-center gap-3 pt-4 border-t border-concrete-200 dark:border-void-800">
                          <div className="flex-1 bg-concrete-200 dark:bg-void-800 h-1 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-accent-500 to-thai-400 rounded-full transition-all duration-1000"
                              style={{ width: `${Math.min(news[0].popularityScore, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-sm font-medium text-concrete-900 dark:text-white">
                            {news[0].popularityScore.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* News Grid */}
          {news.length > 0 ? (
            <section className="section-spacing bg-concrete-50 dark:bg-void-900">
              <div className="container-full">
                <div className="mb-16 text-center">
                  <h2 className="text-5xl md:text-6xl font-heading font-bold text-concrete-900 dark:text-white mb-4">
                    Latest Stories
                  </h2>
                  <p className="text-xl text-concrete-600 dark:text-concrete-400 max-w-2xl mx-auto">
                    {language.code === 'th' 
                      ? 'ข่าวสารและเทรนด์ล่าสุดที่คัดสรรและวิเคราะห์โดย AI พร้อมข้อมูลครบถ้วน'
                      : 'Curated trending stories with enhanced analysis, complete metrics, and AI insights'
                    }
                  </p>
                </div>
                
                {/* Enhanced News Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {news.map((story, index) => (
                    <EnhancedNewsCard 
                      key={story.id || `news-${index}`} 
                      news={story} 
                      index={index} 
                      onOpenModal={setSelectedNews}
                    />
                  ))}
                </div>
                
                {/* Debug info for development */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono">
                    <div className="text-gray-600 dark:text-gray-400">
                      📊 Enhanced Homepage: {news.length} normalized UINewsItems
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 mt-2">
                      🎨 AI Images: {news.filter(item => item.isAIImage).length}/{news.length}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 mt-1">
                      🏷️ Keywords: {news.filter(item => item.keywords.length > 0).length}/{news.length} items have keywords
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 mt-1">
                      💭 AI Opinions: {news.filter(item => item.aiOpinion).length}/{news.length} items have AI opinions
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 mt-1">
                      📈 Growth Rates: {news.filter(item => item.growthRate !== null).length}/{news.length} items have growth data
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 mt-1">
                      🔧 Enhanced UI Sections: {USE_LEGACY_MODAL_LAYOUT ? 'Enabled' : 'Disabled'}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 mt-2">
                      <a href="/api/home/fields" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                        View Field Diagnostics
                      </a>
                      {' | '}
                      <a href="/api/home/diagnostics" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                        View Data Diagnostics
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </section>
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
                      onClick={() => fetchNews()}
                      className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-accent-600 hover:bg-accent-700 transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh Stories
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

          {/* Enhanced News Detail Modal */}
          <EnhancedNewsDetailModal
            news={selectedNews}
            isOpen={!!selectedNews}
            onClose={() => setSelectedNews(null)}
          />
        </div>
      </ErrorBoundary>
    </Layout>
  )
}
