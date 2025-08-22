'use client'

import { useState } from 'react'
import { ExternalLink, Eye, Star, Calendar } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { getText } from '../../lib/i18n'
import { NewsStory } from '../../lib/schema/news'
import { getFreshAIImageUrl } from '../../lib/imageUtils'
import { isTop3, selectCardImage, debugImageSelection } from '../../lib/imagePolicy'

interface TopStoryCardProps {
  story: NewsStory
  rank: number
}

export function TopStoryCard({ story, rank }: TopStoryCardProps) {
  const { language } = useUIStore()
  const [imageError, setImageError] = useState(false)
  
  // Use centralized policy for Top 3 detection and image selection
  const storyIsTop3 = isTop3(story, rank - 1) // rank is 1-based, convert to 0-based index
  const imageSelection = selectCardImage(story, { isTop3: storyIsTop3 })
  
  // Debug logging (temporary)
  debugImageSelection(story, rank - 1, 'TopStoryCard', imageSelection)

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

  const formatDate = (dateString: string) => {
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

  const getRankStyle = (rank: number) => {
    if (rank === 1) {
      return 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white'
    } else if (rank === 2) {
      return 'bg-gradient-to-br from-gray-300 to-gray-500 text-white'
    } else if (rank === 3) {
      return 'bg-gradient-to-br from-amber-600 to-amber-800 text-white'
    } else {
      return 'bg-accent-500 text-white'
    }
  }

  const getRankIcon = (rank: number) => {
    if (rank <= 3) {
      return '🏆'
    } else if (rank <= 5) {
      return '🎖️'
    } else {
      return '⭐'
    }
  }

  return (
    <div className="flex items-center gap-4 p-6 bg-white dark:bg-void-800 rounded-xl border border-concrete-200 dark:border-void-600 hover:border-accent-300 dark:hover:border-accent-600 transition-all duration-200 hover:shadow-lg group">
      {/* Rank Badge */}
      <div className="flex-shrink-0 relative">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-lg ${getRankStyle(rank)}`}>
          #{rank}
        </div>
        <div className="absolute -top-1 -right-1 text-lg">
          {getRankIcon(rank)}
        </div>
      </div>

      {/* AI-Generated Image - Only for Top 3 */}
      {storyIsTop3 && imageSelection.isAI && imageSelection.hasImage && !imageError && (
        <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-concrete-100 dark:bg-void-700 relative">
          <img
            src={imageSelection.src}
            alt={`AI-generated illustration for: ${story.title}`}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            onError={() => setImageError(true)}
          />
          
          {/* AI-Generated Mini Badge */}
          <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/70 text-white text-xs rounded backdrop-blur-sm">
            🤖
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-lg text-concrete-900 dark:text-white line-clamp-2 group-hover:text-accent-600 dark:group-hover:text-accent-400 transition-colors">
          {story.title}
        </h3>
        
        <div className="flex items-center gap-2 text-sm text-concrete-600 dark:text-concrete-400 mt-1">
          <span className="font-medium">{story.channel}</span>
          <span>•</span>
          <span className="text-concrete-500 dark:text-concrete-500">{story.auto_category}</span>
        </div>

        <div className="flex items-center gap-4 text-sm text-concrete-600 dark:text-concrete-400 mt-2">
          <div className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            <span>{formatNumber(story.view_count)} views</span>
          </div>
          
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-amber-500" />
            <span className="font-medium text-amber-600 dark:text-amber-400">
              {Math.round(story.popularity_score_precise || story.popularity_score)}/100
            </span>
            {story.view_details?.score && story.view_details.score !== 'N/A' && (
              <span className="text-xs text-concrete-600 dark:text-concrete-400 ml-1">
                ({story.view_details.score})
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(story.published_date)}</span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex-shrink-0">
        <a
          href={`https://www.youtube.com/watch?v=${story.video_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          title={getText('view_on_youtube', language.code)}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  )
}