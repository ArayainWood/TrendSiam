'use client'

import { useEffect, useState } from 'react';
import { X, ExternalLink, Calendar, Eye, ThumbsUp, MessageCircle, Star, Code2, Copy, BarChart3 } from 'lucide-react'
import { NewsItem } from '../../types'
import { useUIStore } from '../../stores/uiStore'
import { ImageModal } from '../ui/ImageModal'
import { newsApi } from '../../lib/api'
import toast from 'react-hot-toast'


interface NewsDetailModalProps {
  news: NewsItem | null
  isOpen: boolean
  onClose: () => void
}

export function NewsDetailModal({ news, isOpen, onClose }: NewsDetailModalProps) {
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
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      } else {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      }
    } catch {
      return dateString
    }
  }

  const handleCopyPrompt = async () => {
    if (!news.ai_image_prompt) return
    
    try {
      await navigator.clipboard.writeText(news.ai_image_prompt)
      toast.success(language.code === 'th' ? 'คัดลอกพรอมต์แล้ว!' : 'AI prompt copied!')
    } catch (error) {
      toast.error(language.code === 'th' ? 'ไม่สามารถคัดลอกได้' : 'Failed to copy prompt')
    }
  }

  const getYouTubeUrl = () => {
    return `https://www.youtube.com/watch?v=${news.video_id}`
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
                  {news.auto_category}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-heading font-bold text-concrete-900 dark:text-white leading-tight">
                {news.title}
              </h1>
            </div>

            {/* AI Image with prompt viewer */}
            {news.ai_image_url && (
              <div className="space-y-4">
                <div className="image-reveal rounded-xl overflow-hidden group relative">
                  <img 
                    src={news.ai_image_url}
                    alt={news.title}
                    className="w-full h-64 md:h-80 object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                    onClick={() => setShowImageModal(true)}
                  />

                </div>
                
                {/* AI Prompt Viewer */}
                {news.ai_image_prompt && (
                  <div className="space-y-3">
                    <button
                      onClick={() => setShowPrompt(!showPrompt)}
                      className="flex items-center gap-2 px-4 py-2 bg-concrete-100 dark:bg-void-800 hover:bg-concrete-200 dark:hover:bg-void-700 rounded-lg transition-colors text-sm font-medium text-concrete-700 dark:text-concrete-300"
                    >
                      <Code2 className="w-4 h-4" />
                      {language.code === 'th' ? 'ดู AI Prompt' : 'View AI Prompt'}
                    </button>
                    
                    {showPrompt && (
                      <div className="p-4 bg-concrete-50 dark:bg-void-800 rounded-lg border border-concrete-200 dark:border-void-700">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-mono uppercase tracking-wide text-concrete-600 dark:text-concrete-400">
                            {language.code === 'th' ? 'AI Image Prompt' : 'AI Image Prompt'}
                          </span>
                          <button
                            onClick={handleCopyPrompt}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-mono text-concrete-500 dark:text-concrete-500 hover:text-accent-500 transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                            Copy
                          </button>
                        </div>
                        <p className="text-sm text-concrete-700 dark:text-concrete-300 font-mono leading-relaxed">
                          {news.ai_image_prompt}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Popularity Score */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className={`p-6 rounded-xl ${getPopularityBg(news.popularity_score)}`}>
                <div className="flex items-center gap-3 mb-3">
                  <BarChart3 className={`w-5 h-5 ${getPopularityColor(news.popularity_score)}`} />
                  <span className="text-sm font-mono uppercase tracking-wide text-concrete-600 dark:text-concrete-400">
                    {language.code === 'th' ? 'คะแนนความนิยม' : 'Popularity Score'}
                  </span>
                </div>
                <div className={`text-4xl font-heading font-bold ${getPopularityColor(news.popularity_score)} mb-2`}>
                  {news.popularity_score_precise?.toFixed(1) || news.popularity_score}
                  <span className="text-lg">/100</span>
                </div>
                <p className="text-sm text-concrete-700 dark:text-concrete-300 leading-relaxed">
                  {news.reason}
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
                        {news.channel}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-concrete-600 dark:text-concrete-400">
                        {language.code === 'th' ? 'เผยแพร่' : 'Published'}
                      </span>
                      <span className="text-sm font-medium text-concrete-900 dark:text-white">
                        {formatDate(news.published_date)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Engagement metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-concrete-100 dark:bg-void-800 rounded-lg">
                    <Eye className="w-4 h-4 mx-auto mb-1 text-concrete-600 dark:text-concrete-400" />
                    <div className="text-sm font-medium text-concrete-900 dark:text-white">
                      {formatNumber(news.view_count)}
                    </div>
                    <div className="text-xs text-concrete-500 dark:text-concrete-500">
                      Views
                    </div>
                  </div>
                  <div className="text-center p-3 bg-concrete-100 dark:bg-void-800 rounded-lg">
                    <ThumbsUp className="w-4 h-4 mx-auto mb-1 text-concrete-600 dark:text-concrete-400" />
                    <div className="text-sm font-medium text-concrete-900 dark:text-white">
                      {formatNumber(news.like_count)}
                    </div>
                    <div className="text-xs text-concrete-500 dark:text-concrete-500">
                      Likes
                    </div>
                  </div>
                  <div className="text-center p-3 bg-concrete-100 dark:bg-void-800 rounded-lg">
                    <MessageCircle className="w-4 h-4 mx-auto mb-1 text-concrete-600 dark:text-concrete-400" />
                    <div className="text-sm font-medium text-concrete-900 dark:text-white">
                      {formatNumber(news.comment_count)}
                    </div>
                    <div className="text-xs text-concrete-500 dark:text-concrete-500">
                      Comments
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-4">
              <h3 className="text-lg font-heading font-semibold text-concrete-900 dark:text-white">
                {language.code === 'th' ? 'สรุป' : 'Summary'}
              </h3>
              <p className="text-concrete-700 dark:text-concrete-300 leading-relaxed">
                {language.code === 'th' ? news.summary : news.summary_en}
              </p>
            </div>

            {/* View Details Analytics */}
            {news.view_details && (
              <div className="space-y-4">
                <h3 className="text-lg font-heading font-semibold text-concrete-900 dark:text-white">
                  {language.code === 'th' ? 'การวิเคราะห์โดยละเอียด' : 'Detailed Analytics'}
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-concrete-50 dark:bg-void-800 rounded-lg">
                    <div className="text-sm font-mono uppercase tracking-wide text-concrete-600 dark:text-concrete-400 mb-2">
                      {language.code === 'th' ? 'อัตราการเติบโต' : 'Growth Rate'}
                    </div>
                    <div className="text-lg font-heading font-semibold text-concrete-900 dark:text-white">
                      {news.view_details.growth_rate}
                    </div>
                  </div>
                  <div className="p-4 bg-concrete-50 dark:bg-void-800 rounded-lg">
                    <div className="text-sm font-mono uppercase tracking-wide text-concrete-600 dark:text-concrete-400 mb-2">
                      {language.code === 'th' ? 'แพลตฟอร์ม' : 'Platforms'}
                    </div>
                    <div className="text-lg font-heading font-semibold text-concrete-900 dark:text-white">
                      {news.view_details.platform_mentions}
                    </div>
                  </div>
                  <div className="p-4 bg-concrete-50 dark:bg-void-800 rounded-lg">
                    <div className="text-sm font-mono uppercase tracking-wide text-concrete-600 dark:text-concrete-400 mb-2">
                      {language.code === 'th' ? 'คำสำคัญ' : 'Keywords'}
                    </div>
                    <div className="text-lg font-heading font-semibold text-concrete-900 dark:text-white">
                      {news.view_details.matched_keywords}
                    </div>
                  </div>
                  <div className="p-4 bg-concrete-50 dark:bg-void-800 rounded-lg">
                    <div className="text-sm font-mono uppercase tracking-wide text-concrete-600 dark:text-concrete-400 mb-2">
                      AI Opinion
                    </div>
                    <div className="text-lg font-heading font-semibold text-concrete-900 dark:text-white">
                      {news.view_details.ai_opinion}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Source link */}
            <div className="pt-6 border-t border-concrete-200 dark:border-void-800">
              <a
                href={getYouTubeUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-6 py-3 bg-accent-500 hover:bg-accent-600 text-white font-heading font-medium rounded-lg transition-colors"
              >
                <ExternalLink className="w-5 h-5" />
                {language.code === 'th' ? 'ดูต้นฉบับใน YouTube' : 'View Original on YouTube'}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {news.ai_image_url && (
        <ImageModal
          src={news.ai_image_url}
          alt={news.title}
          isOpen={showImageModal}
          onClose={() => setShowImageModal(false)}
        />
      )}
    </div>
  )
}