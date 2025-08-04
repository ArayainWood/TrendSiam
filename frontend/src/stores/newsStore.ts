import { create } from 'zustand'
import { NewsItem, FilterState } from '../types'
import { newsApi } from '../lib/api'

interface NewsStore {
  // State
  news: NewsItem[]
  filteredNews: NewsItem[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  
  // Actions
  fetchNews: () => Promise<void>
  setNews: (news: NewsItem[]) => void
  filterNews: (filters: FilterState) => void
  getTopStories: (count?: number) => NewsItem[]
  clearError: () => void
  refreshNews: () => Promise<void>
}

export const useNewsStore = create<NewsStore>((set, get) => ({
  // Initial state
  news: [],
  filteredNews: [],
  loading: false,
  error: null,
  lastUpdated: null,

  // Fetch news from API
  fetchNews: async () => {
    try {
      set({ loading: true, error: null })
      
      const response = await newsApi.getNews()
      
      if (response.success && response.data) {
        const sortedNews = response.data.sort((a, b) => 
          (b.popularity_score_precise || b.popularity_score) - (a.popularity_score_precise || a.popularity_score)
        )
        
        // Assign global rank based on sorted position
        const rankedNews = sortedNews.map((item, index) => ({
          ...item,
          rank: index + 1
        }))
        
        set({
          news: rankedNews,
          filteredNews: rankedNews,
          loading: false,
          lastUpdated: new Date(),
        })
      } else {
        throw new Error(response.message || 'Failed to fetch news')
      }
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      })
    }
  },

  // Set news directly
  setNews: (news) => {
    const sortedNews = [...news].sort((a, b) => 
      (b.popularity_score_precise || b.popularity_score) - (a.popularity_score_precise || a.popularity_score)
    )
    
    // Assign global rank based on sorted position
    const rankedNews = sortedNews.map((item, index) => ({
      ...item,
      rank: index + 1
    }))
    
    set({ 
      news: rankedNews, 
      filteredNews: rankedNews,
      lastUpdated: new Date(),
    })
  },

  // Filter news based on criteria
  filterNews: (filters) => {
    const { news } = get()
    
    let filtered = [...news]

    // Platform filter
    if (filters.platform && filters.platform !== 'all') {
      filtered = filtered.filter(item => 
        item.channel.toLowerCase().includes(filters.platform.toLowerCase())
      )
    }

    // Category filter
    if (filters.category && filters.category !== 'all') {
      filtered = filtered.filter(item => 
        item.auto_category === filters.category
      )
    }

    // Date filter
    if (filters.date && filters.date !== 'all') {
      const now = new Date()
      const filterDate = new Date(now)
      
      switch (filters.date) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0)
          break
        case 'yesterday':
          filterDate.setDate(filterDate.getDate() - 1)
          filterDate.setHours(0, 0, 0, 0)
          break
        case 'week':
          filterDate.setDate(filterDate.getDate() - 7)
          break
        case 'month':
          filterDate.setMonth(filterDate.getMonth() - 1)
          break
      }
      
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.published_date)
        return itemDate >= filterDate
      })
    }

    // Search query filter
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase().trim()
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query) ||
        item.summary_en.toLowerCase().includes(query) ||
        item.channel.toLowerCase().includes(query) ||
        item.auto_category.toLowerCase().includes(query)
      )
    }

    // Note: Filtered news maintains original global rank from sorted news
    // This ensures consistent ranking across all views
    set({ filteredNews: filtered })
  },

  // Get top stories
  getTopStories: (count = 3) => {
    const { filteredNews } = get()
    return filteredNews.slice(0, count)
  },

  // Clear error
  clearError: () => set({ error: null }),

  // Refresh news
  refreshNews: async () => {
    await get().fetchNews()
  },
}))