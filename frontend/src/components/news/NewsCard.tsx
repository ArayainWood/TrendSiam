'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, Eye, ThumbsUp, MessageCircle, Calendar, Star, Code, Copy, ChevronDown, ChevronUp } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { getText } from '../../lib/i18n'
import { NewsItem } from '../../types'
import toast from 'react-hot-toast'
import { newsApi } from '../../lib/api'

interface NewsCardProps {
  news: NewsItem
  index: number
}

export function NewsCard({ news, index }: NewsCardProps) {
  const { language, developerMode } = useUIStore()
  const [showDetails, setShowDetails] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [internalViews, setInternalViews] = useState(0)

  // Load internal views when component mounts
  useEffect(() => {
    if (news?.video_id) {
      newsApi.getNewsViews(news.video_id).then((views: number) => {
        setInternalViews(views)
      }).catch((error: unknown) => {
        // Failed to load view count - using default
        setInternalViews(0)
      })
    }
  }, [news?.video_id])

  const formatNumber = (num: string | number) => {
    const numValue = typeof num === 'string' ? parseInt(num.replace(/,/g, '')) : num
    if (numValue >= 1000000) {
      return `${(numValue / 1000000).toFixed(1)}M`
    } else if (numValue >= 1000) {
      return `${(numValue / 1000).toFixed(1)}K`
    }
    return numValue.toLocaleString()
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      if (language.code === 'th') {
        return date.toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      } else {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      }
    } catch {
      return dateString
    }
  }

  const getPopularityColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 dark:text-emerald-400'
    if (score >= 60) return 'text-amber-600 dark:text-amber-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getPopularityBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-100 dark:bg-emerald-900/30'
    if (score >= 60) return 'bg-amber-100 dark:bg-amber-900/30'
    return 'bg-red-100 dark:bg-red-900/30'
  }

  const handleCopyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      toast.success('AI prompt copied to clipboard!')
    } catch (error) {
      toast.error('Failed to copy prompt')
    }
  }

  const handleImageClick = () => {
    if (news.ai_image_url && !imageError) {
      window.open(news.ai_image_url, '_blank')
    }
  }

  const summary = language.code === 'th' ? news.summary : news.summary_en
  const isTop3 = (typeof news.rank === 'number' ? news.rank : parseInt(news.rank.toString())) <= 3

  return (
    <article className={`news-card p-6 ${isTop3 ? 'ring-2 ring-accent-200 dark:ring-accent-800' : ''}`}>
      {/* Top banner for top 3 */}
      {isTop3 && (
        <div className="flex items-center gap-2 mb-4 -mt-2 -mx-2 px-4 py-2 bg-gradient-to-r from-accent-500 to-thai-500 text-white rounded-t-2xl">
          <Star className="w-4 h-4" />
          <span className="text-sm font-semibold">
            #{news.rank} Top Story
          </span>
        </div>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 text-sm text-concrete-600 dark:text-concrete-400">
              <span className="font-medium">#{news.rank}</span>
              <span>•</span>
              <span>{news.channel}</span>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(news.published_date)}
              </div>
            </div>
            
            <h2 className="text-xl font-bold text-concrete-900 dark:text-white leading-tight line-clamp-2">
              {news.title}
            </h2>
            
            <div className="flex items-center gap-4 text-sm text-concrete-600 dark:text-concrete-400">
              <div className="flex items-center gap-1">
                <span>👁 {internalViews > 0 ? `${formatNumber(internalViews)} ${internalViews === 1 ? 'view' : 'views'}` : '0 views'}</span>
              </div>
              <div className="flex items-center gap-1">
                <ThumbsUp className="w-4 h-4" />
                <span>{formatNumber(news.like_count)}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle className="w-4 h-4" />
                <span>{formatNumber(news.comment_count)}</span>
              </div>
            </div>
          </div>
          
          {/* Popularity score */}
          <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg ${getPopularityBg(news.popularity_score)}`}>
            <div className={`text-2xl font-bold ${getPopularityColor(news.popularity_score)}`}>
              {Math.round(news.popularity_score_precise || news.popularity_score)}
            </div>
            <div className="text-xs text-concrete-600 dark:text-concrete-400">
              /100
            </div>
          </div>
        </div>

        {/* AI Image (for top 3) */}
        {isTop3 && news.ai_image_url && (
          <div className="relative">
            <div 
              className="aspect-video bg-concrete-100 dark:bg-void-800 rounded-lg overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform"
              onClick={handleImageClick}
            >
              {!imageError ? (
                <img
                  src={news.ai_image_url}
                  alt={`AI illustration for: ${news.title}`}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-concrete-200 dark:bg-void-700 rounded-full flex items-center justify-center mx-auto mb-2">
                      <svg className="w-8 h-8 text-concrete-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-sm text-concrete-500">AI Image</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* AI badge */}
            <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-sm">
              🤖 AI Generated
            </div>
          </div>
        )}

        {/* Category */}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-full">
            {getText(news.auto_category, language.code)}
          </span>
        </div>

        {/* Summary */}
        <div className="prose prose-sm max-w-none">
          <p className="text-concrete-700 dark:text-concrete-300 leading-relaxed">
            {summary}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <a
            href={`https://www.youtube.com/watch?v=${news.video_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors focus-ring"
          >
            <ExternalLink className="w-4 h-4" />
            {getText('watch_on_youtube', language.code)}
          </a>
          
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 dark:bg-primary-700 text-concrete-700 dark:text-concrete-300 font-medium rounded-lg hover:bg-concrete-200 dark:hover:bg-void-600 transition-colors focus-ring"
          >
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {getText('view_details_title', language.code)}
          </button>
        </div>

        {/* Expandable details */}
        {showDetails && (
          <div className="space-y-4 pt-4 border-t border-concrete-200 dark:border-void-700 animate-in">
            {/* Popularity details */}
            <div className="bg-concrete-50 dark:bg-void-800 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-concrete-900 dark:text-white">
                {getText('popularity_score', language.code)} Details
              </h4>
              <p className="text-sm text-concrete-700 dark:text-concrete-300">
                {news.reason}
              </p>
              
              {/* View details breakdown */}
              {news.view_details && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-concrete-600 dark:text-concrete-400">Views:</span>
                    <span className="ml-2 font-medium">{news.view_details.views}</span>
                  </div>
                  <div>
                    <span className="text-concrete-600 dark:text-concrete-400">Growth:</span>
                    <span className="ml-2 font-medium">{news.view_details.growth_rate}</span>
                  </div>
                  <div>
                    <span className="text-concrete-600 dark:text-concrete-400">Platform:</span>
                    <span className="ml-2 font-medium">{news.view_details.platform_mentions}</span>
                  </div>
                  <div>
                    <span className="text-concrete-600 dark:text-concrete-400">Score:</span>
                    <span className="ml-2 font-medium">{news.view_details.score}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Developer mode details */}
            {developerMode && (
              <div className="bg-accent-50 dark:bg-accent-900/20 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-accent-700 dark:text-accent-300 flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  Developer Information
                </h4>
                
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-accent-600 dark:text-accent-400 font-medium">Video ID:</span>
                    <span className="ml-2 font-mono">{news.video_id}</span>
                  </div>
                  
                  <div>
                    <span className="text-accent-600 dark:text-accent-400 font-medium">Precise Score:</span>
                    <span className="ml-2 font-mono">{news.popularity_score_precise?.toFixed(6)}</span>
                  </div>
                  
                  {news.ai_image_prompt && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-accent-600 dark:text-accent-400 font-medium">AI Prompt:</span>
                        <button
                          onClick={() => handleCopyPrompt(news.ai_image_prompt!)}
                          className="flex items-center gap-1 px-2 py-1 bg-accent-100 dark:bg-accent-800 text-accent-700 dark:text-accent-300 rounded hover:bg-accent-200 dark:hover:bg-accent-700 transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          <span className="text-xs">Copy</span>
                        </button>
                      </div>
                      <div className="bg-accent-100 dark:bg-accent-900 rounded p-3 font-mono text-xs">
                        {news.ai_image_prompt}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  )
}