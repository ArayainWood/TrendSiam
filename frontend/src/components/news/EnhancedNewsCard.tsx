'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, Eye, ThumbsUp, MessageCircle, Calendar, Star, TrendingUp, Globe, Hash } from 'lucide-react'
import type { UINewsItem } from '../../lib/normalizeNewsItem'
import { USE_LEGACY_MODAL_LAYOUT } from '../../lib/featureFlags'
import { useUIStore } from '../../stores/uiStore'
import { getText } from '../../lib/i18n'
import { EnhancedNewsDetailModal } from './EnhancedNewsDetailModal'
import { getGrowthRateLabel, GROWTH_RATE_THRESHOLDS, getPopularityLabel } from '../../lib/constants/businessRules'

interface EnhancedNewsCardProps {
  news: UINewsItem
  index: number
  onOpenModal?: (news: UINewsItem) => void
}

export function EnhancedNewsCard({ news, index, onOpenModal }: EnhancedNewsCardProps) {
  const { language } = useUIStore()
  const [showModal, setShowModal] = useState(false)
  const [imageError, setImageError] = useState(false)

  const formatNumber = (num: string | number | null | undefined) => {
    if (!num || num === '0') return '–'
    const numValue = typeof num === 'string' ? parseInt(num.replace(/,/g, '')) : num
    if (isNaN(numValue) || numValue == null) return '–'
    if (numValue >= 1000000) {
      return `${(numValue / 1000000).toFixed(1)}M`
    } else if (numValue >= 1000) {
      return `${(numValue / 1000).toFixed(1)}K`
    }
    return numValue.toLocaleString()
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    
    try {
      const date = new Date(dateString)
      
      // Use Asia/Bangkok timezone
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }
      
      if (language.code === 'th') {
        return date.toLocaleDateString('th-TH', options)
      } else {
        return date.toLocaleDateString('en-US', options)
      }
    } catch {
      return dateString || 'N/A'
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

  const getGrowthRateDisplay = (growthRate: number | null) => {
    const label = getGrowthRateLabel(growthRate);
    if (!label) return null;
    // For card display, show shorter version
    if (label.includes('(')) {
      const parts = label.split('(');
      return parts[0]?.trim() || label;
    }
    return label;
  }

  const getGrowthRateColor = (growthRate: number | null) => {
    if (!growthRate || growthRate <= 0) return 'text-concrete-600 dark:text-concrete-400'
    if (growthRate >= GROWTH_RATE_THRESHOLDS.VIRAL) return 'text-emerald-600 dark:text-emerald-400'
    if (growthRate >= GROWTH_RATE_THRESHOLDS.HIGH_GROWTH) return 'text-amber-600 dark:text-amber-400'
    return 'text-blue-600 dark:text-blue-400'
  }

  const isTop3 = (news.rank && news.rank <= 3) || index < 3

  const handleCardClick = () => {
    if (onOpenModal) {
      onOpenModal(news)
    } else {
      setShowModal(true)
    }
  }

  return (
    <>
      <article 
        className={`news-card p-6 cursor-pointer hover:shadow-lg transition-shadow ${isTop3 ? 'ring-2 ring-accent-200 dark:ring-accent-800' : ''}`}
        onClick={handleCardClick}
      >
        {/* Top banner for top 3 */}
        {isTop3 && (
          <div className="flex items-center gap-2 mb-4 -mt-2 -mx-2 px-4 py-2 bg-gradient-to-r from-accent-500 to-thai-500 text-white rounded-t-2xl">
            <Star className="w-4 h-4" />
            <span className="text-sm font-semibold">
              #{news.rank ?? index + 1} Top Story
            </span>
          </div>
        )}

        <div className="space-y-6">
          {/* Header with badges */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              
              {/* Badges row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-concrete-600 dark:text-concrete-400">
                  #{news.rank ?? index + 1}
                </span>
                
                {news.category && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
                    {news.category}
                  </span>
                )}
                
                {news.platform && (
                  <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full">
                    <Globe className="w-3 h-3 inline mr-1" />
                    {news.platform}
                  </span>
                )}
                
                {news.isAIImage && (
                  <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium rounded-full">
                    🤖 AI
                  </span>
                )}
                
                {getGrowthRateDisplay(news.growthRateValue) && (
                  <span className={`px-2 py-1 bg-green-100 dark:bg-green-900/30 text-xs font-medium rounded-full ${getGrowthRateColor(news.growthRateValue)}`}>
                    <TrendingUp className="w-3 h-3 inline mr-1" />
                    {getGrowthRateDisplay(news.growthRateValue)}
                  </span>
                )}
              </div>
              
              {/* Title */}
              <h2 className="text-xl font-bold text-concrete-900 dark:text-white leading-tight line-clamp-2">
                {news.title}
              </h2>
              
              {/* Meta info */}
              <div className="flex items-center gap-4 text-sm text-concrete-600 dark:text-concrete-400">
                <div className="flex items-center gap-1">
                  <span>{news.channel || news.channelTitle || '–'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(news.publishedAt || '')}
                </div>
              </div>
            </div>
            
            {/* Popularity score */}
            <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg ${getPopularityBg(news.popularityScore || 0)} min-w-[140px]`}>
              <div className={`text-2xl font-bold ${getPopularityColor(news.popularityScore || 0)}`}>
                {(news.popularityScore || 0).toFixed(1)}
              </div>
              <div className="text-xs text-concrete-600 dark:text-concrete-400">
                /100
              </div>
            </div>
          </div>

          {/* Image Section - Only for Top-3 with images */}
          {news.showImage && news.imageUrl && (
            <div className="relative">
              <div className="aspect-video bg-concrete-100 dark:bg-void-800 rounded-lg overflow-hidden">
                <img
                  src={news.imageUrl}
                  alt={`AI-generated illustration for: ${news.title}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.warn(`Image load failed for story #${news.rank}, using placeholder`);
                    (e.currentTarget as HTMLImageElement).src = '/placeholder-image.svg';
                    setImageError(true);
                  }}
                />
              </div>
              
              {/* AI-Generated Badge - Always show for API images */}
              {!imageError && (
                <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 text-white text-xs rounded-full backdrop-blur-sm border border-white/20">
                  <span className="flex items-center gap-1">
                    🤖 <span className="font-medium">AI-Generated</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-concrete-100 dark:bg-void-800 rounded-lg">
              <Eye className="w-4 h-4 mx-auto mb-1 text-concrete-600 dark:text-concrete-400" />
              <div className="text-sm font-medium text-concrete-900 dark:text-white">
                {formatNumber(news.views)}
              </div>
              <div className="text-xs text-concrete-500 dark:text-concrete-500">
                Views
              </div>
            </div>
            <div className="text-center p-3 bg-concrete-100 dark:bg-void-800 rounded-lg">
              <ThumbsUp className="w-4 h-4 mx-auto mb-1 text-concrete-600 dark:text-concrete-400" />
              <div className="text-sm font-medium text-concrete-900 dark:text-white">
                {formatNumber(news.likes)}
              </div>
              <div className="text-xs text-concrete-500 dark:text-concrete-500">
                Likes
              </div>
            </div>
            <div className="text-center p-3 bg-concrete-100 dark:bg-void-800 rounded-lg">
              <MessageCircle className="w-4 h-4 mx-auto mb-1 text-concrete-600 dark:text-concrete-400" />
              <div className="text-sm font-medium text-concrete-900 dark:text-white">
                {formatNumber(news.comments)}
              </div>
              <div className="text-xs text-concrete-500 dark:text-concrete-500">
                Comments
              </div>
            </div>
          </div>

          {/* Summary */}
          {(news.summaryEn || news.summary) && (
            <div className="prose prose-sm max-w-none">
              <p className="text-concrete-700 dark:text-concrete-300 leading-relaxed line-clamp-3">
                {language.code === 'en' && news.summaryEn ? news.summaryEn : news.summary}
              </p>
            </div>
          )}

          {/* Popularity Subtext */}
          {news.popularitySubtext && (
            <div className="text-sm text-concrete-600 dark:text-concrete-400 italic">
              {news.popularitySubtext}
            </div>
          )}

          {/* Keywords (if available and USE_NEW_UI_SECTIONS) */}
          {USE_LEGACY_MODAL_LAYOUT && news.keywordsList && news.keywordsList.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {news.keywordsList.slice(0, 4).map((keyword, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-accent-100 text-accent-800 dark:bg-accent-800/20 dark:text-accent-300"
                >
                  <Hash className="w-3 h-3 mr-1" />
                  {keyword}
                </span>
              ))}
              {news.keywordsList.length > 4 && (
                <span className="text-xs text-concrete-500 dark:text-concrete-500">
                  +{news.keywordsList.length - 4} more
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            {news.sourceUrl && (
              <a
                href={news.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors focus-ring"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-4 h-4" />
                {getText('watch_on_youtube', language.code)}
              </a>
            )}
            
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleCardClick()
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 dark:bg-primary-700 text-concrete-700 dark:text-concrete-300 font-medium rounded-lg hover:bg-concrete-200 dark:hover:bg-void-600 transition-colors focus-ring"
            >
              {getText('view_details_title', language.code)}
            </button>
          </div>
        </div>
      </article>

      {/* Modal */}
      <EnhancedNewsDetailModal
        news={news}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  )
}
