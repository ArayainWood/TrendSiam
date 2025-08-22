'use client'

import { useEffect, useState } from 'react'
import { Sparkles, TrendingUp } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { useNewsStore } from '../../stores/newsStore'
import { getText } from '../../lib/i18n'
import { calculateAIImagesCount } from '../../lib/constants/businessRules'

export function HeroSection() {
  const { language } = useUIStore()
  const { news, loading } = useNewsStore()
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    if (language.code === 'th') {
      return date.toLocaleString('th-TH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } else {
      return date.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-concrete-50 via-white to-thai-50 dark:from-void-950 dark:via-void-900 dark:to-void-800">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent-500/5 to-transparent skew-y-[-2deg] transform origin-top-left"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-thai-500/5 to-transparent skew-y-[2deg] transform origin-bottom-right"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="text-center space-y-8">
          {/* Status indicator */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              Live • {formatTime(currentTime)}
            </span>
          </div>

          {/* Main heading */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold">
              <span className="gradient-text">
                {getText('app_title', language.code)}
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-concrete-600 dark:text-concrete-300 max-w-3xl mx-auto font-medium">
              {getText('app_subtitle', language.code)}
            </p>
          </div>

          {/* Description */}
          <div className="max-w-2xl mx-auto">
            <p className="text-lg text-concrete-700 dark:text-concrete-300 leading-relaxed">
              {getText('app_description', language.code)}
            </p>
          </div>

          {/* Features highlights */}
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-concrete-600 dark:text-concrete-400">
              <Sparkles className="w-4 h-4 text-accent-500" />
              <span>AI-Powered Summaries</span>
            </div>
            <div className="flex items-center gap-2 text-concrete-600 dark:text-concrete-400">
              <TrendingUp className="w-4 h-4 text-thai-500" />
              <span>Real-time Trending</span>
            </div>
            <div className="flex items-center gap-2 text-concrete-600 dark:text-concrete-400">
              <span className="text-lg">🌐</span>
              <span>Bilingual Support</span>
            </div>
          </div>

          {/* Live stats */}
          {!loading && news.length > 0 && (
            <div className="inline-flex items-center gap-4 px-6 py-3 bg-white/50 dark:bg-void-800/50 backdrop-blur-sm rounded-2xl border border-concrete-200 dark:border-void-700">
              <div className="text-center">
                <div className="text-2xl font-bold text-accent-600 dark:text-accent-400">
                  {news.length}
                </div>
                <div className="text-xs text-concrete-600 dark:text-concrete-400">
                  {getText('total_stories', language.code)}
                </div>
              </div>
              <div className="w-px h-8 bg-concrete-300 dark:bg-void-600"></div>
              <div className="text-center">
                <div className="text-2xl font-bold text-thai-600 dark:text-thai-400">
                  {calculateAIImagesCount(news)}
                </div>
                <div className="text-xs text-concrete-600 dark:text-concrete-400">
                  AI Images (Top 3)
                </div>
              </div>
              <div className="w-px h-8 bg-concrete-300 dark:bg-void-600"></div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {new Set(news.map(item => item.auto_category)).size}
                </div>
                <div className="text-xs text-concrete-600 dark:text-concrete-400">
                  {getText('categories_count', language.code)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-concrete-50 dark:from-void-950 to-transparent"></div>
    </section>
  )
}