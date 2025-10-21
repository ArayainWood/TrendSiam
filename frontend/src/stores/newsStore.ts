import { create } from 'zustand'
import { FilterState } from '../types'
import type { UINewsItem } from '../lib/normalizeNewsItem'

interface NewsStore {
  // State
  news: UINewsItem[]
  filteredNews: UINewsItem[]
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
  news: [],
  filteredNews: [],
  loading: false,
  error: null,
  lastUpdated: null,
  lastKnownTimestamp: null,

  // Fetch news from canonical Home API (same source as Weekly Report)
  fetchNews: async () => {
    try {
      set({ loading: true, error: null })
      
      console.log('🔄 Fetching news from canonical Home API (same source as Weekly Report)...')
      
      // Use the new Home API that uses the same canonical source as Weekly Report
      const response = await fetch('/api/home', {
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
      
      console.log(`[newsStore] ✅ Home API response: source=${apiSource}, origin=${apiData.origin}, items=${apiData.data?.length || 0}`);
      
      if (!apiData.success || !apiData.data) {
        throw new Error(apiData.error || 'Invalid Home API response');
      }

      const newsItems = apiData.data as UINewsItem[];
      
      console.log(`✅ Successfully loaded ${newsItems.length} news items from canonical source (${apiSource})`);
      
      // All items are already properly typed and mapped from the API
      const validItems = newsItems.filter(item => item && item.id && item.title);
      if (validItems.length !== newsItems.length) {
        console.warn(`⚠️ ${newsItems.length - validItems.length} items were invalid`);
      }
      
      if (newsItems.length > 0) {
        console.log(`📊 Score range: ${Math.min(...newsItems.map(n => n.popularityScore))} - ${Math.max(...newsItems.map(n => n.popularityScore))}`);
        
        // Log image coverage using canonical fields
        const withAIImages = newsItems.filter(n => n.isAIImage);
        const withRealImages = newsItems.filter(n => n.displayImageUrl && n.displayImageUrl !== '/placeholder-image.svg');
        console.log(`🎨 AI images: ${withAIImages.length}/${newsItems.length} (${Math.round(withAIImages.length/newsItems.length*100)}%)`);
        console.log(`🖼️ Real images: ${withRealImages.length}/${newsItems.length} (${Math.round(withRealImages.length/newsItems.length*100)}%)`);
        console.log(`🔍 CANONICAL SOURCE VERIFICATION: Home API using mapped data from ${apiData.origin}`);
      }
      
      set({
        news: newsItems,
        filteredNews: newsItems,
        loading: false,
        error: null,
        lastUpdated: new Date()
      })
    } catch (error: any) {
      console.error('❌ Failed to fetch news from canonical Home API:', error)
      set({
        news: [],
        filteredNews: [],
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
    
    set({ 
      news,
      filteredNews: news,
      lastUpdated: new Date()
    })
  },

  updateFilters: (filters: Partial<FilterState>) => {
    const { news } = get()
    
    // Apply filters to the news
    let filteredNews = news
    
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
    
    set({ filteredNews })
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
        await fetchNews()
      }
    }, 30000) // Check every 30 seconds
    
    // Store interval ID in a global way
    ;(window as any).__newsRefreshInterval = interval
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
    const { filteredNews } = get()
    return filteredNews.filter(item => item.displayImageUrl && item.displayImageUrl !== '/placeholder-image.svg')
  },

  topRanked: () => {
    const { filteredNews } = get()
    return [...filteredNews].sort((a, b) => {
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