'use client'

import React, { useEffect, useState } from 'react'
import { NewsStory } from '../../lib/schema/news'
import type { UINewsItem } from '../../lib/normalizeNewsItem'

interface ImageDebuggerProps {
  news: UINewsItem[]
  title?: string
}

export function ImageDebugger({ news, title = "Image Debug Info" }: ImageDebuggerProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  const checkImageUrl = async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      return response.ok
    } catch {
      return false
    }
  }

  const getImageStatus = (story: UINewsItem, index: number) => {
    const rank = index + 1
    const aiImage = story.isAIImage ? story.displayImageUrl : null
    
    return {
      rank,
      title: story.title?.substring(0, 40) + '...',
      aiImage: aiImage || 'None',
      hasAiImage: !!aiImage,
      finalUrl: aiImage // Only AI images
    }
  }

  const top3Stories = news.slice(0, 3)

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-mono hover:bg-purple-700 transition-colors"
      >
        🐛 Image Debug
      </button>
      
      {isOpen && (
        <div className="absolute bottom-12 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-4 w-96 max-h-96 overflow-y-auto shadow-lg">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-sm">{title}</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-4 text-xs font-mono">
            <div className="text-gray-600 dark:text-gray-400">
              Total Stories: {news.length} | Top 3 Analysis:
            </div>
            
            {top3Stories.map((story, index) => {
              const status = getImageStatus(story, index)
              
              return (
                <div key={story.id} className={`p-3 rounded border ${status.rank === 2 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'}`}>
                  <div className="font-bold mb-2 flex items-center gap-2">
                    <span>#{status.rank}</span>
                    {status.rank === 2 && <span className="text-red-600 dark:text-red-400">⚠️ PROBLEMATIC</span>}
                  </div>
                  
                  <div className="space-y-1 text-gray-700 dark:text-gray-300">
                    <div><strong>Title:</strong> {status.title}</div>
                    <div><strong>Video ID:</strong> {story.video_id || 'None'}</div>
                    <div className="flex items-center gap-2">
                      <strong>AI Image:</strong> 
                      <span className={status.hasAiImage ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {status.hasAiImage ? '✅' : '❌'}
                      </span>
                    </div>
                    <div className="text-xs break-all text-gray-600 dark:text-gray-400">
                      {status.aiImage}
                    </div>
                    
                    <div className="border-t pt-2 mt-2">
                      <strong>Final URL:</strong>
                      <div className="text-xs break-all text-gray-600 dark:text-gray-400">
                        {status.finalUrl || 'No image available'}
                      </div>
                    </div>
                    
                    {status.finalUrl && (
                      <div className="pt-2">
                        <button
                          onClick={() => status.finalUrl && window.open(status.finalUrl, '_blank')}
                          className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                        >
                          Test Image URL
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            
            <div className="border-t pt-3 text-gray-600 dark:text-gray-400">
              <div><strong>Image Summary (AI-Only Mode):</strong></div>
              <div>AI Images: {top3Stories.filter(s => s.ai_image_url).length}/3</div>
              <div className="text-xs mt-1">External thumbnails disabled ✅</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
