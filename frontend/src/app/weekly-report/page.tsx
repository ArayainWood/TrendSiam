'use client'

import { useEffect, useState } from 'react'
import { Layout } from '../../components/layout/Layout'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { ErrorBoundary } from '../../components/ui/ErrorBoundary'
import { useUIStore } from '../../stores/uiStore'
import { getText } from '../../lib/i18n'
import { newsApi } from '../../lib/api'
import { WeeklyReportData } from '../../types'
import { BarChart3, Download, Calendar, TrendingUp, Eye, Star } from 'lucide-react'
import toast from 'react-hot-toast'

export default function WeeklyReportPage() {
  const { language, setCurrentPage } = useUIStore()
  const [reportData, setReportData] = useState<WeeklyReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    setCurrentPage('weekly-report')
    fetchReportData()
  }, [setCurrentPage])

  const fetchReportData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await newsApi.getWeeklyReport()
      
      if (response.success && response.data) {
        setReportData(response.data)
      } else {
        throw new Error(response.message || 'Failed to fetch weekly report')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    try {
      setDownloading(true)
      const response = await newsApi.downloadWeeklyReport()
      
      if (response.success && response.data) {
        // Create blob URL and trigger download
        const blob = new Blob([response.data], { type: 'application/pdf' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `TrendSiam_Weekly_Report_${new Date().toISOString().split('T')[0]}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        
        toast.success('Weekly report downloaded successfully!')
      } else {
        throw new Error('Failed to download PDF')
      }
    } catch (err) {
      toast.error('Failed to download weekly report')
      // PDF download failed - showing error to user
    } finally {
      setDownloading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    if (language.code === 'th') {
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toLocaleString()
  }

  return (
    <Layout>
      <ErrorBoundary>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="text-center space-y-4 mb-12">
            <h1 className="text-4xl md:text-5xl font-display font-bold gradient-text">
              {getText('weekly_report_title', language.code)}
            </h1>
            <p className="text-xl text-concrete-600 dark:text-concrete-300">
              {getText('weekly_report_subtitle', language.code)}
            </p>
            
            {reportData && (
              <p className="text-concrete-500 dark:text-concrete-400">
                {getText('weekly_report_period', language.code)}: {formatDate(reportData.dateRange.start)} - {formatDate(reportData.dateRange.end)}
              </p>
            )}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center py-16">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-16">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md mx-auto">
                <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                  Unable to Load Report
                </h3>
                <p className="text-red-600 dark:text-red-300 text-sm mb-4">
                  {error}
                </p>
                <button
                  onClick={fetchReportData}
                  className="btn-primary text-sm"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Report Content */}
          {!loading && !error && reportData && (
            <div className="space-y-8">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="news-card p-6 text-center">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-concrete-900 dark:text-white mb-1">
                    {reportData.totalStories}
                  </div>
                  <div className="text-sm text-concrete-600 dark:text-concrete-400">
                    {getText('total_stories', language.code)}
                  </div>
                </div>

                <div className="news-card p-6 text-center">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Eye className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-concrete-900 dark:text-white mb-1">
                    {formatNumber(reportData.avgViews)}
                  </div>
                  <div className="text-sm text-concrete-600 dark:text-concrete-400">
                    {getText('avg_views', language.code)}
                  </div>
                </div>

                <div className="news-card p-6 text-center">
                  <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Star className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold text-concrete-900 dark:text-white mb-1">
                    {reportData.topScore.toFixed(1)}
                  </div>
                  <div className="text-sm text-concrete-600 dark:text-concrete-400">
                    {getText('top_score', language.code)}
                  </div>
                </div>

                <div className="news-card p-6 text-center">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="text-2xl font-bold text-concrete-900 dark:text-white mb-1">
                    {reportData.categories.length}
                  </div>
                  <div className="text-sm text-concrete-600 dark:text-concrete-400">
                    {getText('categories_count', language.code)}
                  </div>
                </div>
              </div>

              {/* Download PDF Button */}
              <div className="text-center">
                <button
                  onClick={handleDownloadPDF}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-accent-500 hover:bg-accent-600 disabled:bg-accent-300 text-white font-medium rounded-lg transition-colors focus-ring"
                >
                  {downloading ? (
                    <LoadingSpinner size="sm" className="text-white" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                  {downloading ? 'Generating...' : getText('download_pdf', language.code)}
                </button>
              </div>

              {/* Top Stories */}
              <div className="news-card p-8">
                <h2 className="text-2xl font-bold text-concrete-900 dark:text-white mb-6 flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-accent-500" />
                  {getText('weekly_report_top_stories', language.code)}
                </h2>
                
                <div className="space-y-4">
                  {reportData.stories.slice(0, 10).map((story, index) => (
                    <div
                      key={story.video_id}
                      className="flex items-center gap-4 p-4 bg-concrete-50 dark:bg-void-800 rounded-lg hover:bg-concrete-100 dark:hover:bg-void-700 transition-colors"
                    >
                      <div className="flex-shrink-0 w-8 h-8 bg-accent-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                        {story.rank}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-concrete-900 dark:text-white truncate">
                          {story.title}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-concrete-600 dark:text-concrete-400 mt-1">
                          <span>{story.channel}</span>
                          <span>•</span>
                          <span>{formatNumber(parseInt(story.view_count.replace(/,/g, '')))} views</span>
                          <span>•</span>
                          <span>{Math.round(story.popularity_score_precise || story.popularity_score)}/100</span>
                        </div>
                      </div>
                      
                      <div className="flex-shrink-0">
                        <a
                          href={`https://www.youtube.com/watch?v=${story.video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-red-600 hover:text-red-700 transition-colors"
                        >
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                          </svg>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Categories Overview */}
              <div className="news-card p-8">
                <h2 className="text-2xl font-bold text-concrete-900 dark:text-white mb-6">
                  Categories Overview
                </h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reportData.categories.map((category, index) => (
                    <div
                      key={category}
                      className="p-4 bg-concrete-50 dark:bg-void-800 rounded-lg"
                    >
                      <div className="font-medium text-concrete-900 dark:text-white">
                        {getText(category, language.code)}
                      </div>
                      <div className="text-sm text-concrete-600 dark:text-concrete-400 mt-1">
                        {reportData.stories.filter(story => story.auto_category === category).length} stories
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </ErrorBoundary>
    </Layout>
  )
}