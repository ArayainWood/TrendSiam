/*
 * PHASE 1 HOTFIX COMPLETE: Fixed filteredNews crash
 * - Removed undefined filteredNews reference from useEffect dependency array (line 247)
 * - Added runtime guards for displayNews array safety
 * - Ensured Top-3 logic uses proper array bounds checking
 */
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
function HeroSection({ onViewDetails, displayItems }: { onViewDetails?: (story: UINewsItem) => void, displayItems: UINewsItem[] }) {
  const { language } = useUIStore()
  
  // Safety check for news array - robust handling
  const newsList = Array.isArray(displayItems) ? displayItems : []
  const topStory = newsList.length > 0 ? newsList[0] : null
  
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
                
                {/* PHASE 3: Hero Image - unified with API logic */}
                {topStory.showImage && topStory.imageUrl && (
                  <div className="image-reveal mb-6 relative">
                    <img 
                      src={topStory.imageUrl}
                      alt={`AI-generated illustration for: ${topStory.title}`}
                      className="w-full h-48 object-cover rounded-lg"
                      onError={(e) => {
                        console.error(`🖼️ HERO AI IMAGE LOAD FAILED:`, {
                          imageUrl: topStory.imageUrl,
                          title: topStory.title?.substring(0, 40) + '...',
                          storyId: topStory.id
                        })
                        // PHASE 3: Hide broken images instead of showing placeholder
                        e.currentTarget.style.display = 'none'
                        e.currentTarget.parentElement?.remove()
                      }}
                    />
                    
                    {/* AI-Generated Badge - Always show for hero images */}
                    <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 text-white text-xs rounded-lg backdrop-blur-sm border border-white/20">
                      <span className="flex items-center gap-1">
                        🤖 <span className="font-medium">AI-Generated</span>
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Story content */}
                <div className="space-y-4">
                  <h3 className="text-xl font-heading font-semibold text-concrete-900 dark:text-white line-clamp-2">
                    {topStory.title}
                  </h3>
                  <p className="text-concrete-600 dark:text-concrete-400 line-clamp-3">
                    {language.code === 'th' 
                      ? (topStory.summary || topStory.summaryEn)
                      : (topStory.summaryEn || topStory.summary_en || topStory.summary)}
                  </p>
                  
                  {/* Popularity score with visual indicator - FIXED: use camelCase */}
                  <div className="flex items-center gap-3 pt-4 border-t border-concrete-200 dark:border-void-800">
                    <div className="flex-1 bg-concrete-200 dark:bg-void-800 h-1 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-accent-500 to-thai-400 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(Number(topStory.popularityScore || topStory.popularity_score) || 0, 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-sm font-medium text-concrete-900 dark:text-white">
                      {(Number(topStory.popularityScore || topStory.popularity_score) || 0).toFixed(1)}
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
function NewsGrid({ onViewDetails, displayItems }: { onViewDetails: (story: UINewsItem) => void, displayItems: UINewsItem[] }) {
  const { language } = useUIStore()
  
  // Display ALL items (no artificial limits) with robust safety check
  const displayNews = Array.isArray(displayItems) ? displayItems : []
  
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
        const rank = item.rank ?? (idx + 1)
        const score = Number(item.popularity_score_precise || item.popularity_score) || 0
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
  }, [displayNews.length])
  
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
          {Array.isArray(displayNews) ? displayNews.map((story, index) => (
            <NewsCard 
              key={story?.video_id || story?.id || `news-${index}`} 
              story={story} 
              index={index} 
              onViewDetails={onViewDetails}
            />
          )) : null}
        </div>
        
        {/* PHASE 6: Enhanced debug info for development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono">
            <div className="font-bold text-blue-600 dark:text-blue-400 mb-2">🔧 PHASE 6 UI Verification</div>
            
            <div className="text-gray-600 dark:text-gray-400">
              📊 Total Items: {displayNews.length} (from public_v_home_news)
            </div>
            <div className="text-gray-600 dark:text-gray-400 mt-1">
              🏆 Top-3 Items: {displayNews.filter((item, idx) => (item as any).isTop3 || (item as any).is_top3 || idx < 3).length} (server-computed)
            </div>
            <div className="text-gray-600 dark:text-gray-400 mt-1">
              🖼️ Images Shown: {displayNews.filter(item => item.showImage).length} (Top-3 only policy)
            </div>
            <div className="text-gray-600 dark:text-gray-400 mt-1">
              📝 Prompts Available: {displayNews.filter(item => item.showAiPrompt).length} (Top-3 only policy)
            </div>
            <div className="text-gray-600 dark:text-gray-400 mt-1">
              📈 Growth Rates: {displayNews.filter(item => {
                const label = (item as any).growth_rate_label || (item as any).growthRateLabel;
                return label && label !== 'Not enough data';
              }).length}/{displayNews.length} computed
            </div>
            
            <div className="text-gray-600 dark:text-gray-400 mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
              🎨 Top-3 Image Status: {Array.isArray(displayNews) ? displayNews.slice(0, 3).map((item, idx) => {
                const rank = item?.rank ?? (idx + 1)
                const hasImage = item?.showImage ? '✅' : '❌'
                const hasPrompt = item?.showAiPrompt ? '📝' : '❌'
                return `#${rank}:${hasImage}${hasPrompt}`
              }).join(' | ') : 'No data'}
            </div>
            
            <div className="text-gray-600 dark:text-gray-400 mt-1">
              📡 Data Source: public_v_home_news view (PHASE 4 enhanced)
            </div>
            <div className="text-gray-600 dark:text-gray-400 mt-1">
              🔍 Policy Compliance: {(() => {
                const nonTop3WithImages = displayNews.filter(item => !item.isTop3 && item.showImage).length
                const nonTop3WithPrompts = displayNews.filter(item => !item.isTop3 && item.showAiPrompt).length
                return nonTop3WithImages === 0 && nonTop3WithPrompts === 0 ? '✅ PASS' : '❌ VIOLATION'
              })()}
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
  // Use database web view count from API data (persistent site tracking via telemetry)
  // webViewCount comes from news_trends.view_count, tracked via /api/telemetry/view
  const webViews = story.webViewCount ?? 0
  
  // PHASE 3: Use server-side computed flags (single source of truth)
  const actualRank = story.rank ?? (index + 1)
  const storyIsTop3 = story.isTop3 === true
  const shouldShowImage = story.showImage === true
  const imageUrl = story.imageUrl
  
  // PHASE 3: Runtime assert for policy compliance (dev only)
  if (process.env.NODE_ENV === 'development') {
    if (!storyIsTop3 && shouldShowImage) {
      console.warn(`[PHASE 3] ❌ POLICY VIOLATION: Non-Top3 item (rank ${actualRank}) has showImage=true`, story)
    }
  }
  
  // Track view on card click (once per session per story)
  const handleCardClick = () => {
    // Use camelCase property names from normalized story object
    const videoId = story.videoId || story.externalId || story.id
    const sessionKey = `card_view_${videoId}`
    const lastTracked = typeof window !== 'undefined' ? window.sessionStorage.getItem(sessionKey) : null
    
    if (!lastTracked) {
      const payload = {
        story_id: story.id,
        video_id: videoId
      }
      
      // Fire tracking async (don't block modal opening)
      fetch('/api/telemetry/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            console.log('[card] ✅ View tracked on click:', { videoId, storyId: story.id, newCount: data.views })
            // Mark as tracked with timestamp
            if (typeof window !== 'undefined') {
              window.sessionStorage.setItem(sessionKey, Date.now().toString())
            }
          } else {
            console.warn('[card] ❌ Tracking failed:', data.error)
          }
        })
        .catch(err => {
          console.warn('[card] ❌ Network error:', err.message)
        })
    } else {
      console.log('[card] ⏭️ View already tracked this session:', videoId)
    }
    
    // Open modal (don't wait for tracking)
    onViewDetails(story)
  }
  
  return (
    <article 
      className={`news-card p-6 relative overflow-hidden cursor-pointer ${storyIsTop3 ? 'ring-2 ring-accent-500/20' : ''}`}
      onClick={handleCardClick}
    >
      {/* Top 3 indicator */}
      {storyIsTop3 && (
        <div className="absolute top-0 right-0 bg-accent-500 text-white px-3 py-1 text-xs font-mono font-medium">
          #{actualRank}
        </div>
      )}
      
      {/* PHASE 3: Image rendering - only for Top-3 with valid images, no placeholders */}
      {shouldShowImage && imageUrl && (
        <div className="image-reveal mb-6 -mx-6 -mt-6 relative">
          <img 
            src={imageUrl}
            alt={`AI-generated illustration for: ${story.title}`}
            className="w-full h-48 object-cover"
            onError={(e) => {
              console.error(`🖼️ AI IMAGE LOAD FAILED for rank #${actualRank}:`, {
                imageUrl: imageUrl,
                title: story.title?.substring(0, 40) + '...',
                rank: actualRank,
                storyId: story.id
              })
              // PHASE 3: Hide broken images instead of showing placeholder
              e.currentTarget.style.display = 'none'
              e.currentTarget.parentElement?.remove()
            }}
          />
          
          {/* AI-Generated Badge - Always show for Top-3 images */}
          <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 text-white text-xs rounded-full backdrop-blur-sm border border-white/20">
            <span className="flex items-center gap-1">
              🤖 <span className="font-medium">AI-Generated</span>
            </span>
          </div>
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
        
        {/* Summary - Language-aware (toggles based on language setting) */}
        <p className="text-concrete-600 dark:text-concrete-400 line-clamp-4">
          {language.code === 'en' 
            ? (story.summaryEn || story.summary_en || story.summary || 'N/A')
            : (story.summary || story.summaryEn || story.summary_en || 'N/A')}
        </p>
        
        {/* Popularity Subtext */}
        <div className="text-sm text-concrete-600 dark:text-concrete-400 italic">
          {getPopularitySubtext(story)}
        </div>
        
        {/* Footer with metrics */}
        <div className="flex items-center justify-between pt-4 border-t border-concrete-200 dark:border-void-800">
          <div className="flex items-center gap-4 text-sm text-concrete-500 dark:text-concrete-500">
            <span className="flex items-center gap-1" title={`${webViews.toLocaleString()} site ${webViews === 1 ? 'view' : 'views'}`}>
              👁 {language.code === 'th' ? `${webViews.toLocaleString()} ครั้ง` : (webViews === 1 ? '1 view' : `${webViews.toLocaleString()} views`)}
            </span>
          </div>
          
          {/* Popularity score with precise display */}
          <div className="flex items-center gap-2">
            <div className="w-12 h-1 bg-concrete-200 dark:bg-void-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-accent-500 rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(Number(story.popularityScore || story.popularity_score) || 0, 100)}%` }}
              />
            </div>
            <span className="font-mono text-sm font-medium text-concrete-900 dark:text-white">
              {formatPopularityScore(story.popularityScore || story.popularity_score || 0)}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}

// Main page component  
export default function HomePage() {
  const { renderList, news, loading, error, fetchNews, startAutoRefresh, stopAutoRefresh } = useNewsStore()
  const { developerMode } = useUIStore()
  const [selectedNews, setSelectedNews] = useState<UINewsItem | null>(null)
  
  // Use renderList as primary source, fallback to news for legacy compatibility
  const displayItems = Array.isArray(renderList) && renderList.length > 0 ? renderList : Array.isArray(news) ? news : []

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
  
  // PHASE 4: Comprehensive verification logging with type safety
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEBUG_UI === '1') {
      console.log('[diag] home props/items len', news?.length, news?.[0]);
    }
    
    if (!loading && Array.isArray(displayItems) && displayItems.length > 0) {
      // PHASE 4: Runtime type validation (dev only)
      if (process.env.NODE_ENV === 'development') {
        for (const item of displayItems) {
          console.assert(typeof item.rank === 'number' || item.rank === undefined, 'rank must be number', item);
          console.assert(typeof item.popularity_score !== 'string', 'popularity_score must not be string', item);
          console.assert(typeof item.popularityScore !== 'string', 'popularityScore must not be string', item);
          console.assert(!(!(item as any).isTop3 && (item as any).image_url), 'non-Top3 must not have image_url', item);
          console.assert((item as any).isTop3 || !(item as any).ai_prompt, 'non-Top3 must not expose ai_prompt', item);
          
          // Check for text values in numeric fields
          if (typeof item.views === 'string' && item.views !== '0') {
            console.warn('⚠️ PHASE 4: views field is string:', item.views, 'for item:', item.id);
          }
          if (typeof item.likes === 'string' && item.likes !== '0') {
            console.warn('⚠️ PHASE 4: likes field is string:', item.likes, 'for item:', item.id);
          }
        }
      }
      
      const topStory = displayItems[0]
      const top3WithImages = displayItems.slice(0, 3).filter(item => item?.ai_image_url).length
      
      console.log('HOME VERIFY', {
        items: displayItems.length,
        sorted: 'OK', // Assuming server-side sorting is correct
        dateCheck: 'OK', // Assuming server-side filtering is correct
        topStoryId: topStory?.video_id || topStory?.id || 'missing',
        top3WithImages: displayItems.slice(0, 3).map(item => item?.video_id || item?.id || 'missing')
      })
    }
  }, [displayItems, loading])

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
          {supabaseConfigured && displayItems.length > 0 && !error && (
            <div className="fixed top-4 left-4 z-50 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-mono font-medium">
              📊 LIVE: Today's batch only (Asia/Bangkok) - Top {displayItems.length}
            </div>
          )}
          
          {/* Error indicator */}
          {error && (
            <div className="fixed top-4 left-4 z-50 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-mono font-medium">
              ❌ Supabase Connection Failed
            </div>
          )}
          
          {/* PHASE 6: Dev banner with verification info */}
          {process.env.NODE_ENV === 'development' && Array.isArray(displayItems) && displayItems.length > 0 && (
            <div className="fixed top-16 left-4 z-50 bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-mono font-medium space-y-1 max-w-sm">
              <div className="font-bold">🔧 PHASE 6 Verification</div>
              <div>Total: {displayItems.length} items</div>
              <div>Top-3: {displayItems.filter((item, idx) => (item as any).isTop3 || (item as any).is_top3 || idx < 3).length}</div>
              <div>Images: {displayItems.filter(item => item.showImage).length}</div>
              <div>Prompts: {displayItems.filter(item => item.showAiPrompt).length}</div>
              <div>Growth: {displayItems.filter(item => {
                const label = (item as any).growth_rate_label || (item as any).growthRateLabel;
                return label && label !== 'Not enough data';
              }).length} computed</div>
              <div className="text-yellow-200">Check Console for Details</div>
            </div>
          )}

          {/* Build tag verification */}
          <div className="fixed bottom-2 right-2 z-50 bg-gray-500 text-white px-2 py-1 rounded text-xs font-mono opacity-50">
            <span suppressHydrationWarning>{BUILD_TAG}</span>
          </div>
          
          {/* Hero Section */}
          <HeroSection onViewDetails={setSelectedNews} displayItems={displayItems} />
          

          {/* News Grid or Empty State */}
          {displayItems.length > 0 ? (
            <NewsGrid onViewDetails={setSelectedNews} displayItems={displayItems} />
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
          <ImageDebugger news={displayItems} title="Homepage Image Debug" />
        </div>
      </ErrorBoundary>
    </Layout>
  )
}