'use client'

import { useState, useEffect, useCallback } from 'react'
import React from 'react'
import { Layout } from '@/components/layout/Layout'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { useUIStore } from '@/stores/uiStore'
import { getText } from '@/lib/i18n'
import { WeeklySnapshotData } from '@/lib/data/weeklySnapshot'
import { formatDisplayDate } from '@/utils/dateFormatting'
import { NewsStory } from '@/lib/schema/news'
import { SnapshotItem, toScoreString, toCountNumber } from '@/types/snapshots'
import { normalizeNewsItem } from '@/lib/data/newsRepo'
import { BarChart3, Download, TrendingUp, Eye, Star, AlertCircle, RefreshCw } from 'lucide-react'
import { TopStoryCard } from '@/components/news/TopStoryCard'
import DynamicClientTime from '@/components/DynamicClientTime'
import toast from 'react-hot-toast'

interface WeeklyReportClientProps {
  snapshotData: WeeklySnapshotData;
  buildTag?: string;
}

// Client component for snapshot-based weekly reports
export default function WeeklyReportClient({ snapshotData, buildTag }: WeeklyReportClientProps) {
  const { language } = useUIStore()
  const [downloading, setDownloading] = useState(false)
  const [hasNewerSnapshot, setHasNewerSnapshot] = useState(false)
  const [checkingForUpdates, setCheckingForUpdates] = useState(false)
  
  // Check for newer snapshots every 60 seconds
  const checkForNewerSnapshot = useCallback(async () => {
    if (!snapshotData.snapshotId || checkingForUpdates) return;
    
    setCheckingForUpdates(true);
    try {
      const response = await fetch(`/api/weekly/check-update?current=${snapshotData.snapshotId}`);
      if (response.ok) {
        const { hasNewer } = await response.json();
        setHasNewerSnapshot(hasNewer);
      }
    } catch (error) {
      console.error('[weekly-report] Failed to check for updates:', error);
    } finally {
      setCheckingForUpdates(false);
    }
  }, [snapshotData.snapshotId, checkingForUpdates]);
  
  useEffect(() => {
    // Initial check after 5 seconds
    const initialTimer = setTimeout(checkForNewerSnapshot, 5000);
    
    // Then check every 60 seconds
    const interval = setInterval(checkForNewerSnapshot, 60000);
    
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [checkForNewerSnapshot]);

  const handleDownloadPDF = async () => {
    try {
      setDownloading(true)
      console.log('[weekly-report/client] Starting PDF download with snapshot:', snapshotData.snapshotId)
      
      // Pass snapshot ID to ensure PDF uses same data
      const url = new URL('/api/weekly/pdf', window.location.origin);
      if (snapshotData.snapshotId) {
        url.searchParams.set('snapshot', snapshotData.snapshotId);
      }
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf'
        }
      })
      
      // Log response headers for instrumentation
      console.log('[weekly-report/client] PDF API response headers:', {
        'X-TS-API': response.headers.get('X-TS-API'),
        'X-TS-PDF-Fonts': response.headers.get('X-TS-PDF-Fonts'),
        'Content-Type': response.headers.get('Content-Type')
      });
      
      if (response.ok) {
        // Verify it's actually a PDF
        const contentType = response.headers.get('Content-Type')
        if (!contentType?.includes('application/pdf')) {
          throw new Error('Server did not return a PDF file')
        }
        
        // Create blob URL and trigger download
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        // Include snapshot ID in filename for cache-busting
        const dateStr = new Date(snapshotData.builtAt).toISOString().split('T')[0];
        link.download = `trendsiam-weekly-${dateStr}-${snapshotData.snapshotId.slice(0, 8)}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        
        toast.success('Weekly report downloaded successfully!')
      } else {
        const errorText = await response.text()
        throw new Error(`Server error (${response.status}): ${errorText}`)
      }
    } catch (err) {
      console.error('PDF download failed:', err)
      toast.error(`Failed to download weekly report: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setDownloading(false)
    }
  }

  const formatDate = (item: SnapshotItem | { published_at?: string | null; created_at?: string | null }) => {
    // Use the centralized date formatter that handles the 1970 bug
    const formatted = formatDisplayDate(item.published_at, item.created_at);
    if (formatted === '—') return formatted;
    
    // Apply locale-specific formatting if valid
    const dateStr = item.published_at || item.created_at;
    if (!dateStr) return formatted;
    
    try {
      const date = new Date(dateStr);
      if (language.code === 'th') {
        return date.toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      } else {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
    } catch (e) {
      return formatted;
    }
  }

  const formatNumber = (num: string | number | null | undefined) => {
    if (!num || num === '0') return '0'
    const numValue = typeof num === 'string' ? parseInt(num.replace(/,/g, '')) : num
    if (isNaN(numValue) || numValue == null) return '0'
    if (numValue >= 1000000) {
      return `${(numValue / 1000000).toFixed(1)}M`
    } else if (numValue >= 1000) {
      return `${(numValue / 1000).toFixed(1)}K`
    }
    return numValue.toLocaleString()
  }

  const handleRefresh = () => {
    // Reload the page to get the latest snapshot
    window.location.reload();
  }

  // Transform SnapshotItem to NewsStory for TopStoryCard compatibility
  const transformToNewsItem = (item: SnapshotItem): NewsStory => {
    // Use the centralized normalization function
    return normalizeNewsItem({
      id: item.id,
      rank: item.rank,
      title: item.title,
      channel: item.channel || 'Unknown Channel',
      view_count: item.view_count || '0',
      published_date: item.published_at || item.created_at || '',
      video_id: item.video_id || '',
      description: item.description || '',
      duration: '0:00',
      like_count: item.like_count || '0',
      comment_count: item.comment_count || '0',
      summary: item.summary || '',
      summary_en: item.summary_en || '',
      popularity_score: item.popularity_score || 0,
      popularity_score_precise: item.popularity_score_precise || 0,
      reason: 'High engagement and trending metrics',
      auto_category: item.category || 'Uncategorized',
      platform: item.platform || 'YouTube',
      ai_image_url: item.ai_image_url,
      ai_image_prompt: item.ai_image_prompt,
      date: item.published_at?.split('T')[0] || new Date().toISOString().split('T')[0]
    });
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
            
            {snapshotData.success && (
              <div className="space-y-2">
                <p className="text-concrete-500 dark:text-concrete-400">
                  {snapshotData.metrics.timeRange}
                </p>
                
                {/* Snapshot status badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-full text-sm text-emerald-800 dark:text-emerald-200">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  As of <DynamicClientTime iso={snapshotData.builtAt} format="MMM D, H:mm" />
                </div>
                
                {/* New snapshot available banner */}
                {hasNewerSnapshot && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm text-blue-800 dark:text-blue-200">
                          A newer report is available
                        </span>
                      </div>
                      <button
                        onClick={handleRefresh}
                        className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Diagnostic info */}
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 space-y-1">
                  <div>snapshot: {snapshotData.snapshotId.slice(0, 8)}</div>
                  <div>range: {formatDisplayDate(snapshotData.rangeStart, null)} - {formatDisplayDate(snapshotData.rangeEnd, null)}</div>
                  {buildTag && <div suppressHydrationWarning>build: {buildTag}</div>}
                </div>
              </div>
            )}
          </div>

          {/* Error State */}
          {!snapshotData.success && (
            <div className="text-center py-16">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md mx-auto">
                <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                  Unable to Load Report
                </h3>
                <p className="text-red-600 dark:text-red-300 text-sm mb-4">
                  {snapshotData.error || 'No snapshot data available'}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="btn-primary text-sm"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Report Content */}
          {snapshotData.success && (
            <div className="space-y-8">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="news-card p-6 text-center">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-concrete-900 dark:text-white mb-1">
                    {snapshotData.metrics.totalStories}
                  </div>
                  <div className="text-sm text-concrete-600 dark:text-concrete-400">
                    Total Stories
                  </div>
                </div>

                <div className="news-card p-6 text-center">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Eye className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-concrete-900 dark:text-white mb-1">
                    {snapshotData.metrics.summariesCoverage}%
                  </div>
                  <div className="text-sm text-concrete-600 dark:text-concrete-400">
                    Summary Coverage
                  </div>
                </div>

                <div className="news-card p-6 text-center">
                  <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Star className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold text-concrete-900 dark:text-white mb-1">
                    {snapshotData.metrics.avgScore.toFixed(1)}
                  </div>
                  <div className="text-sm text-concrete-600 dark:text-concrete-400">
                    Avg Score
                  </div>
                </div>

                <div className="news-card p-6 text-center">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="text-2xl font-bold text-concrete-900 dark:text-white mb-1">
                    {snapshotData.metrics.imagesCoverage}%
                  </div>
                  <div className="text-sm text-concrete-600 dark:text-concrete-400">
                    Images Coverage
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
                  <span className="ml-2 text-sm font-normal text-concrete-600 dark:text-concrete-400">
                    (Sorted by Popularity Score)
                  </span>
                </h2>
                
                <div className="space-y-4">
                  {snapshotData.items
                    .slice(0, 10)
                    .map((item) => (
                      <TopStoryCard
                        key={item.id}
                        story={transformToNewsItem(item)}
                        rank={item.rank}
                      />
                    ))}
                </div>
              </div>

              {/* Categories Overview */}
              <div className="news-card p-8">
                <h2 className="text-2xl font-bold text-concrete-900 dark:text-white mb-6">
                  Categories Overview
                </h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(snapshotData.metrics.categoryDistribution || {}).map(([category, count]) => (
                    <div
                      key={category}
                      className="p-4 bg-concrete-50 dark:bg-void-800 rounded-lg"
                    >
                      <div className="font-medium text-concrete-900 dark:text-white">
                        {category}
                      </div>
                      <div className="text-sm text-concrete-600 dark:text-concrete-400 mt-1">
                        {count} stories
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
