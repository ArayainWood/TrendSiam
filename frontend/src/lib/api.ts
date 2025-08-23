import axios from 'axios'
import { NewsItem, WeeklyReportData, APIResponse } from '../types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('❌ API Request Error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`)
    return response
  },
  (error) => {
    console.error('❌ API Response Error:', error.response?.status, error.message)
    return Promise.reject(error)
  }
)

// Mock data fallback (for development) - Empty since we'll load from JSON
const mockNewsData: NewsItem[] = []

// API Functions
export const newsApi = {
  // Get all news
  getNews: async (): Promise<APIResponse<NewsItem[]>> => {
    try {
      // Add timestamp to prevent caching issues
      const timestamp = Date.now()
      
      // Fetch directly from the JSON file in public/data directory
      const response = await fetch(`/data/thailand_trending_summary.json?ts=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`)
      }
      
      const data = await response.json()
      console.log(`✅ Loaded ${data.length} news items from /data/thailand_trending_summary.json (fresh data)`)
      
      // Debug log to show data freshness
      if (data.length > 0) {
        const latestItem = data[0]
        console.log(`🕒 Latest item timestamp: ${latestItem.published_date || 'Unknown'}`)
        console.log(`🎨 AI images available: ${data.filter((item: any) => item.ai_image_url).length}/${data.length}`)
      }
      
      return {
        success: true,
        data: data,
        message: `Loaded ${data.length} trending news items (fresh data)`,
      }
    } catch (error) {
      console.warn('⚠️ JSON file not available, trying fallback path...')
      
      // Fallback: try the old path in case backend hasn't updated yet
      try {
        const fallbackResponse = await fetch(`/thailand_trending_summary.json?ts=${Date.now()}`, {
          cache: 'no-store'
        })
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json()
          console.log(`⚠️ Using fallback path: ${fallbackData.length} items loaded`)
          return {
            success: true,
            data: fallbackData,
            message: `Loaded ${fallbackData.length} trending news items (fallback path)`,
          }
        }
      } catch (fallbackError) {
        console.warn('⚠️ Fallback path also failed')
      }
      
      // Final fallback to mock data for development
      return {
        success: true,
        data: mockNewsData,
        message: 'Using development mock data - run backend to generate fresh data',
      }
    }
  },

  // Get filtered news
  getFilteredNews: async (filters: {
    platform?: string
    category?: string
    date?: string
    limit?: number
  }): Promise<APIResponse<NewsItem[]>> => {
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.append(key, value.toString())
        }
      })

      const response = await api.get(`/api/news/filtered?${params}`)
      return {
        success: true,
        data: response.data,
      }
    } catch (error) {
      return newsApi.getNews() // Fallback to all news
    }
  },

  // Get top stories
  getTopStories: async (count: number = 3): Promise<APIResponse<NewsItem[]>> => {
    try {
      const response = await api.get(`/api/news/top?limit=${count}`)
      return {
        success: true,
        data: response.data,
      }
    } catch (error) {
      const allNews = await newsApi.getNews()
      return {
        success: true,
        data: allNews.data?.slice(0, count) || [],
      }
    }
  },

  // Increment internal view count for a news item
  incrementNewsView: async (newsId: string): Promise<APIResponse<{ views: number }>> => {
    try {
      // Check if already viewed in this session to prevent duplicates
      const sessionKey = `viewed_${newsId}`
      const alreadyViewed = sessionStorage.getItem(sessionKey)
      
      if (alreadyViewed) {
        // Return current views without incrementing
        const currentViewsKey = `views_${newsId}`
        const currentViews = parseInt(localStorage.getItem(currentViewsKey) || '0')
        return {
          success: true,
          data: { views: currentViews },
          message: 'Already viewed in this session'
        }
      }

      // In production: POST /api/news/:id/view
      console.log(`📊 Incrementing view count for news ID: ${newsId}`)
      
      // Mark as viewed in session
      sessionStorage.setItem(sessionKey, 'true')
      
      // Increment view count in localStorage (mock backend)
      const currentViewsKey = `views_${newsId}`
      const currentViews = parseInt(localStorage.getItem(currentViewsKey) || '0')
      const newViewCount = currentViews + 1
      localStorage.setItem(currentViewsKey, newViewCount.toString())
      
      console.log(`✅ View count incremented to ${newViewCount} for ${newsId}`)
      
      return {
        success: true,
        data: { views: newViewCount },
        message: `View tracked. Total internal views: ${newViewCount}`
      }
    } catch (error) {
      console.error('❌ Failed to increment view:', error)
      return {
        success: false,
        data: { views: 0 },
        message: 'Failed to increment view'
      }
    }
  },

  // Get internal view count for a news item
  getNewsViews: async (newsId: string): Promise<number> => {
    try {
      const currentViewsKey = `views_${newsId}`
      return parseInt(localStorage.getItem(currentViewsKey) || '0')
    } catch (error) {
      return 0
    }
  },

  // Get weekly report data
  getWeeklyReport: async (): Promise<APIResponse<WeeklyReportData>> => {
    try {
      // Get current news data
      const newsResponse = await newsApi.getNews()
      
      if (!newsResponse.success || !newsResponse.data) {
        throw new Error('Failed to fetch news data for weekly report')
      }
      
      const stories = newsResponse.data
      
      // Calculate weekly report statistics
      const categories = [...new Set(stories.map(item => item.auto_category))].filter(Boolean)
      const totalViews = stories.reduce((sum, item) => {
        const views = parseInt(item.view_count.replace(/,/g, '')) || 0
        return sum + views
      }, 0)
      const avgViews = Math.round(totalViews / stories.length)
      const topScore = Math.max(...stories.map(item => item.popularity_score_precise || item.popularity_score))
      
      // Generate date range for the last 7 days
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
      
      const weeklyData: WeeklyReportData = {
        totalStories: stories.length,
        avgViews: avgViews,
        categories: categories,
        topScore: Math.round(topScore * 10) / 10, // Round to 1 decimal
        stories: stories,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      }
      
      return {
        success: true,
        data: weeklyData,
        message: `Generated weekly report with ${stories.length} stories`,
      }
    } catch (error) {
      console.error('Error generating weekly report:', error)
      throw new Error('Failed to generate weekly report')
    }
  },

  // Download weekly report PDF
  downloadWeeklyReport: async (): Promise<APIResponse<Blob>> => {
    try {
      // Try to fetch from backend first
      const response = await api.get('/api/weekly-report/pdf', {
        responseType: 'blob',
      })
      return {
        success: true,
        data: response.data,
      }
    } catch (error) {
      // Fallback: Check if PDF exists in public directory with cache-busting
      try {
        const timestamp = Date.now()
        const pdfResponse = await fetch(`/trendsiam_report.pdf?ts=${timestamp}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        })
        if (pdfResponse.ok) {
          const blob = await pdfResponse.blob()
          console.log(`📄 Downloaded fresh PDF report (${timestamp})`)
          return {
            success: true,
            data: blob,
            message: 'Downloaded latest PDF report with cache-busting',
          }
        }
      } catch (fallbackError) {
        console.warn('PDF not found in public directory')
      }
      
      throw new Error('Weekly report PDF not available. Please generate a new report from the backend.')
    }
  },

  // Get AI images
  getAIImages: async (): Promise<APIResponse<string[]>> => {
    try {
      const response = await api.get('/api/images')
      return {
        success: true,
        data: response.data,
      }
    } catch (error) {
      // Mock AI image URLs
      return {
        success: true,
        data: [
          './ai_generated_images/image_1.png',
          './ai_generated_images/image_2.png',
          './ai_generated_images/image_3.png',
        ],
        message: 'Using development mock data',
      }
    }
  },

  // Generate new AI images
  generateImages: async (): Promise<APIResponse<boolean>> => {
    try {
      const response = await api.post('/api/images/generate')
      return {
        success: true,
        data: response.data.success,
        message: response.data.message,
      }
    } catch (error) {
      throw new Error('Failed to generate new images')
    }
  },

  // Refresh news data
  refreshNews: async (): Promise<APIResponse<NewsItem[]>> => {
    try {
      const response = await api.post('/api/news/refresh')
      return {
        success: true,
        data: response.data,
        message: 'News data refreshed successfully',
      }
    } catch (error) {
      throw new Error('Failed to refresh news data')
    }
  },
}

export { api }