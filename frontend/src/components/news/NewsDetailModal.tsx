'use client'

import { useEffect, useState } from 'react';
import { X, ExternalLink, Calendar, Eye, ThumbsUp, MessageCircle, Star, Code2, Copy, BarChart3 } from 'lucide-react'
import { NewsStory } from '../../lib/schema/news'
import type { UINewsItem } from '../../lib/normalizeNewsItem'
import { useUIStore } from '../../stores/uiStore'
import { ImageModal } from '../ui/ImageModal'
import { newsApi } from '../../lib/api'
import toast from 'react-hot-toast'
import { getFreshAIImageUrl } from '../../lib/imageUtils'
import { getGrowthRateLabel } from '../../lib/constants/businessRules'
import { getPopularitySubtext, formatPopularityScore, getPopularityColor, getPopularityBg } from '../../lib/helpers/popularityHelpers'
import { formatGrowthRate } from '../../lib/helpers/growthHelpers'
import { collectDisplayKeywords } from '../../lib/helpers/keywords'
import { getSummaryByLang, getSummaryLabel } from '../../lib/helpers/summaryHelpers'
import { generateScoreNarrative, extractNarrativeInput } from '../../lib/helpers/scoreNarrative'
import { formatGrowthRateDetailed, formatNumberShort, formatNumberFull } from '../../lib/helpers/numberHelpers'



interface NewsDetailModalProps {
  news: UINewsItem | null
  isOpen: boolean
  onClose: () => void
}

