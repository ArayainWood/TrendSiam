import { create } from 'zustand'
import { FilterState } from '../types'
import type { UINewsItem } from '../lib/normalizeNewsItem'
import { normalizeNewsItem } from '../lib/normalizeNewsItem'
import { normalizeHomePayload, filterLatestDay, type HomeNewsItem } from '../types/HomeNewsItem'

interface NewsStore {
  // State
  all: UINewsItem[]                    // All items from API
  latestDay: UINewsItem[]              // Items from the latest day (timezone-safe)
  renderList: UINewsItem[]             // Safe list for rendering (with fallback chain)
  news: UINewsItem[]                   // Legacy compatibility
  filteredNews: UINewsItem[]           // Legacy compatibility
  top3Ids: string[]                    // Top-3 IDs from API
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  lastKnownTimestamp: string | null

  // Actions
  fetchNews: () => Promise<void>
  setNews: (news: UINewsItem[]) => void
  updateFilters: (filters: Partial<FilterState>) => void
  checkForUpdates: () => Promise<boolean>
  startAutoRefresh: () => void
  stopAutoRefresh: () => void

  // Selectors
  withImages: () => UINewsItem[]
  topRanked: () => UINewsItem[]
}

export const useNewsStore = create<NewsStore>((set, get) => ({
  // Initial state
  all: [],
  latestDay: [],
  renderList: [],                      // Safe list for rendering
  news: [],                            // Legacy compatibility
  filteredNews: [],                    // Legacy compatibility
  top3Ids: [],
  loading: false,
  error: null,
  lastUpdated: null,
  lastKnownTimestamp: null,

  // Fetch news from canonical Home API (same source as Weekly Report)
  fetchNews: async () => {
    try {
      set({ loading: true, error: null })
      
      console.log('🔄 Fetching news from canonical Home API (same source as Weekly Report)...')
      
      // Use the new Home API with cache busting for fresh data
      const cacheBuster = Date.now();
      const response = await fetch(`/api/home?ts=${cacheBuster}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-store'
        }
      });

      if (!response.ok) {
        throw new Error(`Home API returned ${response.status}: ${response.statusText}`);
      }

      const apiData = await response.json();
      const apiSource = response.headers.get('X-TS-Source') || apiData.source || 'unknown';
      
      console.log(`[newsStore] ✅ Home API response: source=${apiSource}, items=${apiData.data?.length || 0}`);
      
      // API now returns clean camelCase UINewsItem format - use directly
      const newsItems: UINewsItem[] = Array.isArray(apiData.data) ? apiData.data : [];
      const top3Ids: string[] = Array.isArray(apiData.top3Ids) ? apiData.top3Ids : [];
      
      console.log(`[newsStore] Direct API usage: ${newsItems.length} items, ${top3Ids.length} top3`);
      
      // Validate first item structure for debugging
      if (newsItems.length > 0) {
        const firstItem = newsItems[0];
        if (firstItem) {
          console.log(`[newsStore] First item validation:`, {
            id: firstItem.id,
            title: firstItem.title?.substring(0, 30),
            isTop3: firstItem.isTop3,
            showImage: firstItem.showImage,
            showAiPrompt: firstItem.showAiPrompt,
            showImage_type: typeof firstItem.showImage,
            showAiPrompt_type: typeof firstItem.showAiPrompt
          });
        }
      }
      
      
      const validItems = newsItems.filter(item => item && item.id && item.title);
      
      console.log(`✅ Using API data directly: ${validItems.length}/${newsItems.length} valid items`);
      
      // CRITICAL: Use all valid items directly (no day filtering needed)
      const renderList = validItems;
      
      console.log(`🔄 Direct usage: ${renderList.length} items ready for rendering`);
      
      if (renderList.length === 0 && validItems.length > 0) {
        console.error('🚨 CRITICAL: renderList is empty but validItems has data! This should not happen.');
        console.error('🔍 Debug info:', {
          apiDataCount: newsItems.length,
          validCount: validItems.length
        });
      }
      
      if (newsItems.length > 0) {
        console.log(`📊 Score range: ${Math.min(...newsItems.map(n => n.popularityScore))} - ${Math.max(...newsItems.map(n => n.popularityScore))}`);
        
        // Log image coverage using canonical fields
        const withAIImages = newsItems.filter(n => n.isAIImage);
        const withRealImages = newsItems.filter(n => n.displayImageUrl && n.displayImageUrl !== '/placeholder-image.svg');
        console.log(`🎨 AI images: ${withAIImages.length}/${newsItems.length} (${Math.round(withAIImages.length/newsItems.length*100)}%)`);
        console.log(`🖼️ Real images: ${withRealImages.length}/${newsItems.length} (${Math.round(withRealImages.length/newsItems.length*100)}%)`);
        console.log(`🔍 CANONICAL SOURCE VERIFICATION: Home API using mapped data from ${apiData.origin || 'unknown'}`);
      }
      
      // Log final counts for diagnostics
      console.log(`📊 Final counts: fetched=${newsItems.length}, renderList=${renderList.length}, top3Ids=${top3Ids.length}`);
      
      // CRITICAL: Log if renderList is empty when we have data
      if (renderList.length === 0 && newsItems.length > 0) {
        console.error('🚨 CRITICAL ISSUE: renderList is empty but API returned data!');
        console.error('🔍 Diagnostic info:', {
          apiDataLength: newsItems.length,
          validItemsLength: validItems.length,
          sampleApiItem: newsItems[0]
        });
      }
      
      set({
        all: validItems,
        latestDay: renderList,               // Use renderList for latest day too
        renderList: renderList,              // Safe list with fallback
        news: renderList,                    // Legacy: use render list
        filteredNews: renderList,            // Legacy: use render list
        top3Ids: top3Ids,
        loading: false,
        error: null,
        lastUpdated: new Date()
      })
    } catch (error: any) {
      console.error('❌ Failed to fetch news from canonical Home API:', error)
      set({
        all: [],
        latestDay: [],
        renderList: [],
        news: [],
        filteredNews: [],
        top3Ids: [],
        loading: false,
        error: error.message || 'Failed to load news from canonical source',
        lastUpdated: new Date()
      })
    }
  },

  setNews: (news: UINewsItem[]) => {
    // Use server-provided order directly - no client re-sorting
    // Server already provides stable-sorted data with correct ranks
    console.log(`📊 setNews: Using ${news.length} canonical UINewsItems with server-side ranking`)
    
    if (news.length > 0) {
      console.log(`🏆 TOP 3 VERIFICATION:`)
      news.slice(0, 3).forEach((item, idx) => {
        const hasImage = (item.displayImageUrl && item.displayImageUrl !== '/placeholder-image.svg') ? '✅' : '❌'
        console.log(`   #${item.rank || idx + 1}: ${item.title.substring(0, 40)}... | Score: ${item.popularityScore.toFixed(2)} | Image: ${hasImage}`)
      })
    }
    
    // Apply latest-day filter to the provided news
    const latestDayNews = Array.isArray(news) ? news : [];
    const renderList = latestDayNews.length > 0 ? latestDayNews : news;
    
    set({ 
      all: news,
      latestDay: latestDayNews,
      renderList: renderList,
      news: renderList,
      filteredNews: renderList,
      lastUpdated: new Date()
    })
  },

  updateFilters: (filters: Partial<FilterState>) => {
    const { renderList } = get()
    
    // Apply filters to the render list (safe source with fallback)
    let filteredNews = Array.isArray(renderList) ? renderList : []
    
    if (filters.platform && filters.platform !== 'all') {
      filteredNews = filteredNews.filter(item => 
        item.platform?.toLowerCase() === filters.platform?.toLowerCase()
      )
    }
    
    if (filters.category && filters.category !== 'all') {
      filteredNews = filteredNews.filter(item => 
        item.category === filters.category
      )
    }
    
    set({ 
      filteredNews,
      news: filteredNews  // Legacy compatibility
    })
  },

  // SECTION F: Auto-refresh functionality
  checkForUpdates: async () => {
    const { lastKnownTimestamp } = get()
    
    try {
      // Check system_meta for news_last_updated via lightweight API
      const response = await fetch('/api/system-meta?key=news_last_updated')
      const data = await response.json()
      
      const currentTimestamp = data.value
      
      if (lastKnownTimestamp && currentTimestamp !== lastKnownTimestamp) {
        console.log('🔄 [SECTION F] News updates detected, refreshing...', {
          old: lastKnownTimestamp,
          new: currentTimestamp
        })
        set({ lastKnownTimestamp: currentTimestamp })
        return true // Updates available
      }
      
      if (!lastKnownTimestamp && currentTimestamp) {
        set({ lastKnownTimestamp: currentTimestamp })
        console.log('🔄 [SECTION F] Initial timestamp set:', currentTimestamp)
      }
      
      return false
    } catch (error) {
      console.error('[SECTION F] Failed to check for updates:', error)
      return false
    }
  },

  startAutoRefresh: () => {
    const { checkForUpdates, fetchNews } = get()
    
    const interval = setInterval(async () => {
      const hasUpdates = await checkForUpdates()
      if (hasUpdates) {
        console.log('🔄 [auto-refresh] Fresh data detected, refreshing news...')
        await fetchNews()
      }
    }, 10000) // Check every 10 seconds for faster updates
    
    // Store interval ID in a global way
    ;(window as any).__newsRefreshInterval = interval
    console.log('✅ [auto-refresh] Started with 10-second interval')
  },

  stopAutoRefresh: () => {
    const intervalId = (window as any).__newsRefreshInterval
    if (intervalId) {
      clearInterval(intervalId)
      delete (window as any).__newsRefreshInterval
    }
  },

  // Selectors
  withImages: () => {
    const { renderList } = get()
    const items = Array.isArray(renderList) ? renderList : []
    return items.filter(item => item.displayImageUrl && item.displayImageUrl !== '/placeholder-image.svg')
  },

  topRanked: () => {
    const { renderList } = get()
    const items = Array.isArray(renderList) ? renderList : []
    return [...items].sort((a, b) => {
      // Sort by popularity score DESC, then by updatedAt DESC, then by id for stable sort
      const scoreA = a.popularityScore
      const scoreB = b.popularityScore
      
      if (scoreB !== scoreA) return scoreB - scoreA
      
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      
      if (dateB !== dateA) return dateB - dateA
      
      return a.id.localeCompare(b.id)
    })
  }
}))