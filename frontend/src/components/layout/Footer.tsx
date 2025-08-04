'use client'

import { useUIStore } from '../../stores/uiStore'
import { useNewsStore } from '../../stores/newsStore'
import { Github, Heart, Coffee, Zap, Globe, Database } from 'lucide-react'

export function Footer() {
  const { language, theme } = useUIStore()
  const { lastUpdated, news } = useNewsStore()
  
  const formatDate = (date: Date) => {
    if (language.code === 'th') {
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const stats = {
    totalStories: news.length,
    aiImages: news.filter(item => item.ai_image_url).length,
    avgScore: news.length > 0 ? Math.round(news.reduce((sum, item) => sum + (item.popularity_score_precise || item.popularity_score), 0) / news.length) : 0,
    topCategories: [...new Set(news.map(item => item.auto_category))].filter(Boolean).length
  }

  return (
    <footer className="bg-concrete-50 dark:bg-void-950 border-t border-concrete-200 dark:border-void-800">
      <div className="container-full py-16">
        <div className="grid lg:grid-cols-4 gap-12">
          {/* Brand section */}
          <div className="lg:col-span-2">
            <div className="flex items-baseline space-x-1 mb-6">
              <span className="text-4xl font-heading font-bold text-concrete-900 dark:text-white">
                Trend
              </span>
              <span className="text-4xl font-heading font-bold text-accent-500">
                Siam
              </span>
            </div>
            <p className="text-lg text-concrete-600 dark:text-concrete-400 mb-8 max-w-md leading-relaxed">
              {language.code === 'th' 
                ? 'แพลตฟอร์มติดตามข่าวและเทรนด์ของประเทศไทยที่ขับเคลื่อนด้วย AI เพื่อการวิเคราะห์และสรุปข้อมูลที่แม่นยำ'
                : 'AI-powered Thai trending news platform delivering accurate analysis and insights from real-time data sources.'
              }
            </p>
            
            {/* Live status */}
            {lastUpdated && (
              <div className="flex items-center gap-3 p-4 bg-white dark:bg-void-900 rounded-lg border border-concrete-200 dark:border-void-800">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="font-mono text-xs uppercase tracking-wide text-green-600 dark:text-green-400">
                    Live
                  </span>
                </div>
                <span className="text-sm text-concrete-600 dark:text-concrete-400">
                  {language.code === 'th' ? 'อัปเดตล่าสุด' : 'Last updated'}: {formatDate(lastUpdated)}
                </span>
              </div>
            )}
          </div>

          {/* Stats section */}
          <div>
            <h3 className="text-lg font-heading font-semibold text-concrete-900 dark:text-white mb-6 uppercase tracking-wide">
              {language.code === 'th' ? 'สถิติ' : 'Statistics'}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-concrete-600 dark:text-concrete-400 text-sm">
                  {language.code === 'th' ? 'ข่าวทั้งหมด' : 'Total Stories'}
                </span>
                <span className="font-heading font-bold text-concrete-900 dark:text-white">
                  {stats.totalStories}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-concrete-600 dark:text-concrete-400 text-sm">
                  {language.code === 'th' ? 'ภาพ AI' : 'AI Images'}
                </span>
                <span className="font-heading font-bold text-accent-500">
                  {stats.aiImages}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-concrete-600 dark:text-concrete-400 text-sm">
                  {language.code === 'th' ? 'คะแนนเฉลี่ย' : 'Avg Score'}
                </span>
                <span className="font-heading font-bold text-thai-500">
                  {stats.avgScore}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-concrete-600 dark:text-concrete-400 text-sm">
                  {language.code === 'th' ? 'หมวดหมู่' : 'Categories'}
                </span>
                <span className="font-heading font-bold text-concrete-900 dark:text-white">
                  {stats.topCategories}
                </span>
              </div>
            </div>
          </div>

          {/* Links section */}
          <div>
            <h3 className="text-lg font-heading font-semibold text-concrete-900 dark:text-white mb-6 uppercase tracking-wide">
              {language.code === 'th' ? 'ลิงค์' : 'Links'}
            </h3>
            <div className="space-y-3">
              <a 
                href="/weekly-report" 
                className="block text-concrete-600 dark:text-concrete-400 hover:text-accent-500 dark:hover:text-accent-400 transition-colors text-sm"
              >
                {language.code === 'th' ? 'รายงานสัปดาห์' : 'Weekly Report'}
              </a>
              <a 
                href="/terms" 
                className="block text-concrete-600 dark:text-concrete-400 hover:text-accent-500 dark:hover:text-accent-400 transition-colors text-sm"
              >
                {language.code === 'th' ? 'เงื่อนไขการใช้งาน' : 'Terms of Service'}
              </a>
              <a 
                href="/privacy" 
                className="block text-concrete-600 dark:text-concrete-400 hover:text-accent-500 dark:hover:text-accent-400 transition-colors text-sm"
              >
                {language.code === 'th' ? 'นโยบายความเป็นส่วนตัว' : 'Privacy Policy'}
              </a>
            </div>
          </div>
        </div>

        {/* Technical info and credits */}
        <div className="mt-16 pt-8 border-t border-concrete-200 dark:border-void-800">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Tech stack */}
            <div className="flex flex-wrap items-center gap-6 text-sm text-concrete-500 dark:text-concrete-500">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                <span className="font-mono">YouTube API v3</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span className="font-mono">OpenAI DALL-E</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                <span className="font-mono">Next.js 14</span>
              </div>
            </div>

            {/* Copyright and credits */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 text-sm text-concrete-500 dark:text-concrete-500">
              <span>
                © 2025 TrendSiam. {language.code === 'th' ? 'สงวนลิขสิทธิ์' : 'All rights reserved.'}
              </span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  {language.code === 'th' ? 'สร้างด้วย' : 'Built with'} <Heart className="w-3 h-3 text-red-500" />
                  {language.code === 'th' ? 'และ' : 'and'} <Coffee className="w-3 h-3 text-amber-600" />
                </span>
                <a 
                  href="https://github.com" 
                  className="flex items-center gap-1 hover:text-concrete-700 dark:hover:text-concrete-300 transition-colors"
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <Github className="w-4 h-4" />
                  <span className="font-mono">Source</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}