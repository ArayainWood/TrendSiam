'use client'

import { useEffect, useState } from 'react';
import { X, ExternalLink, Calendar, Eye, ThumbsUp, MessageCircle, Star, Code2, Copy, BarChart3, TrendingUp, Globe, Hash } from 'lucide-react'
import type { UINewsItem } from '../../lib/normalizeNewsItem'
import { useUIStore } from '../../stores/uiStore'
import { ImageModal } from '../ui/ImageModal'
import { newsApi } from '../../lib/api'
import toast from 'react-hot-toast'
import { getFreshAIImageUrl } from '../../lib/imageUtils'
import { USE_LEGACY_MODAL_LAYOUT } from '../../lib/featureFlags'
import { getGrowthRateLabel, ENGAGEMENT_THRESHOLDS, ENGAGEMENT_LABELS } from '../../lib/constants/businessRules'
import { getPopularitySubtext, formatPopularityScore, getPopularityColor, getPopularityBg } from '../../lib/helpers/popularityHelpers'
import { formatGrowthRate } from '../../lib/helpers/growthHelpers'
import { collectDisplayKeywords } from '../../lib/helpers/keywords'

interface EnhancedNewsDetailModalProps {
  news: UINewsItem | null
  isOpen: boolean
  onClose: () => void
}