export function NewsDetailModal({ news, isOpen, onClose }: NewsDetailModalProps) {
  const { language } = useUIStore()
  const [showPrompt, setShowPrompt] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)

  // Increment view count when modal opens (once per session per story)
  useEffect(() => {
    if (isOpen && news?.video_id) {
      // Check if we've already tracked this story in this session
      const sessionKey = `view_tracked_${news.video_id}`
      if (typeof window !== 'undefined' && window.sessionStorage.getItem(sessionKey)) {
        return // Already tracked
      }
      
      // Call telemetry endpoint to increment view count
      fetch('/api/telemetry/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: news.video_id,
          story_id: news.id
        })
      })
        .then(res => res.json())
        .then((data: { success: boolean; views?: number }) => {
          if (data.success) {
            console.log('[modal] ✅ View tracked:', news.video_id, 'new count:', data.views)
            // Mark as tracked in session storage
            if (typeof window !== 'undefined') {
              window.sessionStorage.setItem(sessionKey, 'true')
            }
          }
        })
        .catch((error: unknown) => {
          console.warn('[modal] Failed to track view:', error)
        })
    }
  }, [isOpen, news?.video_id, news?.id])

  // Reset prompt state when story changes to prevent AI prompt leak
  useEffect(() => {
    setShowPrompt(false)
  }, [news?.id])

  if (!isOpen || !news) return null

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



  const getGrowthRateColor = (growthRate: number | null) => {
    if (!growthRate || growthRate <= 0) return 'text-concrete-600 dark:text-concrete-400'
    if (growthRate >= 100000) return 'text-emerald-600 dark:text-emerald-400'
    if (growthRate >= 10000) return 'text-amber-600 dark:text-amber-400'
    return 'text-blue-600 dark:text-blue-400'
  }

  const formatDate = (dateString: string | null | undefined) => {
    // Handle NULL/empty published dates gracefully (FIX 2025-10-10)
    if (!dateString || dateString.trim() === '') {
      return '—'  // Placeholder for missing dates
    }
    
    try {
      const date = new Date(dateString)
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return '—'  // Invalid date → placeholder
      }
      
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
      return '—'  // Parse error → placeholder
    }
  }







  // Use centralized language-aware summary helper
  // This will re-render when language.code changes
  const currentSummary = getSummaryByLang(news, language.code)

  const handleCopyPrompt = async () => {
    const prompt = news.aiPrompt
    if (!prompt?.trim()) return
    
    try {
      await navigator.clipboard.writeText(prompt)
      toast.success(language.code === 'th' ? 'คัดลอกพรอมต์แล้ว!' : 'AI prompt copied!')
    } catch (error) {
      toast.error(language.code === 'th' ? 'ไม่สามารถคัดลอกได้' : 'Failed to copy prompt')
    }
  }

  const getYouTubeUrl = () => {
    // Use sourceUrl from API (guaranteed non-null from API)
    return news.sourceUrl || null
  }



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-void-900 rounded-2xl shadow-2xl overflow-hidden">
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
            {/* Title and rank */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-accent-500 text-white rounded-full text-sm font-mono font-medium">
                  <Star className="w-3 h-3" />
                  #{news.rank}
                </span>
                <span className="px-3 py-1 bg-concrete-100 dark:bg-void-800 text-concrete-700 dark:text-concrete-300 rounded-full text-sm font-mono uppercase tracking-wide">
                  {news.category || news.auto_category}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-heading font-bold text-concrete-900 dark:text-white leading-tight">
                {news.title}
              </h1>
            </div>

            {/* PHASE 4: AI-Generated Image - using camelCase fields, ONLY for Top 3 */}
            {news.showImage && news.imageUrl && (
              <div className="space-y-4">
                <div className="image-reveal rounded-xl overflow-hidden group relative">
                  <img 
                    src={news.imageUrl}
                    alt={`AI-generated illustration for: ${news.title}`}
                    className="w-full h-64 md:h-80 object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                    onClick={() => setShowImageModal(true)}
                    onError={(e) => {
                      console.error(`🖼️ MODAL AI IMAGE LOAD FAILED:`, {
                        imageUrl: news.imageUrl,
                        title: news.title?.substring(0, 40) + '...',
                        storyId: news.id
                      })
                      // PHASE 3: Hide broken images in modal too
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.parentElement?.parentElement?.remove()
                    }}
                  />
                  
                  {/* AI-Generated Badge */}
                  <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/70 text-white text-sm rounded-lg backdrop-blur-sm border border-white/20">
                    <span className="flex items-center gap-2">
                      🤖 <span className="font-medium">AI-Generated Image</span>
                    </span>
                  </div>

                </div>
                
                {/* View Image Actions */}
                <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowImageModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-concrete-100 dark:bg-void-800 hover:bg-concrete-200 dark:hover:bg-void-700 rounded-lg transition-colors text-sm font-medium text-concrete-700 dark:text-concrete-300"
                    >
                      <Eye className="w-4 h-4" />
                      {language.code === 'th' ? 'ดูภาพขยาย' : 'View Image Fullscreen'}
                    </button>
                    
                    {/* PHASE 3: AI Prompt Button - unified with API logic, only show for top-3 with prompts */}
                    {news.showAiPrompt && (
                      <button
                        onClick={() => setShowPrompt(!showPrompt)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 rounded-lg transition-colors text-sm font-medium text-purple-700 dark:text-purple-300"
                      >
                        <Code2 className="w-4 h-4" />
                        {language.code === 'th' ? 'ดู AI Prompt' : 'View AI Prompt'}
                      </button>
                    )}
                    
                    <a
                      href={news.display_image_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {language.code === 'th' ? 'เปิดภาพในแท็บใหม่' : 'View Image'}
                    </a>
                  </div>
                </div>
            )}

            {/* PHASE 4: AI Prompt Panel - using camelCase field */}
            {showPrompt && news.aiPrompt?.trim() && (
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
                  {news.aiPrompt}
                </p>
              </div>
            )}

            {/* Popularity Score - Enhanced with rich narrative */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className={`p-6 rounded-xl ${getPopularityBg(news.popularity_score || news.popularityScore || 0)}`}>
                <div className="flex items-center gap-3 mb-3">
                  <BarChart3 className={`w-5 h-5 ${getPopularityColor(news.popularity_score || news.popularityScore || 0)}`} />
                  <span className="text-sm font-mono uppercase tracking-wide text-concrete-600 dark:text-concrete-400">
                    {language.code === 'th' ? 'คะแนนความนิยม' : 'Popularity Score'}
                  </span>
                </div>
                <div className={`text-4xl font-heading font-bold ${getPopularityColor(news.popularity_score || news.popularityScore || 0)} mb-2`}>
                  {formatPopularityScore(news.popularity_score_precise || news.popularityScore || 0)}
                  <span className="text-lg">/100</span>
                </div>
                <p className="text-sm text-concrete-700 dark:text-concrete-300 leading-relaxed" data-testid="popularity-narrative">
                  {news.popularityNarrative || generateScoreNarrative(extractNarrativeInput(news, language.code))}
                </p>
              </div>

              {/* Channel and metrics */}
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
                        {news.channel || 'N/A'}
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

                {/* Engagement metrics - with tooltips for full numbers */}
                <div className="grid grid-cols-3 gap-3">
                  <div 
                    className="text-center p-3 bg-concrete-100 dark:bg-void-800 rounded-lg"
                    title={`${formatNumberFull(news.videoViews || news.views || 0)} views`}
                  >
                    <Eye className="w-4 h-4 mx-auto mb-1 text-concrete-600 dark:text-concrete-400" />
                    <div className="text-sm font-medium text-concrete-900 dark:text-white">
                      {formatNumberShort(news.videoViews || news.views || 0)}
                    </div>
                    <div className="text-xs text-concrete-500 dark:text-concrete-500">
                      Views
                    </div>
                  </div>
                  <div 
                    className="text-center p-3 bg-concrete-100 dark:bg-void-800 rounded-lg"
                    title={`${formatNumberFull(news.likes || 0)} likes`}
                  >
                    <ThumbsUp className="w-4 h-4 mx-auto mb-1 text-concrete-600 dark:text-concrete-400" />
                    <div className="text-sm font-medium text-concrete-900 dark:text-white">
                      {formatNumberShort(news.likes || 0)}
                    </div>
                    <div className="text-xs text-concrete-500 dark:text-concrete-500">
                      Likes
                    </div>
                  </div>
                  <div 
                    className="text-center p-3 bg-concrete-100 dark:bg-void-800 rounded-lg"
                    title={`${formatNumberFull(news.comments || 0)} comments`}
                  >
                    <MessageCircle className="w-4 h-4 mx-auto mb-1 text-concrete-600 dark:text-concrete-400" />
                    <div className="text-sm font-medium text-concrete-900 dark:text-white">
                      {formatNumberShort(news.comments || 0)}
                    </div>
                    <div className="text-xs text-concrete-500 dark:text-concrete-500">
                      Comments
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary - Language-reactive */}
            <div className="space-y-4">
              <h3 className="text-lg font-heading font-semibold text-concrete-900 dark:text-white">
                {getSummaryLabel(language.code)}
              </h3>
              <p className="text-concrete-700 dark:text-concrete-300 leading-relaxed">
                {currentSummary}
              </p>
            </div>



            {/* Detailed Analytics - EXACTLY 4 blocks (LISA legacy layout) */}
            {news.view_details && (
              <div className="space-y-4">
                <h3 className="text-lg font-heading font-semibold text-concrete-900 dark:text-white">
                  {language.code === 'th' ? 'การวิเคราะห์โดยละเอียด' : 'Detailed Analytics'}
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {/* 1. Growth Rate - Enhanced with detailed metrics */}
                  <div className="p-4 bg-concrete-50 dark:bg-void-800 rounded-lg">
                    <div className="text-sm font-mono uppercase tracking-wide text-concrete-600 dark:text-concrete-400 mb-2">
                      {language.code === 'th' ? 'อัตราการเติบโต' : 'Growth Rate'}
                    </div>
                    <div className="space-y-2">
                      {/* Primary: Growth label chip */}
                      <div className="text-lg font-heading font-semibold">
                        <span className={getGrowthRateColor(news.growthRateValue ?? null)}>
                          {news.growthRateLabel || 'Stable'}
                        </span>
                      </div>
                      
                      {/* Secondary: Detailed rate if available */}
                      {news.growthRateValue && news.growthRateValue > 0 && (
                        <div 
                          className="text-sm text-concrete-700 dark:text-concrete-300"
                          title={`Exact: ${formatNumberFull(news.growthRateValue)} views/day`}
                        >
                          {formatGrowthRateDetailed(news.growthRateValue, 24, language.code)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Platforms */}
                  <div className="p-4 bg-concrete-50 dark:bg-void-800 rounded-lg">
                    <div className="text-sm font-mono uppercase tracking-wide text-concrete-600 dark:text-concrete-400 mb-2">
                      {language.code === 'th' ? 'แพลตฟอร์ม' : 'Platforms'}
                    </div>
                    <div className="text-lg font-heading font-semibold text-concrete-900 dark:text-white">
                      {news.platforms && news.platforms.length > 0 
                        ? news.platforms.join(', ')
                        : news.platform || 'YouTube'}
                    </div>
                  </div>

                  {/* 3. Keywords */}
                  <div className="p-4 bg-concrete-50 dark:bg-void-800 rounded-lg">
                    <div className="text-sm font-mono uppercase tracking-wide text-concrete-600 dark:text-concrete-400 mb-2">
                      {language.code === 'th' ? 'คำสำคัญ' : 'Keywords'}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const keywordData = collectDisplayKeywords(news);
                        if (keywordData.keywords.length === 0) {
                          return (
                            <span className="text-sm text-concrete-500 dark:text-concrete-500 italic">
                              {language.code === 'th' ? 'ไม่พบคำสำคัญ' : 'No keywords available'}
                            </span>
                          );
                        }
                        return keywordData.keywords.map((keyword, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-accent-100 text-accent-800 dark:bg-accent-800/20 dark:text-accent-300"
                          >
                            {keyword}
                          </span>
                        ));
                      })()}
                    </div>
                  </div>

                  {/* 4. AI Opinion */}
                  {news.aiOpinion && news.aiOpinion !== 'N/A' && news.aiOpinion !== 'No AI opinion available' && (
                    <div className="p-4 bg-concrete-50 dark:bg-void-800 rounded-lg">
                      <div className="text-sm font-mono uppercase tracking-wide text-concrete-600 dark:text-concrete-400 mb-2">
                        AI Opinion
                      </div>
                      <div className="text-sm text-concrete-700 dark:text-concrete-300 leading-relaxed">
                        {news.aiOpinion}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Source link - Only show if valid URL exists */}
            {getYouTubeUrl() && (
              <div className="pt-6 border-t border-concrete-200 dark:border-void-800">
                <a
                  href={getYouTubeUrl()!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-6 py-3 bg-accent-500 hover:bg-accent-600 text-white font-heading font-medium rounded-lg transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                  {language.code === 'th' ? 'ดูต้นฉบับใน YouTube' : 'View Original on YouTube'}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI-Generated Image Modal - ONLY for Top 3 */}
      {news.showImage && news.imageUrl && (
        <ImageModal
          src={news.imageUrl}
          alt={`AI-generated illustration for: ${news.title}`}
          isOpen={showImageModal}
          onClose={() => setShowImageModal(false)}
        />
      )}
    </div>
  )
}