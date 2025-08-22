'use client'

/**
 * SECTION J - Developer Observability Dashboard
 * 
 * Development-only dashboard showing system status, data freshness, and diagnostics
 */

import { useEffect, useState } from 'react'
import { Layout } from '@/components/layout/Layout'

interface SystemStatus {
  timestamp: string
  database: string
  counts: {
    news_trends: number
    ai_images: number
    system_meta: number
  }
  last_updated: string | null
  environment: {
    node_env: string
    supabase_url: string
    service_key: string
    json_fallback_allowed: boolean
  }
  recent_news: Array<{
    id: string
    title: string
    published_at: string
    popularity_score: number
    created_at: string
  }>
}

interface PipelineHealth {
  key: string
  value: string | null
  updated_at: string | null
  timestamp: string
}

export default function DevDashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [pipelineHealth, setPipelineHealth] = useState<PipelineHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Hide in production
  if (process.env.NODE_ENV === 'production') {
    return (
      <Layout showFilters={false}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Dashboard Not Available
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Developer dashboard is only available in development mode
            </p>
          </div>
        </div>
      </Layout>
    )
  }

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/_debug/news')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      setSystemStatus(data)
    } catch (err) {
      console.error('Failed to fetch system status:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const fetchPipelineHealth = async () => {
    try {
      const response = await fetch('/api/system-meta?key=news_last_updated')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      setPipelineHealth(data)
    } catch (err) {
      console.error('Failed to fetch pipeline health:', err)
    }
  }

  const refreshData = async () => {
    setLoading(true)
    setError(null)
    await Promise.all([fetchSystemStatus(), fetchPipelineHealth()])
    setLoading(false)
    setLastRefresh(new Date())
  }

  useEffect(() => {
    refreshData()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshData, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatDateTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString()
    } catch {
      return 'Invalid date'
    }
  }

  const getDataFreshnessColor = (lastUpdated: string | null) => {
    if (!lastUpdated) return 'text-red-600'
    
    const now = new Date()
    const updated = new Date(lastUpdated)
    const diffMinutes = (now.getTime() - updated.getTime()) / (1000 * 60)
    
    if (diffMinutes < 60) return 'text-green-600'
    if (diffMinutes < 180) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getDataFreshnessStatus = (lastUpdated: string | null) => {
    if (!lastUpdated) return 'No data'
    
    const now = new Date()
    const updated = new Date(lastUpdated)
    const diffMinutes = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60))
    
    if (diffMinutes < 1) return 'Just updated'
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hours ago`
    return `${Math.floor(diffMinutes / 1440)} days ago`
  }

  return (
    <Layout showFilters={false}>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              🔧 Developer Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              System status and data freshness monitoring
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              Last refresh: {formatDateTime(lastRefresh.toISOString())}
            </span>
            <button
              onClick={refreshData}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <h3 className="text-red-800 dark:text-red-200 font-medium">Error</h3>
            <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Pipeline Health */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            📊 Pipeline Health
          </h2>
          {pipelineHealth ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Last Updated
                </h3>
                <p className={`text-lg font-semibold mt-1 ${getDataFreshnessColor(pipelineHealth.value)}`}>
                  {getDataFreshnessStatus(pipelineHealth.value)}
                </p>
                {pipelineHealth.value && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatDateTime(pipelineHealth.value)}
                  </p>
                )}
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Meta Updated
                </h3>
                <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                  {pipelineHealth.updated_at ? formatDateTime(pipelineHealth.updated_at) : 'Never'}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Check Time
                </h3>
                <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                  {formatDateTime(pipelineHealth.timestamp)}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 dark:text-gray-400">
              Loading pipeline health...
            </div>
          )}
        </div>

        {/* System Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            🗄️ Database Status
          </h2>
          {systemStatus ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    News Stories
                  </h3>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {systemStatus.counts.news_trends.toLocaleString()}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    AI Images
                  </h3>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {systemStatus.counts.ai_images.toLocaleString()}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    System Meta
                  </h3>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {systemStatus.counts.system_meta.toLocaleString()}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Database
                  </h3>
                  <p className="text-lg font-semibold text-green-600 mt-1">
                    {systemStatus.database}
                  </p>
                </div>
              </div>

              {/* Environment Info */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                  Environment Configuration
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Node Env:</span> {systemStatus.environment.node_env}
                  </div>
                  <div>
                    <span className="font-medium">Supabase URL:</span> {systemStatus.environment.supabase_url}
                  </div>
                  <div>
                    <span className="font-medium">Service Key:</span> {systemStatus.environment.service_key}
                  </div>
                  <div>
                    <span className="font-medium">JSON Fallback:</span> {systemStatus.environment.json_fallback_allowed ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
              </div>

              {/* Recent News */}
              {systemStatus.recent_news.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                    Recent News (Top 3)
                  </h3>
                  <div className="space-y-2">
                    {systemStatus.recent_news.slice(0, 3).map((news, idx) => (
                      <div key={news.id} className="text-sm">
                        <div className="font-medium text-gray-900 dark:text-white">
                          #{idx + 1}: {news.title.substring(0, 80)}...
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 text-xs">
                          Score: {news.popularity_score} • Published: {formatDateTime(news.published_at)} • Created: {formatDateTime(news.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500 dark:text-gray-400">
              Loading system status...
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            🚀 Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/api/_debug/news"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              <h3 className="font-medium text-blue-900 dark:text-blue-100">Debug API</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Raw debug data JSON
              </p>
            </a>
            <a
              href="/api/system-meta?key=news_last_updated"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
            >
              <h3 className="font-medium text-green-900 dark:text-green-100">System Meta</h3>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Pipeline metadata
              </p>
            </a>
            <a
              href="/api/weekly?diag=1&limit=3"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
            >
              <h3 className="font-medium text-purple-900 dark:text-purple-100">Weekly Diagnostics</h3>
              <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                API diagnostics
              </p>
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          SECTION J: Developer Observability Dashboard • Auto-refresh every 30s
        </div>
      </div>
    </Layout>
  )
}