export function EnhancedNewsDetailModal({ news, isOpen, onClose }: EnhancedNewsDetailModalProps) {
  const { language } = useUIStore()
  const [showPrompt, setShowPrompt] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)

  // Increment view count when modal opens
  useEffect(() => {
    if (isOpen && news?.video_id) {
      newsApi.incrementNewsView(news.video_id).then((response: { success: boolean; message?: string }) => {
        if (response.success) {
          // View tracking completed successfully
        }
      }).catch((error: unknown) => {
        // Failed to track view - error handled
      })
    }
  }, [isOpen, news?.video_id])

  if (!isOpen || !news) return null

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
      
      // Format with Asia/Bangkok timezone
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
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

  const handleCopyPrompt = async () => {
    if (!news.aiImagePrompt?.trim()) return
    
    try {
      await navigator.clipboard.writeText(news.aiImagePrompt)
      toast.success(language.code === 'th' ? 'คัดลอกพรอมต์แล้ว!' : 'AI prompt copied!')
    } catch (error) {
      toast.error(language.code === 'th' ? 'ไม่สามารถคัดลอกได้' : 'Failed to copy prompt')
    }
  }





  const getGrowthRateColor = (growthRate: number | null) => {
    if (!growthRate || growthRate <= 0) return 'text-concrete-600 dark:text-concrete-400'
    if (growthRate >= 100000) return 'text-emerald-600 dark:text-emerald-400'
    if (growthRate >= 10000) return 'text-amber-600 dark:text-amber-400'
    return 'text-blue-600 dark:text-blue-400'
  }



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-white dark:bg-void-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-concrete-200 dark:border-void-800">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-accent-500 rounded-full animate-pulse" />
            <h2 className="text-lg font-heading font-semibold text-concrete-900 dark:text-white">
              {language.code === 'th' ? 'รายละเอียดข่าว' : 'Story Details'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-concrete-100 dark:hover:bg-void-800 transition-colors"
          >
            <X className="w-5 h-5 text-concrete-600 dark:text-concrete-400" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="p-6 space-y-6">
            
            {/* A) Header Row */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                {news.rank && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-accent-500 text-white rounded-full text-sm font-mono font-medium">
                    <Star className="w-3 h-3" />
                    #{news.rank}
                  </span>
                )}
                {news.category && (
                  <span className="px-3 py-1 bg-concrete-100 dark:bg-void-800 text-concrete-700 dark:text-concrete-300 rounded-full text-sm font-mono uppercase tracking-wide">
                    {news.category}
                  </span>
                )}
                {news.platform && (
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-mono uppercase tracking-wide">
                    {news.platform}
                  </span>
                )}
                {news.isAIImage && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium">
                    🤖 AI-Generated Image
                  </span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-heading font-bold text-concrete-900 dark:text-white leading-tight">
                {news.title}
              </h1>
            </div>

            {/* B) Media */}
            <div className="space-y-4">
              <div className="image-reveal rounded-xl overflow-hidden group relative">
                <img 
                  src={news.displayImageUrl}
                  alt={`Illustration for: ${news.title}`}
                  className="w-full h-64 md:h-80 object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                  onClick={() => setShowImageModal(true)}
                />
                
                {/* AI-Generated Badge */}
                {news.isAIImage && (
                  <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/70 text-white text-sm rounded-lg backdrop-blur-sm border border-white/20">
                    <span className="flex items-center gap-2">
                      🤖 <span className="font-medium">AI-Generated Image</span>
                    </span>
                  </div>
                )}
              </div>
              
              {/* Image Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowImageModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-concrete-100 dark:bg-void-800 hover:bg-concrete-200 dark:hover:bg-void-700 rounded-lg transition-colors text-sm font-medium text-concrete-700 dark:text-concrete-300"
                >
                  <Eye className="w-4 h-4" />
                  {language.code === 'th' ? 'ดูภาพขยาย' : 'View Fullscreen'}
                </button>
                
                {/* AI Prompt Button - only show if prompt exists */}
                {news.aiImagePrompt?.trim() && news.aiImagePrompt.trim().length > 0 && (
                  <button
                    onClick={() => setShowPrompt(!showPrompt)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 rounded-lg transition-colors text-sm font-medium text-purple-700 dark:text-purple-300"
                  >
                    <Code2 className="w-4 h-4" />
                    {language.code === 'th' ? 'ดู AI Prompt' : 'View AI Prompt'}
                  </button>
                )}
                
                <a
                  href={news.displayImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  {language.code === 'th' ? 'เปิดภาพในแท็บใหม่' : 'Open Image in New Tab'}
                </a>
              </div>
            </div>

            {/* AI Prompt Panel - appears when button is clicked */}
            {showPrompt && news.aiImagePrompt?.trim() && news.aiImagePrompt.trim().length > 0 && (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-mono uppercase tracking-wide text-purple-600 dark:text-purple-400">
                    AI Image Prompt
                  </span>
                  <button
                    onClick={handleCopyPrompt}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-mono text-purple-500 dark:text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                <p className="text-sm text-purple-800 dark:text-purple-200 font-mono leading-relaxed whitespace-pre-wrap break-words">
                  {news.aiImagePrompt}
                </p>
              </div>
            )}

            {/* C) Left Column (Insights) & D) Right Column (Basic Info) */}
            <div className="grid md:grid-cols-2 gap-6">
              
              {/* C) Left Column - Popularity Score */}
              <div className={`p-6 rounded-xl ${getPopularityBg(news.popularityScore)}`}>
                <div className="flex items-center gap-3 mb-3">
                  <BarChart3 className={`w-5 h-5 ${getPopularityColor(news.popularityScore)}`} />
                  <span className="text-sm font-mono uppercase tracking-wide text-concrete-600 dark:text-concrete-400">
                    {language.code === 'th' ? 'คะแนนความนิยม' : 'Popularity Score'}
                  </span>
                </div>
                <div className={`text-4xl font-heading font-bold ${getPopularityColor(news.popularityScore)} mb-2`}>
                  {formatPopularityScore(news.popularityScore)}
                  <span className="text-lg">/100</span>
                </div>
                <p className="text-sm text-concrete-700 dark:text-concrete-300 leading-relaxed" data-testid="popularity-subtext">
                  {getPopularitySubtext(news)}
                </p>
              </div>

              {/* D) Right Column - Basic Info */}
              <div className="space-y-4">
                <div className="space-y-3">
                  <h3 className="text-lg font-heading font-semibold text-concrete-900 dark:text-white">
                    {language.code === 'th' ? 'ข้อมูลพื้นฐาน' : 'Basic Info'}
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-concrete-600 dark:text-concrete-400">
                        {language.code === 'th' ? 'ช่อง' : 'Channel'}
                      </span>
                      <span className="text-sm font-medium text-concrete-900 dark:text-white">
                        {news.channelTitle || '–'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-concrete-600 dark:text-concrete-400">
                        {language.code === 'th' ? 'เผยแพร่' : 'Published'}
                      </span>
                      <span className="text-sm font-medium text-concrete-900 dark:text-white">
                        {formatDate(news.publishedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Engagement metrics */}
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

                {/* CTA */}
                {news.video_id && news.platform === 'YouTube' && (
                  <a
                    href={`https://www.youtube.com/watch?v=${news.video_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-heading font-medium rounded-lg transition-colors w-full justify-center"
                  >
                    <ExternalLink className="w-5 h-5" />
                    {language.code === 'th' ? 'ดูต้นฉบับใน YouTube' : 'View Original on YouTube'}
                  </a>
                )}
              </div>
            </div>

            {/* E) Summary */}
            {(news.summary_en || news.summary) && (
              <div className="space-y-4">
                <h3 className="text-lg font-heading font-semibold text-concrete-900 dark:text-white">
                  {language.code === 'th' ? 'สรุป' : 'Summary'}
                </h3>
                <p className="text-concrete-700 dark:text-concrete-300 leading-relaxed">
                  {language.code === 'en' && news.summary_en ? news.summary_en : news.summary}
                </p>
              </div>
            )}

            {/* F) Detailed Analysis Grid (4 tiles) */}
            {USE_LEGACY_MODAL_LAYOUT && (
              <div className="space-y-4">
                <h3 className="text-lg font-heading font-semibold text-concrete-900 dark:text-white">
                  {language.code === 'th' ? 'การวิเคราะห์โดยละเอียด' : 'Detailed Analysis'}
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  
                  {/* Growth Rate */}
                  <div className="p-4 bg-concrete-50 dark:bg-void-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-concrete-600 dark:text-concrete-400" />
                      <span className="text-sm font-mono uppercase tracking-wide text-concrete-600 dark:text-concrete-400">
                        {language.code === 'th' ? 'อัตราการเติบโต' : 'Growth Rate'}
                      </span>
                    </div>
                    <div className={`text-lg font-heading font-semibold ${getGrowthRateColor(news.growthRate)}`}>
                      {formatGrowthRate(news.growthRate).text}
                    </div>
                  </div>

                  {/* Platforms - only show if we have platforms */}
                  {news.platforms && news.platforms.length > 0 && (
                    <div className="p-4 bg-concrete-50 dark:bg-void-800 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Globe className="w-4 h-4 text-concrete-600 dark:text-concrete-400" />
                        <span className="text-sm font-mono uppercase tracking-wide text-concrete-600 dark:text-concrete-400">
                          {language.code === 'th' ? 'แพลตฟอร์ม' : 'Platforms'}
                        </span>
                      </div>
                      <div className="text-lg font-heading font-semibold text-concrete-900 dark:text-white">
                        {news.platforms.join(', ')}
                      </div>
                    </div>
                  )}

                  {/* Keywords */}
                  <div className="p-4 bg-concrete-50 dark:bg-void-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Hash className="w-4 h-4 text-concrete-600 dark:text-concrete-400" />
                      <span className="text-sm font-mono uppercase tracking-wide text-concrete-600 dark:text-concrete-400">
                        {language.code === 'th' ? 'คำสำคัญ' : 'Keywords'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {collectDisplayKeywords(news).keywords.map((keyword, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-accent-100 text-accent-800 dark:bg-accent-800/20 dark:text-accent-300"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* AI Opinion */}
                  {news.aiOpinion && (
                    <div className="p-4 bg-concrete-50 dark:bg-void-800 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Code2 className="w-4 h-4 text-concrete-600 dark:text-concrete-400" />
                        <span className="text-sm font-mono uppercase tracking-wide text-concrete-600 dark:text-concrete-400">
                          AI Opinion
                        </span>
                      </div>
                      <div className="text-lg font-heading font-semibold text-concrete-900 dark:text-white">
                        {news.aiOpinion}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* G) Optional Sections */}
            {USE_LEGACY_MODAL_LAYOUT && (
              <>
                {/* Reason (why trending) */}
                {news.reason && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-heading font-semibold text-concrete-900 dark:text-white">
                      {language.code === 'th' ? 'เหตุผลที่กำลังเป็นที่นิยม' : 'Why Trending'}
                    </h3>
                    <p className="text-concrete-700 dark:text-concrete-300 leading-relaxed bg-concrete-50 dark:bg-void-800 p-4 rounded-lg">
                      {news.reason}
                    </p>
                  </div>
                )}

                {/* Score Details */}
                {news.scoreDetails && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-heading font-semibold text-concrete-900 dark:text-white">
                      {language.code === 'th' ? 'รายละเอียดคะแนน' : 'Score Details'}
                    </h3>
                    <div className="bg-concrete-50 dark:bg-void-800 p-4 rounded-lg">
                      <pre className="text-sm text-concrete-700 dark:text-concrete-300 whitespace-pre-wrap font-mono">
                        {news.scoreDetails}
                      </pre>
                    </div>
                  </div>
                )}


              </>
            )}
          </div>
        </div>
      </div>

      {/* Image Modal */}
      <ImageModal
        src={news.displayImageUrl}
        alt={`Illustration for: ${news.title}`}
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
      />
    </div>
  )
}
